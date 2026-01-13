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
    
    def _get_diary_path(self, diary_id: str) -> Path:
        """Get file path for a diary entry"""
        return self.diaries_dir / f"{diary_id}.json"
    
    def create_diary(self, session_id: str, date: Optional[datetime] = None) -> DiaryEntry:
        """Create a new diary entry"""
        diary = DiaryEntry(
            id=session_id,
            created_at=date or datetime.now(),
            conversation=[],
        )
        self.save_diary(diary)
        return diary
    
    def get_diary(self, diary_id: str) -> Optional[DiaryEntry]:
        """Get a diary entry by ID"""
        path = self._get_diary_path(diary_id)
        if not path.exists():
            return None
        
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DiaryEntry(**data)
    
    def save_diary(self, diary: DiaryEntry):
        """Save a diary entry to file"""
        path = self._get_diary_path(diary.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(diary.model_dump(mode="json"), f, ensure_ascii=False, indent=2, default=str)
    
    def update_conversation(self, diary_id: str, role: str, content: str, timestamp: Optional[datetime] = None):
        """Add a message to diary conversation"""
        diary = self.get_diary(diary_id)
        if not diary:
            diary = self.create_diary(diary_id, date=timestamp)
        
        diary.conversation.append(ChatMessage(
            role=role,
            content=content,
            timestamp=timestamp or datetime.now()
        ) )
        self.save_diary(diary)
        return diary
    
    def update_summary(self, diary_id: str, summary: str, emotion_tags: list[str], image_prompt: str):
        """Update diary with summary and tags"""
        diary = self.get_diary(diary_id)
        if not diary:
            return None
        
        diary.summary = summary
        diary.emotion_tags = emotion_tags
        diary.image_prompt = image_prompt
        self.save_diary(diary)
        return diary
    
    def update_image_path(self, diary_id: str, image_path: str):
        """Update diary with generated image path"""
        diary = self.get_diary(diary_id)
        if not diary:
            return None
        
        diary.image_path = image_path
        self.save_diary(diary)
        return diary
    
    def add_image_path(self, diary_id: str, image_path: str):
        """Add new image path to diary's image list"""
        diary = self.get_diary(diary_id)
        if not diary:
            return None
        
        diary.image_paths.append(image_path)
        diary.selected_image_index = len(diary.image_paths) - 1  # 새 이미지를 선택
        self.save_diary(diary)
        return diary
    
    def select_image(self, diary_id: str, image_index: int):
        """Select an image from the gallery"""
        diary = self.get_diary(diary_id)
        if not diary:
            return None
        
        if 0 <= image_index < len(diary.image_paths):
            diary.selected_image_index = image_index
            self.save_diary(diary)
        return diary
    
    def update_bgm_path(self, diary_id: str, bgm_path: str):
        """Update diary with generated BGM path"""
        diary = self.get_diary(diary_id)
        if not diary:
            return None
        
        diary.bgm_path = bgm_path
        self.save_diary(diary)
        return diary
    
    
    def list_diaries(self) -> list[DiaryListItem]:
        """List all diary entries"""
        diaries = []
        for path in sorted(self.diaries_dir.glob("*.json"), reverse=True):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
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
    
    def delete_diary(self, diary_id: str) -> bool:
        """Delete a diary entry"""
        path = self._get_diary_path(diary_id)
        if path.exists():
            path.unlink()
            return True
        return False
    
    def count_diaries_by_date(self, date_str: str) -> int:
        """특정 날짜(YYYYMMDD)에 작성된 일기 개수를 반환"""
        prefix = f"diary_{date_str}"
        count = 0
        for path in self.diaries_dir.glob(f"{prefix}_*.json"):
            count += 1
        return count

    def count_today_diaries(self) -> int:
        """오늘 작성된 일기 개수를 반환"""
        return self.count_diaries_by_date(datetime.now().strftime('%Y%m%d'))

    def generate_session_id(self, date_str: Optional[str] = None) -> str:
        """Generate a new unique session ID (optional custom date)"""
        d_str = date_str or datetime.now().strftime('%Y%m%d')
        return f"diary_{d_str}_{datetime.now().strftime('%H%M%S')}_{uuid.uuid4().hex[:6]}"


# Global service instance
diary_service = DiaryService()
