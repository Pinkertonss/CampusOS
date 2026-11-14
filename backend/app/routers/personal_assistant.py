from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from ..core.auth import get_current_user_claims, get_optional_user_claims
from ..core.config import settings
from ..services.personal_assistant import personal_assistant_service, safe_calculate

router = APIRouter(prefix="/api/assistant", tags=["Personal Assistant (Gemini)"])

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|model)$")
    content: str = Field(..., min_length=1, max_length=2000)

class ChatRequest(BaseModel):
    message: Optional[str] = None
    messages: Optional[List[ChatMessage]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None

class ChatResponse(BaseModel):
    reply: str
    status: str
    model: Optional[str] = None

class CalculateRequest(BaseModel):
    expression: str = Field(..., min_length=1, max_length=200)

class CalculateResponse(BaseModel):
    success: bool
    expression: str
    result: Optional[float] = None
    error: Optional[str] = None


@router.get("/status")
def get_assistant_status(claims: Optional[Dict[str, Any]] = Depends(get_optional_user_claims)):
    """
    Returns public capabilities of the Personal Assistant without leaking credentials.
    """
    has_key = bool(personal_assistant_service.get_api_key())
    return {
        "name": "Personal Assistant",
        "powered_by": "Google Gemini",
        "configured": has_key,
        "model": settings.gemini_model,
        "rate_limit_rpm": 30,
        "features": [
            "General conceptual explanations",
            "Study & code assistance",
            "Safe arithmetic calculations",
            "Writing & drafting guidance",
        ],
        "notice": "For verified campus regulations and personal records, consult Campus Guide.",
    }


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    payload: ChatRequest,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Chat with Personal Assistant powered by Google Gemini.
    """
    user_id = str(claims["sub"])
    if payload.messages:
        messages_dicts = [m.model_dump() for m in payload.messages]
    elif payload.message:
        messages_dicts = []
        if payload.conversation_history:
            for item in payload.conversation_history:
                messages_dicts.append({"role": item.get("role", "user"), "content": item.get("content", "")})
        messages_dicts.append({"role": "user", "content": payload.message})
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'message' or 'messages' must be provided in request.",
        )

    result = await personal_assistant_service.chat(user_id=user_id, messages=messages_dicts)
    if result.get("status") == "error" and "not configured" in result.get("reply", "").lower():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result["reply"],
        )
    return ChatResponse(**result)


@router.post("/calculate", response_model=CalculateResponse)
def calculate_expression(
    payload: CalculateRequest,
    claims: Dict[str, Any] = Depends(get_current_user_claims),
):
    """
    Safe restricted arithmetic calculation without eval or shell execution.
    """
    res = safe_calculate(payload.expression)
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("error", "Calculation failed or expression rejected."),
        )
    return CalculateResponse(**res)
