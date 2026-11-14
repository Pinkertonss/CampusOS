import os
import ast
import math
import uuid
import time
import re
import operator
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from ..core.config import settings

logger = logging.getLogger("campusos.assistant")

# Configurable limits for safe calculation (Shared Invariant 3)
MAX_INPUT_LENGTH = 200
MAX_AST_NODES = 35
MAX_NESTING_DEPTH = 8
MAX_LITERAL_DIGITS = 12
MAX_LITERAL_VALUE = 1e12
MAX_EXPONENT = 100
MAX_POWER_BASE = 10000
MAX_RESULT_BITS = 1024  # ~308 decimal digits
MAX_OPERATION_BUDGET = 50

# Supported math operators for safe arithmetic calculation
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

class CalculationError(Exception):
    def __init__(self, message: str, error_code: str = "CALCULATION_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


def _get_tree_depth(node: ast.AST) -> int:
    """Computes the maximum nesting depth of an AST tree."""
    child_depths = [_get_tree_depth(child) for child in ast.iter_child_nodes(node)]
    return 1 + max(child_depths, default=0)


def _preflight_inspect(tree: ast.AST) -> None:
    """
    Preflight inspection of AST before evaluation begins.
    Validates node budget, nesting depth, forbids functions/attributes,
    and checks literal magnitude and chained power structures.
    """
    node_count = sum(1 for _ in ast.walk(tree))
    if node_count > MAX_AST_NODES:
        raise CalculationError(
            f"Expression is too complex (exceeds node budget limit of {MAX_AST_NODES}).",
            error_code="NODE_BUDGET_EXCEEDED",
        )

    depth = _get_tree_depth(tree)
    if depth > MAX_NESTING_DEPTH:
        raise CalculationError(
            f"Expression nesting exceeds maximum depth limit of {MAX_NESTING_DEPTH}.",
            error_code="NESTING_DEPTH_EXCEEDED",
        )

    for node in ast.walk(tree):
        # Strictly forbid any non-arithmetic syntax
        if isinstance(node, (ast.Call, ast.Attribute, ast.Name, ast.Import, ast.ImportFrom,
                              ast.Lambda, ast.List, ast.Dict, ast.Set, ast.Subscript)):
            raise CalculationError(
                "Forbidden syntax: Functions, variables, and code execution are strictly disallowed.",
                error_code="FORBIDDEN_SYNTAX",
            )

        # Validate numeric literal constants
        if isinstance(node, ast.Constant):
            val = node.value
            if not isinstance(val, (int, float)):
                raise CalculationError(
                    "Only numeric constants are supported.",
                    error_code="NON_NUMERIC_CONSTANT",
                )
            if abs(val) > MAX_LITERAL_VALUE or len(str(val)) > MAX_LITERAL_DIGITS:
                raise CalculationError(
                    f"Numeric literal exceeds maximum allowed size ({MAX_LITERAL_VALUE}).",
                    error_code="LITERAL_TOO_LARGE",
                )

        # Disallow chained exponentiation / power towers before evaluation (e.g. 2 ** 2 ** 2)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
            if isinstance(node.left, ast.BinOp) and isinstance(node.left.op, ast.Pow):
                raise CalculationError(
                    "Chained exponentiation / power towers are not permitted.",
                    error_code="POWER_TOWER_REJECTED",
                )
            if isinstance(node.right, ast.BinOp) and isinstance(node.right.op, ast.Pow):
                raise CalculationError(
                    "Chained exponentiation / power towers are not permitted.",
                    error_code="POWER_TOWER_REJECTED",
                )


def _check_parenthesis_depth(expr: str, max_depth: int = MAX_NESTING_DEPTH) -> None:
    """Checks that parentheses nesting depth does not exceed max_depth."""
    current_depth = 0
    for char in expr:
        if char == "(":
            current_depth += 1
            if current_depth > max_depth:
                raise CalculationError(
                    f"Expression nesting exceeds maximum depth limit of {max_depth}.",
                    error_code="NESTING_DEPTH_EXCEEDED",
                )
        elif char == ")":
            current_depth -= 1
            if current_depth < 0:
                raise CalculationError("Mismatched parentheses in expression.", error_code="SYNTAX_ERROR")
    if current_depth != 0:
        raise CalculationError("Unclosed parenthesis in expression.", error_code="SYNTAX_ERROR")


def safe_calculate(expression: str) -> Dict[str, Any]:
    """
    Evaluates basic arithmetic expressions using Python AST with enforceable preflight bounds.
    Guarantees:
    - Preflight rejection of expensive powers and complex structures before computation.
    - Result bit length bound (<= 1024 bits).
    - Enforceable operation budget (<= 50 steps).
    - Finite floating-point results; rejection of non-finite/complex numbers.
    - Never converts enormous integers to strings.
    - Sanitized error output.
    """
    clean_expr = expression.strip()
    if len(clean_expr) > MAX_INPUT_LENGTH:
        return {
            "success": False,
            "error_code": "INPUT_LENGTH_EXCEEDED",
            "error": f"Expression exceeds maximum length of {MAX_INPUT_LENGTH} characters.",
        }

    try:
        _check_parenthesis_depth(clean_expr)
    except CalculationError as ce:
        return {
            "success": False,
            "error_code": ce.error_code,
            "error": ce.message,
        }

    try:
        parsed = ast.parse(clean_expr, mode="eval")
    except SyntaxError:
        return {
            "success": False,
            "error_code": "SYNTAX_ERROR",
            "error": "Invalid mathematical expression syntax.",
        }

    try:
        _preflight_inspect(parsed.body)
    except CalculationError as ce:
        return {
            "success": False,
            "error_code": ce.error_code,
            "error": ce.message,
        }

    operation_count = 0

    def _eval_node(node):
        nonlocal operation_count
        operation_count += 1
        if operation_count > MAX_OPERATION_BUDGET:
            raise CalculationError("Computation budget exceeded.", error_code="OPERATION_BUDGET_EXCEEDED")

        if isinstance(node, ast.Constant):
            return node.value
        elif hasattr(ast, "Num") and isinstance(node, getattr(ast, "Num")):
            return getattr(node, "n")

        elif isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in SAFE_OPERATORS:
                raise CalculationError(f"Unsupported operator: {op_type.__name__}", error_code="UNSUPPORTED_OPERATOR")

            left = _eval_node(node.left)
            right = _eval_node(node.right)

            # Division safety
            if op_type in (ast.Div, ast.FloorDiv, ast.Mod):
                if right == 0:
                    raise CalculationError("Division by zero.", error_code="DIVISION_BY_ZERO")
                res = SAFE_OPERATORS[op_type](left, right)

            # Exponentiation preflight estimation before computing!
            elif op_type is ast.Pow:
                if abs(right) > MAX_EXPONENT:
                    raise CalculationError(
                        f"Exponent exceeds maximum limit of {MAX_EXPONENT}.",
                        error_code="EXPONENT_TOO_LARGE",
                    )
                if abs(left) > MAX_POWER_BASE and abs(right) > 10:
                    raise CalculationError(
                        "Estimated result size exceeds computation budget.",
                        error_code="RESULT_SIZE_EXCEEDED",
                    )
                if isinstance(left, int) and isinstance(right, int) and right > 0:
                    est_bits = right * left.bit_length()
                    if est_bits > MAX_RESULT_BITS:
                        raise CalculationError(
                            f"Result bit length ({est_bits}) exceeds maximum bound of {MAX_RESULT_BITS} bits.",
                            error_code="RESULT_SIZE_EXCEEDED",
                        )
                if left < 0 and not float(right).is_integer():
                    raise CalculationError(
                        "Complex numbers are not supported.",
                        error_code="COMPLEX_UNSUPPORTED",
                    )
                res = SAFE_OPERATORS[op_type](left, right)

            # Multiplication bit-size estimation
            elif op_type is ast.Mult:
                if isinstance(left, int) and isinstance(right, int):
                    if left.bit_length() + right.bit_length() > MAX_RESULT_BITS:
                        raise CalculationError(
                            "Multiplication result exceeds maximum computation bound.",
                            error_code="RESULT_SIZE_EXCEEDED",
                        )
                res = SAFE_OPERATORS[op_type](left, right)

            else:
                res = SAFE_OPERATORS[op_type](left, right)

            # Validate intermediate result
            if isinstance(res, (int, float)):
                if math.isinf(res) or math.isnan(res):
                    raise CalculationError("Calculation produced a non-finite result.", error_code="NON_FINITE_RESULT")
            if isinstance(res, int) and res.bit_length() > MAX_RESULT_BITS:
                raise CalculationError("Calculation result exceeds bit length bound.", error_code="RESULT_SIZE_EXCEEDED")
            return res

        elif isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type not in SAFE_OPERATORS:
                raise CalculationError("Unsupported unary operator.", error_code="UNSUPPORTED_OPERATOR")
            val = _eval_node(node.operand)
            return SAFE_OPERATORS[op_type](val)

        else:
            raise CalculationError("Unsupported syntax structure.", error_code="FORBIDDEN_SYNTAX")

    try:
        final_result = _eval_node(parsed.body)
        if isinstance(final_result, (int, float)):
            if math.isinf(final_result) or math.isnan(final_result):
                return {
                    "success": False,
                    "error_code": "NON_FINITE_RESULT",
                    "error": "Calculation produced a non-finite result.",
                }
        return {
            "success": True,
            "expression": clean_expr,
            "result": float(final_result) if isinstance(final_result, (int, float)) else final_result,
        }
    except CalculationError as ce:
        return {
            "success": False,
            "error_code": ce.error_code,
            "error": ce.message,
        }
    except Exception:
        # Never leak raw internal python exceptions to the caller
        return {
            "success": False,
            "error_code": "CALCULATION_FAILED",
            "error": "Arithmetic evaluation failed. Please check your expression.",
        }


def _redact_sensitive_info(text: str) -> str:
    """Sanitizes text by masking API keys and authorization tokens."""
    if not text:
        return text
    # Mask API key parameter in URLs: key=AIza... or key=AQ...
    text = re.sub(r"(key=)[A-Za-z0-9_.-]+", r"\1[REDACTED]", text)
    # Mask Bearer tokens
    text = re.sub(r"(Bearer\s+)[A-Za-z0-9_.-]+", r"\1[REDACTED]", text)
    return text


class PersonalAssistantService:
    """
    Dedicated Gemini-powered general Personal Assistant service.
    Enforces Shared Invariant 6: Public errors never contain raw internal exception details.
    """

    SYSTEM_PROMPT = (
        "You are Personal Assistant in CampusOS, powered by Google Gemini. "
        "You are a helpful, respectful academic companion assisting students with general explanations, "
        "engineering concepts, code explanations, writing suggestions, and everyday reasoning. "
        "Important boundaries: "
        "1. You do not have verified administrative access to private personal academic records (attendance, marks, transcripts). "
        "2. For official Thapar Institute notices, attendance shortage rules, exam debarment, and course regulations, "
        "you should clearly advise the student to refer to 'Campus Guide' (the source-grounded official campus guide). "
        "3. You do not execute database mutations or system actions. "
        "Keep your responses concise, structured, and easy to read."
    )

    def __init__(self):
        # Per-user sliding window rate limiting (single-process demo deployment)
        self._rate_limits: Dict[str, List[float]] = {}

    @staticmethod
    def get_api_key() -> str:
        key = (settings.gemini_api_key or "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
        if not key:
            try:
                from dotenv import load_dotenv
                for env_file in [
                    Path(__file__).resolve().parent.parent.parent / ".env",
                    Path(__file__).resolve().parent.parent.parent.parent / ".env",
                ]:
                    if env_file.exists():
                        load_dotenv(env_file, override=True)
                key = os.getenv("GEMINI_API_KEY", "").strip()
                if key:
                    settings.gemini_api_key = key
            except Exception:
                pass
        return key

    def _check_rate_limit(self, user_id: str, limit: int = 25, window: int = 60) -> bool:
        """
        Derives rate limit bucket from authenticated identity (claims['sub']).
        Single-process in-memory limiter with fail-closed safety.
        """
        if not user_id:
            return False
        now = time.time()
        timestamps = self._rate_limits.setdefault(user_id, [])
        # Prune old timestamps
        self._rate_limits[user_id] = [t for t in timestamps if now - t < window]
        if len(self._rate_limits[user_id]) >= limit:
            return False
        self._rate_limits[user_id].append(now)
        return True

    async def chat(
        self,
        user_id: str,
        messages: List[Dict[str, str]],
        stream: bool = False,
    ) -> Dict[str, Any]:
        """
        Processes conversation with Gemini API.
        Guarantees:
        - Never returns raw exceptions, API keys, internal paths, or provider stack traces.
        - Structured public error contract with request correlation ID.
        - Automatic fallback sequence across supported models.
        """
        correlation_id = f"req-{uuid.uuid4().hex[:12]}"

        if not self._check_rate_limit(user_id):
            return {
                "reply": "You are sending messages too quickly. Please wait a moment before trying again.",
                "status": "rate_limited",
                "error_code": "RATE_LIMIT_EXCEEDED",
                "correlation_id": correlation_id,
                "model": settings.gemini_model,
            }

        api_key = self.get_api_key()
        if not api_key:
            return {
                "reply": (
                    "Personal Assistant is ready, but GEMINI_API_KEY has not been configured in the backend environment. "
                    "Please set the GEMINI_API_KEY environment variable to enable live Gemini responses."
                ),
                "status": "unconfigured",
                "error_code": "SERVICE_UNCONFIGURED",
                "correlation_id": correlation_id,
                "model": settings.gemini_model,
            }

        # Validate message constraints
        if not messages:
            return {
                "reply": "Please enter a message.",
                "status": "bad_request",
                "error_code": "EMPTY_MESSAGE",
                "correlation_id": correlation_id,
            }

        latest_user_message = messages[-1].get("content", "").strip()
        if len(latest_user_message) > 2000:
            return {
                "reply": "Your message is too long (maximum 2,000 characters). Please shorten your request.",
                "status": "bad_request",
                "error_code": "MESSAGE_TOO_LONG",
                "correlation_id": correlation_id,
            }

        # Truncate context to last 10 turns
        recent_messages = messages[-10:]

        # Format conversation for Gemini generateContent API
        gemini_contents = []
        for m in recent_messages:
            role = "user" if m.get("role") == "user" else "model"
            gemini_contents.append({
                "role": role,
                "parts": [{"text": m.get("content", "").strip()}],
            })

        payload = {
            "contents": gemini_contents,
            "systemInstruction": {
                "parts": [{"text": self.SYSTEM_PROMPT}]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 1000,
            },
        }

        # Candidate models with automatic fallback on 404
        models_to_try = [settings.gemini_model]
        for fallback_model in ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]:
            if fallback_model not in models_to_try:
                models_to_try.append(fallback_model)

        last_error_status = 500
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for target_model in models_to_try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            reply_text = candidates[0]["content"]["parts"][0]["text"].strip()
                            # Cache the working model
                            settings.gemini_model = target_model
                            return {
                                "reply": reply_text,
                                "status": "success",
                                "model": target_model,
                                "correlation_id": correlation_id,
                            }
                        return {
                            "reply": "No response was generated by the model.",
                            "status": "empty_response",
                            "error_code": "EMPTY_MODEL_RESPONSE",
                            "correlation_id": correlation_id,
                        }
                    elif res.status_code == 404:
                        last_error_status = 404
                        continue
                    elif res.status_code == 429:
                        logger.warning("Gemini API quota exceeded for request %s", correlation_id)
                        return {
                            "reply": "Google Gemini API quota has been reached for this key. Please try again in a few moments.",
                            "status": "quota_exceeded",
                            "error_code": "UPSTREAM_QUOTA_EXCEEDED",
                            "correlation_id": correlation_id,
                        }
                    elif res.status_code in (400, 401, 403):
                        logger.error("Gemini API auth failed (%s) for request %s", res.status_code, correlation_id)
                        return {
                            "reply": "AI service authentication is temporarily misconfigured. Please contact support.",
                            "status": "auth_error",
                            "error_code": "UPSTREAM_AUTH_ERROR",
                            "correlation_id": correlation_id,
                        }
                    else:
                        last_error_status = res.status_code

                return {
                    "reply": "The AI service is temporarily unavailable. Please try again shortly.",
                    "status": "provider_error",
                    "error_code": "UPSTREAM_UNAVAILABLE",
                    "correlation_id": correlation_id,
                }
        except httpx.TimeoutException:
            logger.warning("Gemini API request timed out for %s", correlation_id)
            return {
                "reply": "The request to the AI service timed out. Please try asking again.",
                "status": "timeout",
                "error_code": "UPSTREAM_TIMEOUT",
                "correlation_id": correlation_id,
            }
        except Exception as e:
            # Strictly sanitize: never expose raw exception strings or API keys
            safe_log = _redact_sensitive_info(str(e))
            logger.error("Error connecting to Personal Assistant service (%s): %s", correlation_id, safe_log)
            return {
                "reply": "Personal Assistant service is temporarily unavailable. Please try again in a moment.",
                "status": "service_error",
                "error_code": "SERVICE_UNAVAILABLE",
                "correlation_id": correlation_id,
            }


personal_assistant_service = PersonalAssistantService()
