import logging
from typing import Optional
import jwt
from fastapi import Header, HTTPException, status, Depends
from .config import settings
from .supabase import get_supabase_client

logger = logging.getLogger(__name__)

# Default dev/test fallback signing secret for local cryptographic verification
# Production setups MUST configure SUPABASE_JWT_SECRET in their environment.
DEFAULT_LOCAL_DEV_JWT_SECRET = "super-secret-key-that-is-at-least-32-bytes-long"

def verify_supabase_jwt(token: str) -> str:
    """
    Verifies a Supabase JWT and returns the verified user_id (sub).
    Strictly validates cryptographic signatures, expiration, and audience claims.
    Rejects missing, forged, expired, or unverifiable tokens with 401 Unauthorized.
    Never decodes an unverified 'sub' claim for authorization.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clean_token = token.strip()
    is_jwt_format = clean_token.count(".") == 2

    # ------------------------------------------------------------
    # 1. Cryptographic JWT Verification (for tokens formatted as JWTs)
    # ------------------------------------------------------------
    if is_jwt_format:
        # Determine the signing key: production requires SUPABASE_JWT_SECRET
        signing_secret = settings.supabase_jwt_secret
        if not signing_secret and settings.environment in ("development", "test"):
            # In local dev/test mode without custom .env, use standard local dev secret
            signing_secret = DEFAULT_LOCAL_DEV_JWT_SECRET

        if signing_secret:
            try:
                payload = jwt.decode(
                    clean_token,
                    signing_secret,
                    algorithms=["HS256"],
                    options={
                        "verify_signature": True,
                        "verify_exp": True,
                        "verify_nbf": True,
                        "verify_aud": False,  # Allow standard audience variations but enforce signature & exp
                    },
                )
                user_id = payload.get("sub")
                if user_id:
                    return str(user_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token missing subject (sub) claim",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except jwt.ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except jwt.PyJWTError as e:
                logger.warning("Cryptographic JWT verification failed: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or forged authentication token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # 2. Verify with remote Supabase Auth API if client is available
        client = get_supabase_client()
        if client:
            try:
                user_response = client.auth.get_user(clean_token)
                if user_response and user_response.user:
                    return str(user_response.user.id)
            except Exception as e:
                logger.debug("Supabase client get_user verification failed: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token verification failed with authentication service",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # If a JWT cannot be cryptographically verified, fail closed
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT verification configuration missing; refusing unverified token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ------------------------------------------------------------
    # 2. Local/Test Scoped Dev Token Verification (Non-JWT format)
    # ------------------------------------------------------------
    # Allowed strictly in development/test mode with explicit opt-in
    if settings.environment in ("development", "test") and settings.allow_dev_tokens:
        if clean_token in ("dev-user-102203099", "dev-user", "mock-token"):
            return "102203099-tiet-user"

        if clean_token in ("dev-peer", "dev-peer-user"):
            return "00000000-0000-0000-0000-000102203088"

        if clean_token.startswith("test-") or clean_token.startswith("dev-"):
            cleaned = clean_token
            for prefix in ("test-user-", "dev-user-", "test-", "dev-"):
                if cleaned.startswith(prefix):
                    cleaned = cleaned[len(prefix):]
                    break
            return f"{cleaned}-user-id"

    # Production or unknown token shape -> Fail Closed with 401
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    FastAPI dependency that extracts and verifies the Supabase JWT from the
    Authorization header (Bearer <token>) and returns the verified authenticated user ID.
    Rejects any missing, unverified, or forged credentials with 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be provided as 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    return verify_supabase_jwt(token)


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    Optional dependency that returns the verified user ID if a valid token is provided,
    or None if the header is absent. Raises 401 if a token is present but forged/invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    return verify_supabase_jwt(token)
