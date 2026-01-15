"""
Diary Service
일기 데이터 저장 및 관리
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config.settings import settings
from app.models.schemas import DiaryEntry, DiaryListItem, ChatMessage


class DiaryService:
    """Service for managing diary entries"""
    
    def __init__(self):
        self.diaries_dir = settings.DIARIES_DIR
        try:
            from app.config.supabase_client import get_supabase
            self.supabase = get_supabase()
        except Exception as e:
            print(f"Supabase 클라이언트 초기화 실패 (로컬 모드로 동작): {e}")
            self.supabase = None
    
    def _get_diary_path(self, diary_id: str, user_id: str) -> Path:
        """사용자별로 격리된 디렉토리에 일기 파일 경로를 반환합니다."""
        user_dir = self.diaries_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir / f"{diary_id}.json"
    
    def create_diary(self, session_id: str, user_id: str, date: Optional[datetime] = None, token: str = None) -> DiaryEntry:
        """Create a new diary entry for a specific user"""
        diary = DiaryEntry(
            id=session_id,
            created_at=date or datetime.now(),
            conversation=[],
        )
        
        # Supabase에 먼저 저장 시도
        if self.supabase:
            try:
                # Token이 있으면 인증된 클라이언트 사용 (RLS 준수)
                client = self.supabase
                if token:
                    from app.config.supabase_client import get_supabase_client_with_token
                    client = get_supabase_client_with_token(token)

                record = diary.model_dump(mode="json")
                record['user_id'] = user_id # 사용자 ID 할당
                from migrate_to_supabase import parse_diary_date
                record['diary_date'] = parse_diary_date(diary.id, record['created_at'])
                client.table("diaries").upsert(record).execute()
            except Exception as e:
                print(f"Supabase 저장 실패: {e}")
        
        self.save_diary(diary, user_id, token)
        return diary
    
    def get_diary(self, diary_id: str, user_id: str, token: str = None) -> Optional[DiaryEntry]:
        """Get a diary entry by ID and User ID"""
        # 먼저 Supabase에서 확인 (동기화 보장)
        if self.supabase:
            try:
                client = self.supabase
                if token:
                    from app.config.supabase_client import get_supabase_client_with_token
                    client = get_supabase_client_with_token(token)

                response = client.table("diaries") \
                    .select("*") \
                    .eq("id", diary_id) \
                    .eq("user_id", user_id) \
                    .execute()
                if response.data:
                    return DiaryEntry(**response.data[0])
            except Exception as e:
                print(f"Supabase get_diary 실패: {e}")

        # 로컬에서 확인
        path = self._get_diary_path(diary_id, user_id)
        if not path.exists():
            return None
        
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DiaryEntry(**data)
    
    def save_diary(self, diary: DiaryEntry, user_id: str, token: str = None):
        """Save a diary entry to user-specific location and Supabase"""
        # 1. 로컬 저장 (사용자별 격리)
        path = self._get_diary_path(diary.id, user_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(diary.model_dump(mode="json"), f, ensure_ascii=False, indent=2, default=str)
        
        # 2. Supabase 저장
        if self.supabase:
            try:
                client = self.supabase
                if token:
                    from app.config.supabase_client import get_supabase_client_with_token
                    client = get_supabase_client_with_token(token)

                record = diary.model_dump(mode="json")
                record['user_id'] = user_id
                from migrate_to_supabase import parse_diary_date
                record['diary_date'] = parse_diary_date(diary.id, record['created_at'])
                client.table("diaries").upsert(record).execute()
            except Exception as e:
                print(f"Supabase 저장 실패: {e}")
    
    def update_conversation(self, diary_id: str, user_id: str, role: str, content: str, timestamp: Optional[datetime] = None, token: str = None):
        """Add a message to user specific diary conversation"""
        diary = self.get_diary(diary_id, user_id, token)
        if not diary:
            diary = self.create_diary(diary_id, user_id, date=timestamp, token=token)
        
        diary.conversation.append(ChatMessage(
            role=role,
            content=content,
            timestamp=timestamp or datetime.now()
        ) )
        self.save_diary(diary, user_id, token)
        return diary
    
    def update_summary(self, diary_id: str, user_id: str, summary: str, emotion_tags: list[str], image_prompt: str, token: str = None):
        """Update user specific diary with summary and tags"""
        diary = self.get_diary(diary_id, user_id, token)
        if not diary:
            return None
        
        diary.summary = summary
        diary.emotion_tags = emotion_tags
        diary.image_prompt = image_prompt
        self.save_diary(diary, user_id, token)
        return diary
    
    def add_image_path(self, diary_id: str, user_id: str, image_path: str, token: str = None):
        """Add new image path to user's diary"""
        diary = self.get_diary(diary_id, user_id, token)
        if not diary:
            return None
        
        diary.image_paths.append(image_path)
        diary.selected_image_index = len(diary.image_paths) - 1
        self.save_diary(diary, user_id, token)
        return diary
    
    def select_image(self, diary_id: str, user_id: str, image_index: int, token: str = None):
        """Select image in user's diary gallery"""
        diary = self.get_diary(diary_id, user_id, token)
        if not diary:
            return None
        
        if 0 <= image_index < len(diary.image_paths):
            diary.selected_image_index = image_index
            self.save_diary(diary, user_id, token)
        return diary
    
    def update_bgm_path(self, diary_id: str, user_id: str, bgm_path: str, token: str = None):
        """Update user's diary with BGM path"""
        diary = self.get_diary(diary_id, user_id, token)
        if not diary:
            return None
        
        diary.bgm_path = bgm_path
        self.save_diary(diary, user_id, token)
        return diary
    
    
    def list_diaries(self, user_id: str, token: str = None) -> list[DiaryListItem]:
        """List current user's diary entries"""
        # 1. Supabase에서 조회 시도 (user_id 필터 적용)
        if self.supabase:
            try:
                client = self.supabase
                if token:
                    from app.config.supabase_client import get_supabase_client_with_token
                    client = get_supabase_client_with_token(token)

                response = client.table("diaries") \
                    .select("id, created_at, summary, emotion_tags, image_paths, image_path, bgm_path") \
                    .eq("user_id", user_id) \
                    .not_.is_("summary", "null") \
                    .order("created_at", desc=True) \
                    .execute()
                
                if response.data:
                    return [DiaryListItem(
                        id=row["id"],
                        created_at=row["created_at"],
                        summary=row["summary"],
                        emotion_tags=row.get("emotion_tags", []),
                        has_image=bool(row.get("image_paths") or row.get("image_path")),
                        has_bgm=bool(row.get("bgm_path"))
                    ) for row in response.data]
            except Exception as e:
                print(f"Supabase 조회 실패 (로컬로 전환): {e}")

        # 2. 로컬 파일에서 조회 (사용자별 디렉토리)
        diaries = []
        user_dir = self.diaries_dir / user_id
        if user_dir.exists():
            for path in sorted(user_dir.glob("*.json"), reverse=True):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    if not data.get("summary"):
                        continue
                        
                    diaries.append(DiaryListItem(
                        id=data["id"],
                        created_at=data["created_at"],
                        summary=data.get("summary"),
                        emotion_tags=data.get("emotion_tags", []),
                        has_image=bool(data.get("image_paths") or data.get("image_path")),
                        has_bgm=bool(data.get("bgm_path"))
                    ))
                except Exception:
                    continue
        return diaries
    
    def delete_diary(self, diary_id: str, user_id: str, token: str = None) -> bool:
        """Delete current user's diary entry"""
        # 1. 로컬 삭제
        path = self._get_diary_path(diary_id, user_id)
        local_deleted = False
        if path.exists():
            path.unlink()
            local_deleted = True
        
        # 2. Supabase 삭제 (user_id 보장)
        if self.supabase:
            try:
                client = self.supabase
                if token:
                    from app.config.supabase_client import get_supabase_client_with_token
                    client = get_supabase_client_with_token(token)

                client.table("diaries") \
                    .delete() \
                    .eq("id", diary_id) \
                    .eq("user_id", user_id) \
                    .execute()
            except Exception as e:
                print(f"Supabase 삭제 실패: {e}")
        
        return local_deleted
    
    def count_diaries_by_date(self, user_id: str, date_str: str) -> int:
        """특정 사용자의 날짜별 일기 개수 카운트"""
        user_dir = self.diaries_dir / user_id
        if not user_dir.exists():
            return 0
            
        prefix = f"diary_{date_str}"
        count = 0
        for path in user_dir.glob(f"{prefix}_*.json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("summary"):
                    count += 1
            except Exception:
                continue
        return count

    def count_today_diaries(self, user_id: str) -> int:
        """오늘 작성된 사용자의 일기 개수 반환"""
        return self.count_diaries_by_date(user_id, datetime.now().strftime('%Y%m%d'))

    def generate_session_id(self, date_str: Optional[str] = None) -> str:
        """Generate a new unique session ID (optional custom date)"""
        d_str = date_str or datetime.now().strftime('%Y%m%d')
        return f"diary_{d_str}_{datetime.now().strftime('%H%M%S')}_{uuid.uuid4().hex[:6]}"


# Global service instance
diary_service = DiaryService()
