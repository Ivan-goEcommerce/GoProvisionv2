"""Supabase client factories."""

from supabase import Client, create_client

from backend.core.config import settings


def get_service_supabase() -> Client:
    """Create a privileged Supabase client for backend jobs."""
    key = settings.supabase_service_role_key or settings.supabase_key_fallback
    return create_client(settings.supabase_url, key)
