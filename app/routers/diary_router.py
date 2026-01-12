"""
Diary API Router
일기 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from app.models.schemas import (
    ChatRequest, ChatResponse, EndSessionRequest,
    DiaryEntry, DiaryListItem, GenerateImageRequest, SummaryResponse
)
from app.services.gemini_service import gemini_service
from app.services.diary_service import diary_service
from app.services.image_service import image_service

router = APIRouter(prefix="/api", tags=["diary"])


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "AI Diary API is running"}


@router.post("/session/start")
async def start_session():
    """Start a new diary session"""
    session_id = diary_service.generate_session_id()
    
    # Create diary entry
    diary_service.create_diary(session_id)
    
    # Get initial greeting from AI
    greeting = gemini_service.get_initial_greeting(session_id)
    
    # Save AI message
    diary_service.update_conversation(session_id, "model", greeting)
    
    return {
        "session_id": session_id,
        "message": greeting,
        "is_complete": False
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message in the diary conversation"""
    session_id = request.session_id
    user_message = request.message
    
    # Save user message
    diary_service.update_conversation(session_id, "user", user_message)
    
    # Get AI response
    response_text, is_complete = gemini_service.chat(session_id, user_message)
    
    # Save AI response
    diary_service.update_conversation(session_id, "model", response_text)
    
    return ChatResponse(
        session_id=session_id,
        message=response_text,
        is_complete=is_complete
    )


@router.post("/session/end")
async def end_session(request: EndSessionRequest):
    """End session and generate summary"""
    session_id = request.session_id
    
    # Generate summary
    summary_data = gemini_service.generate_summary(session_id)
    
    if summary_data:
        # Update diary with summary
        diary_service.update_summary(
            session_id,
            summary_data.get("summary", ""),
            summary_data.get("emotion_tags", []),
            summary_data.get("image_prompt", "")
        )
    
    # Clear AI session from memory
    gemini_service.clear_session(session_id)
    
    # Get updated diary
    diary = diary_service.get_diary(session_id)
    
    return {
        "session_id": session_id,
        "summary": summary_data,
        "diary": diary.model_dump(mode="json") if diary else None
    }


@router.post("/image/generate")
async def generate_image(request: GenerateImageRequest):
    """Generate image for diary entry"""
    session_id = request.session_id
    
    # Get diary to get image prompt
    diary = diary_service.get_diary(session_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    if not diary.image_prompt:
        raise HTTPException(status_code=400, detail="No image prompt available. End session first.")
    
    # Generate image
    image_path = await image_service.generate_image(
        diary.image_prompt,
        session_id,
        request.style
    )
    
    if image_path:
        diary_service.update_image_path(session_id, image_path)
        return {
            "success": True,
            "image_path": image_path,
            "message": "이미지가 생성되었습니다."
        }
    else:
        return {
            "success": False,
            "image_path": None,
            "message": image_service.get_placeholder_message()
        }




@router.get("/diaries", response_model=list[DiaryListItem])
async def list_diaries():
    """List all diary entries"""
    return diary_service.list_diaries()


@router.get("/diaries/{diary_id}")
async def get_diary(diary_id: str):
    """Get a specific diary entry"""
    diary = diary_service.get_diary(diary_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    return diary.model_dump(mode="json")


@router.get("/diaries/{diary_id}/image")
async def get_diary_image(diary_id: str):
    """Get the generated image for a diary"""
    diary = diary_service.get_diary(diary_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    if not diary.image_path:
        raise HTTPException(status_code=404, detail="No image for this diary")
    
    image_path = Path(diary.image_path)
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    
    return FileResponse(image_path, media_type="image/png")


@router.delete("/diaries/{diary_id}")
async def delete_diary(diary_id: str):
    """Delete a diary entry"""
    if diary_service.delete_diary(diary_id):
        return {"success": True, "message": "Diary deleted"}
    raise HTTPException(status_code=404, detail="Diary not found")
