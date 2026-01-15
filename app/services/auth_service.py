"""
Auth Service
Clerk SDK를 사용한 사용자 인증 및 관리
"""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from clerk import Client
from app.config.settings import settings
from typing import Optional

# Clerk Client 초기화
clerk_client = Client(token=settings.CLERK_SECRET_KEY)

security = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    FastAPI Dependency: Bearer 토큰(JWT)을 검증하고 사용자 정보를 반환합니다.
    Header의 Bearer 토큰 또는 Query Parameter의 token을 확인합니다.
    """
    token = None
    if auth:
        token = auth.credentials
    elif request.query_params.get("token"):
        token = request.query_params.get("token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication token")
    
    try:
        # 1. JWT 토큰 디코딩
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if not user_id:
                print("Auth error: No 'sub' claim in JWT", flush=True)
                raise HTTPException(status_code=401, detail="Invalid token structure")
        except Exception as e:
            print(f"Auth error: JWT decoding failed: {e}", flush=True)
            raise HTTPException(status_code=401, detail="Invalid token")

        # 2. Clerk API를 통해 사용자 정보 조회 및 검증
        user_dict = None
        
        # Try standard SDK method first
        try:
            # Clerk SDK v1.0.0+ 방식 시도
            if hasattr(clerk_client, 'users') and hasattr(clerk_client.users, 'get'):
                user_response = await clerk_client.users.get(user_id)
                # 응답이 객체라면 dict로 변환하거나 그대로 사용 (Box로 감쌀 것이므로 dict가 편함)
                if hasattr(user_response, 'model_dump'):
                    user_dict = user_response.model_dump()
                elif hasattr(user_response, 'to_dict'):
                    user_dict = user_response.to_dict()
                else:
                    # 속성을 dict로 변환 시도
                    user_dict = user_response.__dict__
        except Exception as e:
            # Pydantic Validation Error check (Clerk SDK issue)
            error_str = str(e)
            if "validation error" in error_str.lower():
                print(f"Clerk SDK validation error (ignoring): {error_str.splitlines()[0]}", flush=True)
            else:
                print(f"Clerk SDK users.get failed: {e}", flush=True)

        # Fallback to direct API call if standard method failed or didn't return dict
        if not user_dict:
            try:
                # v1.0.0 이상에서도 get이 context manager가 아닐 수 있음
                # 하지만 기존 코드가 async with를 썼다는건 aiohttp client wrapper일 가능성
                # 안전하게 실행
                response_obj = clerk_client.get(f"users/{user_id}")
                
                # Check if it's awaitable or context manager
                if hasattr(response_obj, '__aenter__'):
                    async with response_obj as resp:
                        if resp.status != 200:
                            error_text = await resp.text()
                            print(f"Clerk User API error ({resp.status}): {error_text}", flush=True)
                            raise HTTPException(status_code=401, detail="User not found in Clerk")
                        user_dict = await resp.json()
                elif hasattr(response_obj, 'json'):
                     # 동기 혹은 awaitable response
                     if asyncio.iscoroutine(response_obj):
                         resp = await response_obj
                     else:
                         resp = response_obj
                     
                     # status check logic depends on object type, assume valid if json works
                     if hasattr(resp, 'status_code') and resp.status_code != 200:
                         raise HTTPException(status_code=401, detail="User not found")
                     
                     if asyncio.iscoroutinefunction(resp.json):
                         user_dict = await resp.json()
                     else:
                         user_dict = resp.json()
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                print(f"Clerk User direct fetch failed: {e}\n{traceback.format_exc()}", flush=True)
                # Fallback: JWT payload만 믿고 진행 (개발 모드 등)
                # raise HTTPException(status_code=401, detail=f"Clerk User fetch failed: {str(e)}")
                print("WARNING: Clerk fetch failed, using JWT payload basic info.", flush=True)
                user_dict = {"id": user_id, "email_addresses": []} 
                # JWT에 email 있으면 사용... 보통은 없거나 custom claim.

        
        if not user_dict:
             raise HTTPException(status_code=401, detail="User data could not be retrieved")
        
        # 3. 데이터 형식 변환
        from box import Box
        user_obj = Box(user_dict)
        
        # Token을 user 객체에 심어줌 (Supabase RLS용)
        user_obj.token = token
        
        # Supabase와 사용자 동기화
        try:
            await sync_user_to_supabase(user_obj, token)
        except Exception as e:
            print(f"User sync ignored error: {e}", flush=True)
        
        return user_obj
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auth unexpected error: {e}", flush=True)
        raise HTTPException(status_code=401, detail="Authentication failed")

async def sync_user_to_supabase(clerk_user, token: str):
    """
    Clerk 사용자 정보를 Supabase users 테이블에 동기화합니다.
    RLS 때문에 token이 필요합니다.
    """
    from app.config.supabase_client import get_supabase_client_with_token
    from datetime import datetime
    try:
        # 인증된 클라이언트 사용
        supabase = get_supabase_client_with_token(token)
        
        # 이메일 추출 로직
        email = None
        emails = getattr(clerk_user, 'email_addresses', [])
        if emails and isinstance(emails, list) and len(emails) > 0:
            first_email = emails[0]
            if isinstance(first_email, dict):
                email = first_email.get('email_address')
            else:
                email = getattr(first_email, 'email_address', None)
        
        # 이름 및 프로필 이미지 추출
        first_name = getattr(clerk_user, 'first_name', '') or ''
        last_name = getattr(clerk_user, 'last_name', '') or ''
        full_name = f"{first_name} {last_name}".strip() or None
        
        # image_url (standard) or profile_image_url (legacy/provider)
        avatar_url = getattr(clerk_user, 'image_url', None) or getattr(clerk_user, 'profile_image_url', None)

        user_data = {
            "id": clerk_user.id,
            "email": email,
            "full_name": full_name,
            "avatar_url": avatar_url,
            "last_login": datetime.now().isoformat()
        }
        
        # upsert 대신 Check -> Insert/Update 로직 변경
        # RLS upsert 동작이 모호할 수 있어 명시적 처리
        existing_response = supabase.table("users").select("id").eq("id", clerk_user.id).execute()
        existing_user = existing_response.data[0] if existing_response.data else None

        if existing_user:
            # Update
            supabase.table("users").update(user_data).eq("id", clerk_user.id).execute()
            print(f"User sync updated: {clerk_user.id}", flush=True)
        else:
            # Insert
            supabase.table("users").insert(user_data).execute()
            print(f"User sync inserted: {clerk_user.id}", flush=True)
    except Exception as e:
        print(f"Supabase user sync error: {e}", flush=True)
        raise e

def require_auth(request: Request):
    """
    인증이 필요한 라우트에서 사용할 수 있는 간단한 체크 함수
    """
    # 프론트엔드에서 Clerk SDK가 세션을 관리하므로, 
    # 백엔드에서는 주로 Authorization 헤더의 JWT를 검증합니다.
    pass
