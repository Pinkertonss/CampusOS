import logging
from typing import Optional
from supabase import create_client, Client
from .config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    """
    Returns an initialized Supabase client if URL and KEY are configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
        
    if settings.supabase_url and (settings.supabase_key or settings.supabase_service_role_key):
        key = settings.supabase_service_role_key or settings.supabase_key
        try:
            _supabase_client = create_client(settings.supabase_url, key)
            logger.info("Connected to Supabase at %s", settings.supabase_url)
            return _supabase_client
        except Exception as e:
            logger.warning("Could not initialize Supabase client: %s", e)
            return None
    return None

# Convenience instance
supabase = get_supabase_client()
