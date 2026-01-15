"""
Supabase Client Configuration
Supabase 데이터베이스 연결을 위한 클라이언트를 설정합니다.
Clerk JWT 토큰을 사용하여 RLS(Row Level Security) 정책과 연동합니다.
"""

from supabase import create_client, Client
from app.config.settings import settings
from typing import Optional


def get_supabase_client() -> Client:
    """
    기본 Supabase 클라이언트 인스턴스를 반환합니다.
    anon key를 사용하며, RLS 정책이 적용됩니다.
    
    Returns:
        Client: Supabase 클라이언트
        
    Raises:
        ValueError: SUPABASE_URL 또는 SUPABASE_ANON_KEY가 설정되지 않은 경우
    """
    if not settings.SUPABASE_URL:
        raise ValueError(
            "SUPABASE_URL이 설정되지 않았습니다. "
            "app/config/settings.py에서 설정해주세요."
        )
    
    if not settings.SUPABASE_ANON_KEY:
        raise ValueError(
            "SUPABASE_ANON_KEY가 설정되지 않았습니다. "
            "app/config/settings.py에서 설정해주세요."
        )
    
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def get_supabase_client_with_token(access_token: str) -> Client:
    """
    Clerk JWT 토큰을 사용하는 Supabase 클라이언트를 반환합니다.
    이 클라이언트는 RLS 정책에서 auth.jwt()->>'sub'를 통해 사용자를 식별할 수 있습니다.
    
    Args:
        access_token: Clerk에서 발급된 JWT 토큰
        
    Returns:
        Client: 인증된 Supabase 클라이언트
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_URL 또는 SUPABASE_ANON_KEY가 설정되지 않았습니다.")
    
    # Supabase 클라이언트 생성 시 Authorization 헤더에 토큰 설정
    # Supabase 클라이언트 생성 시 Authorization 헤더에 토큰 설정
    # Supabase 클라이언트 생성 시 Authorization 헤더에 토큰 설정
    from supabase.lib.client_options import ClientOptions
    
    # 기본 옵션 인스턴스 생성 (storage 등 기본값 보장)
    options = ClientOptions()
    
    # 헤더 업데이트 (기본 헤더 유지하면서 Auth 추가)
    if options.headers is None:
        options.headers = {}
    options.headers["Authorization"] = f"Bearer {access_token}"
    
    client = create_client(
        settings.SUPABASE_URL, 
        settings.SUPABASE_ANON_KEY,
        options=options
    )
    return client


# 싱글톤 패턴으로 기본 클라이언트 인스턴스 관리
_supabase_client: Client | None = None


def get_supabase() -> Client:
    """
    기본 Supabase 클라이언트 싱글톤 인스턴스를 반환합니다.
    처음 호출 시 클라이언트를 생성하고, 이후에는 동일한 인스턴스를 반환합니다.
    
    Note:
        이 클라이언트는 anon key를 사용합니다.
        RLS 정책이 적용된 테이블에서 사용자별 데이터를 조회하려면
        백엔드 코드에서 user_id 필터를 직접 적용해야 합니다.
    
    Returns:
        Client: Supabase 클라이언트 인스턴스
    """
    global _supabase_client
    
    if _supabase_client is None:
        _supabase_client = get_supabase_client()
    
    return _supabase_client


# 사용 예시:
# from app.config.supabase_client import get_supabase, get_supabase_client_with_token
#
# # 기본 클라이언트 (anon key 사용, RLS 적용)
# supabase = get_supabase()
#
# # Clerk 토큰을 사용한 인증된 클라이언트 (RLS에서 사용자 자동 식별)
# supabase_auth = get_supabase_client_with_token(clerk_jwt_token)
#
# # 데이터 조회
# response = supabase.table("diaries").select("*").execute()
#
# # 데이터 삽입
# response = supabase.table("diaries").insert({"title": "My Diary"}).execute()
#
# # 데이터 업데이트
# response = supabase.table("diaries").update({"title": "Updated"}).eq("id", 1).execute()
#
# # 데이터 삭제
# response = supabase.table("diaries").delete().eq("id", 1).execute()
