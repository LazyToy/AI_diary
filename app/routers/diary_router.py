"""
Diary API Router
일기 관련 API 엔드포인트
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
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

from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api", tags=["diary"])


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "AI Diary API is running"}


@router.post("/session/start")
async def start_session(request: Optional[StartSessionRequest] = None, user: dict = Depends(get_current_user)):
    """Start a new diary session for authenticated user"""
    import traceback
    try:
        user_id = user.id
        token = getattr(user, 'token', None)
        
        custom_date = None
        date_str = datetime.now().strftime('%Y%m%d')
        
        if request and request.date:
            try:
                custom_date = datetime.fromisoformat(request.date)
                date_str = custom_date.strftime('%Y%m%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="유효하지 않은 날짜 형식입니다. (YYYY-MM-DD)")

        # Check diary count for the specific date and user
        if diary_service.count_diaries_by_date(user_id, date_str) >= 2:
            date_label = "오늘" if not custom_date or custom_date.date() == datetime.now().date() else f"{custom_date.strftime('%Y-%m-%d')}"
            raise HTTPException(status_code=400, detail=f"{date_label}에 작성 가능한 일기(2개)를 모두 작성했습니다.")
            
        session_id = diary_service.generate_session_id(date_str if request and request.date else None)
        
        # Create diary entry for this user
        print(f"[DEBUG] Creating diary: session_id={session_id}, user_id={user_id}", flush=True)
        diary_service.create_diary(session_id, user_id=user_id, date=custom_date, token=token)
        
        # Get initial greeting from AI
        print(f"[DEBUG] Getting initial greeting...", flush=True)
        greeting = gemini_service.get_initial_greeting(session_id, user_id)
        
        # Save AI message
        print(f"[DEBUG] Saving AI message...", flush=True)
        diary_service.update_conversation(session_id, user_id, "model", greeting, timestamp=custom_date, token=token)
        
        return {
            "session_id": session_id,
            "message": greeting,
            "is_complete": False
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] start_session failed: {e}", flush=True)
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}", flush=True)
        raise HTTPException(status_code=500, detail=f"세션 생성 실패: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    """Send a message in the diary conversation"""
    session_id = request.session_id
    user_id = user.id
    token = getattr(user, 'token', None)
    user_message = request.message
    
    # Save user message
    diary_service.update_conversation(session_id, user_id, "user", user_message, token=token)
    
    # Get AI response
    response_text, is_complete = gemini_service.chat(session_id, user_message, user_id)
    
    # Save AI response
    diary_service.update_conversation(session_id, user_id, "model", response_text, token=token)
    
    return ChatResponse(
        session_id=session_id,
        message=response_text,
        is_complete=is_complete
    )


@router.post("/session/end")
async def end_session(request: EndSessionRequest, user: dict = Depends(get_current_user)):
    """End session and generate summary"""
    session_id = request.session_id
    user_id = user.id
    token = getattr(user, 'token', None)
    
    # Generate summary
    summary_data = gemini_service.generate_summary(session_id)
    
    if summary_data:
        # Update diary with summary
        diary_service.update_summary(
            session_id,
            user_id,
            summary_data.get("summary", ""),
            summary_data.get("emotion_tags", []),
            summary_data.get("image_prompt", ""),
            token=token
        )
        
        # Save bgm_prompt if available
        diary = diary_service.get_diary(session_id, user_id, token=token)
        if diary and summary_data.get("bgm_prompt"):
            diary.bgm_prompt = summary_data.get("bgm_prompt")
            diary_service.save_diary(diary, user_id, token=token)
    
    # Get updated diary
    diary = diary_service.get_diary(session_id, user_id, token=token)
    
    return {
        "session_id": session_id,
        "summary": summary_data,
        "diary": diary.model_dump(mode="json") if diary else None
    }


@router.post("/summary/update")
async def update_summary(request: UpdateSummaryRequest, user: dict = Depends(get_current_user)):
    """요약 수정 및 감정 태그 재생성"""
    session_id = request.session_id
    user_id = user.id
    token = getattr(user, 'token', None)
    new_summary = request.summary
    
    # 일기 확인
    diary = diary_service.get_diary(session_id, user_id, token=token)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    # AI로 감정 태그 및 프롬프트 재생성
    regenerated = gemini_service.regenerate_tags(new_summary)
    
    # 일기 업데이트
    diary.summary = new_summary
    diary.emotion_tags = regenerated.get("emotion_tags", [])
    diary.image_prompt = regenerated.get("image_prompt", diary.image_prompt)
    diary.bgm_prompt = regenerated.get("bgm_prompt", diary.bgm_prompt)
    diary_service.save_diary(diary, user_id, token=token)
    
    return {
        "success": True,
        "summary": new_summary,
        "emotion_tags": diary.emotion_tags,
        "image_prompt": diary.image_prompt,
        "bgm_prompt": diary.bgm_prompt,
        "message": "요약이 수정되고 태그가 재생성되었습니다."
    }


@router.post("/image/generate")
async def generate_image(request: GenerateImageRequest, user: dict = Depends(get_current_user)):
    """Generate image for diary entry"""
    session_id = request.session_id
    user_id = user.id
    token = getattr(user, 'token', None)
    
    # Get diary to get image prompt
    diary = diary_service.get_diary(session_id, user_id, token=token)
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
        diary = diary_service.add_image_path(session_id, user_id, image_path, token=token)
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
async def select_image(diary_id: str, image_index: int, user: dict = Depends(get_current_user)):
    """이미지 갤러리에서 대표 이미지 선택"""
    user_id = user.id
    token = getattr(user, 'token', None)
    diary = diary_service.select_image(diary_id, user_id, image_index, token=token)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    return {
        "success": True,
        "selected_image_index": diary.selected_image_index,
        "message": f"이미지 {image_index + 1}번이 선택되었습니다."
    }


@router.get("/diaries", response_model=list[DiaryListItem])
async def list_diaries(
    keyword: Optional[str] = None,
    tag: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """
    List user's diary entries with optional search and filter
    """
    token = getattr(user, 'token', None)
    diaries = diary_service.list_diaries(user.id, token=token)
    
    # 키워드 검색
    if keyword:
        keyword_lower = keyword.lower()
        diaries = [d for d in diaries if d.summary and keyword_lower in d.summary.lower()]
    
    # 태그 필터링
    if tag:
        diaries = [d for d in diaries if tag in d.emotion_tags]
    
    return diaries


@router.get("/diaries/{diary_id}")
async def get_diary(diary_id: str, user: dict = Depends(get_current_user)):
    """Get a specific diary entry for current user"""
    token = getattr(user, 'token', None)
    diary = diary_service.get_diary(diary_id, user.id, token=token)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    return diary.model_dump(mode="json")


@router.get("/diaries/{diary_id}/image")
async def get_diary_image(diary_id: str, index: int = None, user: dict = Depends(get_current_user)):
    """Get the generated image for a diary"""
    token = getattr(user, 'token', None)
    diary = diary_service.get_diary(diary_id, user.id, token=token)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
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
async def delete_diary(diary_id: str, user: dict = Depends(get_current_user)):
    """Delete current user's diary entry"""
    token = getattr(user, 'token', None)
    if diary_service.delete_diary(diary_id, user.id, token=token):
        return {"success": True, "message": "Diary deleted"}
    raise HTTPException(status_code=404, detail="Diary not found")


@router.post("/bgm/generate")
async def generate_bgm(request: GenerateBGMRequest, user: dict = Depends(get_current_user)):
    """Generate BGM for user's diary entry"""
    session_id = request.session_id
    user_id = user.id
    token = getattr(user, 'token', None)
    
    # Get diary
    diary = diary_service.get_diary(session_id, user_id, token=token)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    # Generate BGM
    bgm_path = await music_service.generate_bgm(
        session_id,
        emotion_tags=diary.emotion_tags,
        bgm_prompt=diary.bgm_prompt or ""
    )
    
    if bgm_path:
        diary_service.update_bgm_path(session_id, user_id, bgm_path, token=token)
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
async def get_diary_bgm(diary_id: str, user: dict = Depends(get_current_user)):
    """Get the generated BGM for a user's diary"""
    token = getattr(user, 'token', None)
    diary = diary_service.get_diary(diary_id, user.id, token=token)
    if not diary:
        raise HTTPException(status_code=404, detail="Diary not found")
    
    if not diary.bgm_path:
        raise HTTPException(status_code=404, detail="No BGM for this diary")
    
    bgm_path = Path(diary.bgm_path)
    if not bgm_path.exists():
        raise HTTPException(status_code=404, detail="BGM file not found")
    
    return FileResponse(bgm_path, media_type="audio/wav")

