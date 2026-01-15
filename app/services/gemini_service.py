"""
Gemini AI Service
Gemini API를 사용한 대화 관리 및 AI 기능 제공
"""

from google import genai
from google.genai import types
from typing import Optional
from app.config.settings import settings


# Configure Gemini Client
client = genai.Client(api_key=settings.GEMINI_API_KEY)


class GeminiService:
    """Gemini AI Service for diary conversations"""
    
    DIARY_SYSTEM_PROMPT = """당신은 따뜻하고 공감 능력이 뛰어난 일기 작성 도우미입니다.
사용자의 하루를 자연스럽게 들어주며, 감정을 이해하고 공감해주세요.

역할:
1. 사용자가 하루를 회고할 수 있도록 자연스러운 질문을 합니다.
2. 사용자의 답변에서 감정, 사건, 인물 등 핵심 키워드를 파악합니다.
3. 필요하다면 "그때 기분이 어떠셨어요?" 같은 심층 질문으로 더 자세한 이야기를 이끌어냅니다.
4. 5W1H(누가, 무엇을, 언제, 어디서, 왜, 어떻게)가 자연스럽게 채워지도록 대화를 이끕니다.
5. 사용자가 충분히 이야기했다고 느끼면 "오늘 하루 이야기 정리해드릴까요?"라고 물어봅니다.

대화 규칙:
- 한국어로 대화합니다.
- 응답은 3-5문장으로 중간정도하게 합니다.
- 온화하고 친근한 말투를 사용합니다.
- 사용자가 "그만", "여기까지", "끝" 등을 말하면 대화 종료를 제안합니다.

첫 인사는 오늘 하루 어땠는지 물어보는 것으로 시작하세요."""

    SUMMARY_SYSTEM_PROMPT = """당신은 대화 내용을 일기 형식으로 요약하는 전문가입니다.

다음 대화 내용을 바탕으로:
1. 3-5문장의 일기 형식 요약을 작성하세요.
2. 주요 감정을 태그로 추출하세요 (예: #기쁨, #설렘, #피곤)
3. 이미지 생성을 위한 시각적 묘사를 작성하세요 (날씨, 표정, 색감, 분위기 등)
4. BGM 생성을 위한 음악적 묘사를 작성하세요. 요약된 일기의 스토리와 감정의 흐름을 반영하여, 단순히 악기 이름만 나열하지 말고 전체적인 공간감, 템포, 분위기, 스타일(Lo-fi, Ambient, Cinematic, Orchestral 등)을 포함하세요.

JSON 형식으로 응답하세요:
{
    "summary": "오늘 하루 일기 요약...",
    "emotion_tags": ["기쁨", "설렘"],
    "image_prompt": "A warm sunset scene with soft orange and pink colors, a person sitting peacefully...",
    "bgm_prompt": "cinematic and hopeful orchestral score that gradually builds energy, reflecting a sense of new beginnings, warm atmosphere"
}"""

    def __init__(self):
        self.model_name = "gemini-2.0-flash"
        # Session storage: session_id -> chat history
        self.sessions: dict[str, list[types.Content]] = {}
    
    def get_or_create_session(self, session_id: str, user_id: str = None) -> list[types.Content]:
        """Get existing chat history or create new one (recovers from disk if needed)"""
        if session_id not in self.sessions:
            # Try to recover from diary_service if it exists
            if user_id:
                from app.services.diary_service import diary_service
                diary = diary_service.get_diary(session_id, user_id)
                if diary and diary.conversation:
                    history = []
                    for msg in diary.conversation:
                        role = "model" if msg.role == "model" else "user"
                        history.append(types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=msg.content)]
                        ))
                    self.sessions[session_id] = history
                else:
                    self.sessions[session_id] = []
            else:
                self.sessions[session_id] = []
        return self.sessions[session_id]
    
    def chat(self, session_id: str, user_message: str, user_id: str = None) -> tuple[str, bool]:
        """
        Send message and get response
        Returns: (response_text, is_session_complete)
        """
        history = self.get_or_create_session(session_id, user_id)
        
        # Check for explicit end commands
        end_keywords = ["그만", "여기까지", "끝", "종료", "마무리"]
        is_ending = any(keyword in user_message for keyword in end_keywords)
        
        # Add user message to history
        history.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)]
        ))
        
        # Generate response
        response = client.models.generate_content(
            model=self.model_name,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=self.DIARY_SYSTEM_PROMPT
            )
        )
        
        response_text = response.text
        
        # Add assistant response to history
        history.append(types.Content(
            role="model",
            parts=[types.Part.from_text(text=response_text)]
        ))
        
        # Check if AI is suggesting to end
        is_complete = is_ending or "정리해드릴까요" in response_text or "마무리할까요" in response_text
        
        return response_text, is_complete
    
    def get_initial_greeting(self, session_id: str, user_id: str = None) -> str:
        """Get initial greeting from AI"""
        history = self.get_or_create_session(session_id, user_id)
        
        # Add initial prompt
        history.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text="대화를 시작해주세요.")]
        ))
        
        response = client.models.generate_content(
            model=self.model_name,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=self.DIARY_SYSTEM_PROMPT
            )
        )
        
        response_text = response.text
        
        # Add assistant response to history
        history.append(types.Content(
            role="model",
            parts=[types.Part.from_text(text=response_text)]
        ))
        
        return response_text
    
    def get_conversation_history(self, session_id: str) -> list[dict]:
        """Get conversation history for a session"""
        if session_id not in self.sessions:
            return []
        
        history = self.sessions[session_id]
        result = []
        for msg in history:
            role = msg.role
            content = msg.parts[0].text if msg.parts else ""
            result.append({
                "role": role,
                "content": content
            })
        return result
    
    def generate_summary(self, session_id: str) -> Optional[dict]:
        """Generate summary from conversation history"""
        history = self.get_conversation_history(session_id)
        if not history:
            return None
        
        # Format conversation for summary
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}" 
            for msg in history
        ])
        
        prompt = f"""다음 대화 내용을 분석하고 요약해주세요:

{conversation_text}

JSON 형식으로 응답하세요."""
        
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=self.SUMMARY_SYSTEM_PROMPT
            )
        )
        
        # Parse JSON response
        import json
        try:
            # Clean up response text
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return {
                "summary": response.text,
                "emotion_tags": [],
                "image_prompt": ""
            }
    
    def regenerate_tags(self, summary: str) -> dict:
        """수정된 요약 내용을 기반으로 감정 태그 재생성"""
        import json
        
        prompt = f"""다음 일기 요약을 분석하고 감정 태그와 이미지/BGM 프롬프트를 생성해주세요:

요약: {summary}

JSON 형식으로 응답하세요:
{{
    "emotion_tags": ["감정1", "감정2"],
    "image_prompt": "시각적 묘사...",
    "bgm_prompt": "음악적 묘사..."
}}"""

        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        
        try:
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return {
                "emotion_tags": [],
                "image_prompt": "",
                "bgm_prompt": ""
            }
    
    def clear_session(self, session_id: str):
        """Clear a session from memory"""
        if session_id in self.sessions:
            del self.sessions[session_id]


# Global service instance
gemini_service = GeminiService()

