"""
Diary API Router
일기 관련 API 엔드포인트
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Optional, List
from app.models.schemas import (
    ChatRequest, ChatResponse, EndSessionRequest,
    DiaryEntry, DiaryListItem, GenerateImageRequest, GenerateBGMRequest, 
    SummaryResponse, UpdateSummaryRequest, StartSessionRequest
)
from app.services.gemini_service import gemini_service
from app.services.diary_service import diary_service
from app.services.image_service import image_service
from app.services.music_service import music_service

router = APIRouter(prefix="/api", tags=["diary"])


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "AI Diary API is running"}


@router.post("/session/start")
async def start_session(request: Optional[StartSessionRequest] = None):
    """Start a new diary session"""
    custom_date = None
    date_str = datetime.now().strftime('%Y%m%d')
    
    if request and request.date:
        try:
            custom_date = datetime.fromisoformat(request.date)
            date_str = custom_date.strftime('%Y%m%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="유효하지 않은 날짜 형식입니다. (YYYY-MM-DD)")

    # Check diary count for the specific date
    if diary_service.count_diaries_by_date(date_str) >= 2:
        date_label = "오늘" if not custom_date or custom_date.date() == datetime.now().date() else f"{custom_date.strftime('%Y-%m-%d')}"
        raise HTTPException(status_code=400, detail=f"{date_label}에 작성 가능한 일기(2개)를 모두 작성했습니다.")
        
    session_id = diary_service.generate_session_id(date_str if request and request.date else None)
    
    # Create diary entry (with custom date if provided)
    diary_service.create_diary(session_id, date=custom_date)
    
    # Get initial greeting from AI
    greeting = gemini_service.get_initial_greeting(session_id)
    
    # Save AI message
    diary_service.update_conversation(session_id, "model", greeting, timestamp=custom_date)
    
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
        
        # Save bgm_prompt if available
        diary = diary_service.get_diary(session_id)
        if diary and summary_data.get("bgm_prompt"):
            diary.bgm_prompt = summary_data.get("bgm_prompt")
            diary_service.save_diary(diary)
    
    # Clear AI session from memory (Removed to allow continued conversation after summary)
    # gemini_service.clear_session(session_id)
    
    # Get updated diary
    diary = diary_service.get_diary(session_id)
    
    return {
        "session_id": session_id,
        "summary": summary_data,
        "diary": diary.model_dump(mode="json") if diary else None
    }


@router.post("/summary/update")
async def update_summary(request: UpdateSummaryRequest):
    """요약 수정 및 감정 태그 재생성"""
    session_id = request.session_id
    new_summary = request.summary
    
    # 일기 확인
    diary = diary_service.get_diary(session_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    # AI로 감정 태그 및 프롬프트 재생성
    regenerated = gemini_service.regenerate_tags(new_summary)
    
    # 일기 업데이트
    diary.summary = new_summary
    diary.emotion_tags = regenerated.get("emotion_tags", [])
    diary.image_prompt = regenerated.get("image_prompt", diary.image_prompt)
    diary.bgm_prompt = regenerated.get("bgm_prompt", diary.bgm_prompt)
    diary_service.save_diary(diary)
    
    return {
        "success": True,
        "summary": new_summary,
        "emotion_tags": diary.emotion_tags,
        "image_prompt": diary.image_prompt,
        "bgm_prompt": diary.bgm_prompt,
        "message": "요약이 수정되고 태그가 재생성되었습니다."
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
        # 이미지를 리스트에 추가
        diary = diary_service.add_image_path(session_id, image_path)
        return {
            "success": True,
            "image_path": image_path,
            "image_paths": diary.image_paths,
            "selected_image_index": diary.selected_image_index,
            "message": "이미지가 생성되었습니다."
        }
    else:
        return {
            "success": False,
            "image_path": None,
            "message": image_service.get_placeholder_message()
        }


@router.post("/image/select/{diary_id}/{image_index}")
async def select_image(diary_id: str, image_index: int):
    """이미지 갤러리에서 대표 이미지 선택"""
    diary = diary_service.select_image(diary_id, image_index)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    return {
        "success": True,
        "selected_image_index": diary.selected_image_index,
        "message": f"이미지 {image_index + 1}번이 선택되었습니다."
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
async def get_diary_image(diary_id: str, index: int = None):
    """Get the generated image for a diary"""
    diary = diary_service.get_diary(diary_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    # 새 image_paths 리스트 지원 + 레거시 image_path 호환
    if diary.image_paths:
        img_index = index if index is not None else diary.selected_image_index
        if 0 <= img_index < len(diary.image_paths):
            image_path = Path(diary.image_paths[img_index])
        else:
            image_path = Path(diary.image_paths[0])
    elif hasattr(diary, 'image_path') and diary.image_path:
        image_path = Path(diary.image_path)
    else:
        raise HTTPException(status_code=404, detail="No image for this diary")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    
    return FileResponse(image_path, media_type="image/png")


@router.delete("/diaries/{diary_id}")
async def delete_diary(diary_id: str):
    """Delete a diary entry"""
    if diary_service.delete_diary(diary_id):
        return {"success": True, "message": "Diary deleted"}
    raise HTTPException(status_code=404, detail="Diary not found")


@router.post("/bgm/generate")
async def generate_bgm(request: GenerateBGMRequest):
    """Generate BGM for diary entry"""
    session_id = request.session_id
    
    # Get diary to get emotion tags and bgm prompt
    diary = diary_service.get_diary(session_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    # Generate BGM
    bgm_path = await music_service.generate_bgm(
        session_id,
        emotion_tags=diary.emotion_tags,
        bgm_prompt=diary.bgm_prompt or ""
    )
    
    if bgm_path:
        diary_service.update_bgm_path(session_id, bgm_path)
        return {
            "success": True,
            "bgm_path": bgm_path,
            "message": "BGM이 생성되었습니다."
        }
    else:
        return {
            "success": False,
            "bgm_path": None,
            "message": music_service.get_placeholder_message()
        }


@router.get("/diaries/{diary_id}/bgm")
async def get_diary_bgm(diary_id: str):
    """Get the generated BGM for a diary"""
    diary = diary_service.get_diary(diary_id)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    if not diary.bgm_path:
        raise HTTPException(status_code=404, detail="No BGM for this diary")
    
    bgm_path = Path(diary.bgm_path)
    if not bgm_path.exists():
        raise HTTPException(status_code=404, detail="BGM file not found")
    
    return FileResponse(bgm_path, media_type="audio/wav")

