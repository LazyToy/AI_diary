"""
Music Service
Hugging Face MusicGen을 사용한 BGM 생성 서비스
"""

import torch
import scipy.io.wavfile as wavfile
from pathlib import Path
from datetime import datetime
from typing import Optional

from app.config.settings import settings


class MusicService:
    """Service for generating BGM using Hugging Face MusicGen"""
    
    # 감정별 음악 프롬프트 매핑
    MOOD_PROMPTS = {
        "기쁨": "happy upbeat cheerful cinematic soundtrack, bright and energetic, major key",
        "행복": "joyful warm atmospheric music, positive and heart-warming mood",
        "설렘": "exciting anticipatory cinematic score, building energy and wonder",
        "평화": "peaceful calm ambient soundscape, serene and tranquil atmosphere",
        "감사": "warm grateful emotive soundtrack, heartfelt and sincere tones",
        "사랑": "romantic tender cinematic music, sweet and soft mood",
        "슬픔": "melancholic sad emotive score, slow and touching, minor key",
        "우울": "somber reflective ambient music, introspective and deep mood",
        "피곤": "relaxing soothing ambient soundscape, calming and minimal",
        "불안": "tense atmospheric suspenseful music, uneasy and edge-of-seat feeling",
        "화남": "intense powerful dramatic score, bold and aggressive energy",
        "외로움": "lonely contemplative minimal soundtrack, quiet and introspective",
        "희망": "hopeful uplifting cinematic music, inspiring and rising energy",
        "그리움": "nostalgic wistful cinematic score, longing and memories",
    }
    
    DEFAULT_PROMPT = "calm relaxing instrumental ambient music, peaceful and steady mood"
    
    def __init__(self):
        self.music_dir = settings.DATA_DIR / "music"
        self.music_dir.mkdir(exist_ok=True)
        
        # 모델은 첫 사용 시 로드 (lazy loading)
        self._model = None
        self._processor = None
        
        # MusicGen medium 모델 사용
        self.model_name = "facebook/musicgen-medium"
        
        # BGM 길이 (초)
        self.duration_seconds = 30
        
        # 샘플레이트
        self.sample_rate = 32000
        
        # 디바이스 설정 (CPU 기본, GPU 주석 처리)
        # GPU 사용 시 아래 주석 해제
        # self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = "cpu"
    
    def _load_model(self):
        """모델 로드 (최초 1회만 실행)"""
        if self._model is None:
            print(f"MusicGen 모델 로딩 중... (디바이스: {self.device})")
            print("첫 로딩 시 모델 다운로드가 필요할 수 있습니다. (~1.5GB)")
            
            from transformers import AutoProcessor, MusicgenForConditionalGeneration
            
            self._processor = AutoProcessor.from_pretrained(self.model_name)
            self._model = MusicgenForConditionalGeneration.from_pretrained(self.model_name)
            self._model.to(self.device)
            
            print("MusicGen 모델 로딩 완료!")
    
    def _get_music_prompt(self, emotion_tags: list[str], custom_prompt: str = "") -> str:
        """감정 태그 기반 음악 프롬프트 생성"""
        prompts = []
        
        # 감정 기반 프롬프트 추가
        for tag in emotion_tags:
            if tag in self.MOOD_PROMPTS:
                prompts.append(self.MOOD_PROMPTS[tag])
        
        # 커스텀 프롬프트 추가
        if custom_prompt:
            prompts.append(custom_prompt)
        
        # 조합 또는 기본값 반환
        if prompts:
            return ", ".join(prompts[:2])  # 최대 2개 스타일로 일관성 유지
        return self.DEFAULT_PROMPT
    
    async def generate_bgm(
        self,
        diary_id: str,
        emotion_tags: list[str] = None,
        bgm_prompt: str = ""
    ) -> Optional[str]:
        """
        일기 분위기 기반 BGM 생성
        성공 시 저장된 오디오 파일 경로 반환, 실패 시 None 반환
        """
        emotion_tags = emotion_tags or []
        music_prompt = bgm_prompt if bgm_prompt else self._get_music_prompt(emotion_tags)
        
        print(f"BGM 생성 프롬프트: {music_prompt}")
        print(f"생성 시간: 약 {self.duration_seconds * 3}~{self.duration_seconds * 5}초 소요 (CPU 기준)")
        
        try:
            # 모델 로드 (lazy loading)
            self._load_model()
            
            # 입력 토큰화
            inputs = self._processor(
                text=[music_prompt],
                padding=True,
                return_tensors="pt",
            ).to(self.device)
            
            # 토큰 수 계산 (duration에 따라)
            # MusicGen: ~50 토큰 = 1초
            max_new_tokens = int(self.duration_seconds * 50)
            
            print(f"음악 생성 중... (최대 {max_new_tokens} 토큰)")
            
            # 음악 생성
            with torch.no_grad():
                audio_values = self._model.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    do_sample=True,
                    guidance_scale=3.0,
                )
            
            # 파일 저장
            filename = f"{diary_id}_bgm_{datetime.now().strftime('%H%M%S')}.wav"
            audio_path = self.music_dir / filename
            
            # numpy 배열로 변환 후 WAV 저장
            audio_data = audio_values[0, 0].cpu().numpy()
            
            # scipy를 사용해 WAV 파일 저장
            wavfile.write(str(audio_path), self.sample_rate, audio_data)
            
            print(f"BGM 저장 완료: {audio_path}")
            return str(audio_path)
            
        except Exception as e:
            print(f"BGM 생성 오류: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_placeholder_message(self) -> str:
        """BGM 생성 실패 시 메시지 반환"""
        return "BGM 생성에 실패했습니다. 잠시 후 다시 시도해주세요."


# 전역 서비스 인스턴스
music_service = MusicService()
