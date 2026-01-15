"""
BGM 프롬프트 생성 테스트 스크립트
"""
import sys
from pathlib import Path

# 프로젝트 루트를 path에 추가
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from app.services.gemini_service import gemini_service
from app.services.music_service import music_service

def test_bgm_prompt_generation():
    test_summaries = [
        "오늘은 오랜만에 친구를 만나서 맛있는 커피를 마시며 수다를 떨었다. 따스한 햇살 아래 웃음소리가 끊이지 않았고, 정말 힐링되는 기분이었다.",
        "하루 종일 비가 내려서 마음이 차분해졌다. 혼자 서재에 앉아 책을 읽으며 따뜻한 차 한 잔을 마셨다. 조금은 쓸쓸했지만 평온한 저녁이었다.",
        "프로젝트 마감 기한이 다가와서 너무 긴장되고 초조하다. 밤늦게까지 야근을 하며 커피만 계속 마시고 있다. 심장이 두근거리고 쉬고 싶다."
    ]
    
    print("=" * 60)
    print("🚀 BGM 프롬프트 생성 테스트")
    print("=" * 60)
    
    for i, summary in enumerate(test_summaries):
        print(f"\n[Test {i+1}]")
        print(f"Summary: {summary}")
        
        # Gemini로 프롬프트 재생성 테스트
        result = gemini_service.regenerate_tags(summary)
        bgm_prompt = result.get("bgm_prompt")
        
        print(f"Generated BGM Prompt: {bgm_prompt}")
        
        # 만약 비어있다면 MusicService의 기본 로직 확인
        if not bgm_prompt:
            emotion_tags = result.get("emotion_tags", [])
            fallback_prompt = music_service._get_music_prompt(emotion_tags)
            print(f"Fallback BGM Prompt: {fallback_prompt}")

if __name__ == "__main__":
    test_bgm_prompt_generation()
