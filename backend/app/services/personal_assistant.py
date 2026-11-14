import os
import ast
import operator
import time
import httpx
from typing import List, Dict, Any, Optional
from ..core.config import settings

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

def safe_calculate(expression: str) -> Dict[str, Any]:
    """
    Evaluates basic arithmetic expressions using Python AST.
    Strictly forbids functions, variables, loops, imports, eval, or code execution.
    """
    clean_expr = expression.strip()
    if len(clean_expr) > 200:
        return {"success": False, "error": "Expression exceeds maximum length of 200 characters."}

    def _eval_node(node):
        if isinstance(node, ast.Constant):  # Python 3.8+ numbers/constants
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError("Only numeric constants are supported.")
        elif hasattr(ast, "Num") and isinstance(node, getattr(ast, "Num")):  # Legacy fallback
            return getattr(node, "n")
        elif isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in SAFE_OPERATORS:
                raise ValueError(f"Unsupported operator: {op_type.__name__}")
            left = _eval_node(node.left)
            right = _eval_node(node.right)
            if op_type is ast.Pow and right > 1000:
                raise ValueError("Exponent too large.")
            if op_type in (ast.Div, ast.FloorDiv, ast.Mod) and right == 0:
                raise ValueError("Division by zero.")
            return SAFE_OPERATORS[op_type](left, right)
        elif isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type not in SAFE_OPERATORS:
                raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
            return SAFE_OPERATORS[op_type](_eval_node(node.operand))
        else:
            raise ValueError(f"Unsafe or unsupported expression syntax: {type(node).__name__}")

    try:
        parsed = ast.parse(clean_expr, mode="eval")
        result = _eval_node(parsed.body)
        return {"success": True, "expression": clean_expr, "result": result}
    except Exception as e:
        return {"success": False, "expression": clean_expr, "error": str(e)}


class PersonalAssistantService:
    """
    Dedicated Gemini-powered general Personal Assistant service.
    Completely separate from Campus Guide.
    Provides helpful study assistance, conceptual explanations, reasoning, and safe calculations.
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
        # Per-user sliding window rate limiting
        self._rate_limits: Dict[str, List[float]] = {}

    def _check_rate_limit(self, user_id: str, limit: int = 25, window: int = 60) -> bool:
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
        """
        if not self._check_rate_limit(user_id):
            return {
                "reply": "You are sending messages too quickly. Please wait a moment before trying again.",
                "status": "rate_limited",
                "model": settings.gemini_model,
            }

        api_key = settings.gemini_api_key.strip()
        if not api_key:
            return {
                "reply": (
                    "Personal Assistant is ready, but GEMINI_API_KEY has not been configured in the backend environment. "
                    "Please set the GEMINI_API_KEY environment variable to enable live Gemini responses."
                ),
                "status": "unconfigured",
                "model": settings.gemini_model,
            }

        # Validate message constraints
        if not messages:
            return {"reply": "Please enter a message.", "status": "error"}

        latest_user_message = messages[-1].get("content", "").strip()
        if len(latest_user_message) > 2000:
            return {
                "reply": "Your message is too long (maximum 2,000 characters). Please shorten your request.",
                "status": "bad_request",
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

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={api_key}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        reply_text = candidates[0]["content"]["parts"][0]["text"].strip()
                        return {
                            "reply": reply_text,
                            "status": "success",
                            "model": settings.gemini_model,
                        }
                    return {
                        "reply": "No response was generated by the model.",
                        "status": "empty_response",
                    }
                elif res.status_code == 429:
                    return {
                        "reply": "Google Gemini API quota has been reached for this key. Please try again in a few moments.",
                        "status": "quota_exceeded",
                    }
                elif res.status_code in (400, 401, 403):
                    return {
                        "reply": f"Gemini API authentication failed ({res.status_code}). Please verify GEMINI_API_KEY.",
                        "status": "auth_error",
                    }
                else:
                    return {
                        "reply": f"Gemini API returned status {res.status_code}. Please try again shortly.",
                        "status": "provider_error",
                    }
        except httpx.TimeoutException:
            return {
                "reply": "The request to Google Gemini timed out (15s limit). Please try asking again.",
                "status": "timeout",
            }
        except Exception as e:
            return {
                "reply": f"Error connecting to Personal Assistant service: {str(e)}",
                "status": "network_error",
            }


personal_assistant_service = PersonalAssistantService()
