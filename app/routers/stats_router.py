"""
Stats Router
통계 관련 API 엔드포인트
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Query, Depends
from typing import Optional
from collections import Counter
from app.services.diary_service import diary_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/emotions")
async def get_emotion_stats(
    period: str = Query("week", regex="^(week|month)$"),
    user: dict = Depends(get_current_user)
):
    """사용자별 감정 태그 통계 조회"""
    user_id = user.id
    now = datetime.now()
    if period == "week":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=30)
    
    # 해당 사용자의 일기 목록만 가져오기
    diaries = diary_service.list_diaries(user_id)
    
    tag_counter = Counter()
    diary_count = 0
    
    for diary in diaries:
        diary_date = datetime.fromisoformat(str(diary.created_at).replace('Z', '+00:00'))
        if diary_date.replace(tzinfo=None) >= start_date:
            diary_count += 1
            for tag in diary.emotion_tags:
                tag_counter[tag] += 1
    
    top_tags = tag_counter.most_common(10)
    
    return {
        "period": period,
        "diary_count": diary_count,
        "emotions": [{"tag": tag, "count": count} for tag, count in top_tags],
        "total_tags": sum(tag_counter.values())
    }


@router.get("/best-media")
async def get_best_media(
    period: str = Query("week", regex="^(week|month)$"),
    user: dict = Depends(get_current_user)
):
    """사용자별 베스트 이미지 및 BGM 선정"""
    user_id = user.id
    now = datetime.now()
    if period == "week":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=30)
    
    diaries = diary_service.list_diaries(user_id)
    
    best_image_diary = None
    best_bgm_diary = None
    
    for diary_item in diaries:
        diary = diary_service.get_diary(diary_item.id, user_id)
        if not diary:
            continue
            
        diary_date = datetime.fromisoformat(str(diary.created_at).replace('Z', '+00:00'))
        if diary_date.replace(tzinfo=None) < start_date:
            continue
        
        if diary.image_paths and not best_image_diary:
            best_image_diary = {
                "diary_id": diary.id,
                "created_at": str(diary.created_at),
                "summary": diary.summary,
                "emotion_tags": diary.emotion_tags,
                "image_index": diary.selected_image_index
            }
        
        if diary.bgm_path and not best_bgm_diary:
            best_bgm_diary = {
                "diary_id": diary.id,
                "created_at": str(diary.created_at),
                "summary": diary.summary,
                "emotion_tags": diary.emotion_tags
            }
        
        if best_image_diary and best_bgm_diary:
            break
    
    return {
        "period": period,
        "best_image": best_image_diary,
        "best_bgm": best_bgm_diary
    }


@router.get("/all-tags")
async def get_all_tags(user: dict = Depends(get_current_user)):
    """사용자가 사용한 모든 감정 태그 목록 조회"""
    diaries = diary_service.list_diaries(user.id)
    all_tags = set()
    
    for diary in diaries:
        for tag in diary.emotion_tags:
            all_tags.add(tag)
    
    return {
        "tags": sorted(list(all_tags))
    }
