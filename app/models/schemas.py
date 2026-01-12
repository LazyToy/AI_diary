"""
Pydantic Schemas for AI Diary Application
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.now)


class ChatRequest(BaseModel):
    """Request for chat endpoint"""
    session_id: str = Field(..., description="Session identifier")
    message: str = Field(..., description="User message")


class ChatResponse(BaseModel):
    """Response from chat endpoint"""
    session_id: str
    message: str
    is_complete: bool = Field(default=False, description="Whether diary session is complete")


class EndSessionRequest(BaseModel):
    """Request to end diary session"""
    session_id: str


class DiaryEntry(BaseModel):
    """Complete diary entry"""
    id: str
    created_at: datetime = Field(default_factory=datetime.now)
    conversation: list[ChatMessage] = Field(default_factory=list)
    summary: Optional[str] = None
    emotion_tags: list[str] = Field(default_factory=list)
    image_prompt: Optional[str] = None
    image_path: Optional[str] = None
    style: str = Field(default="watercolor", description="Image style preference")


class DiaryListItem(BaseModel):
    """Diary list item for listing endpoint"""
    id: str
    created_at: datetime
    summary: Optional[str] = None
    emotion_tags: list[str] = Field(default_factory=list)
    has_image: bool = False


class GenerateImageRequest(BaseModel):
    """Request to generate image"""
    session_id: str
    style: str = Field(default="watercolor", description="수채화, 픽셀아트, 실사 등")


class SummaryResponse(BaseModel):
    """Summary generation response"""
    summary: str
    emotion_tags: list[str]
    image_prompt: str
