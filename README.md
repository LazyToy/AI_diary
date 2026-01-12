# 📔 AI 대화형 일기 앱 (AI Diary)

AI와의 자연스러운 대화를 통해 하루를 회고하고, 감정을 시각화한 이미지로 기록하는 일기 앱입니다.

![AI 일기 대화 화면](./docs/chat_screenshot.png)

## ✨ 주요 기능

### 1. 대화형 일기 가이드 (AI 인터뷰어)
- AI가 먼저 말을 걸어 자연스럽게 일기 작성 유도
- 사용자 답변에 맞춰 공감하며 추가 질문
- "그만", "여기까지" 등 종료 키워드 인식

### 2. 요약 엔진
- 대화 내용을 3~5문장의 일기 형식으로 자동 요약
- 감정 태그 자동 추출 (예: #기쁨, #설렘, #피곤)

### 3. 감정 기반 이미지 생성
- 오늘 하루를 상징하는 이미지 자동 생성
- 6가지 화풍 지원: 수채화, 유화, 애니메이션, 픽셀아트, 스케치, 실사

### 4. 데이터 저장
- 모든 대화 기록, 요약, 이미지 자동 저장
- JSON 형식으로 데이터 영속화

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Python, FastAPI |
| AI | Google Gemini API |
| Frontend | HTML, CSS, JavaScript |
| 설정 관리 | Pydantic Settings |

---

## 📋 사전 요구사항

- **Python 3.11** 이상
- **가상환경 필수**: 이 앱은 의존성 관리와 안정성을 위해 반드시 가상환경(`.venv`) 내에서 실행되어야 합니다.
- **Gemini API 키** - [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급

---

## 🚀 설치 및 실행 방법

### 1. 저장소 클론 또는 다운로드

```bash
git clone <repository-url>
cd ai_diary
```

### 2. 가상환경 생성 및 활성화

**uv 사용 시 (권장):**
```bash
uv venv .venv --python 3.11
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
```

**pip 사용 시:**
```bash
python -m venv .venv
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
```

### 3. 의존성 패키지 설치

**uv 사용 시:**
```bash
uv pip install -r requirements.txt
```

**pip 사용 시:**
```bash
pip install -r requirements.txt
```

### 4. Gemini API 키 설정

`app/config/settings.py` 파일을 열어 API 키를 설정합니다:

```python
# settings.py
GEMINI_API_KEY: str = "여기에_발급받은_API_키_입력"
```

> ⚠️ **보안 주의**: `settings.py` 파일은 `.gitignore`에 등록되어 있어 Git에 커밋되지 않습니다. API 키가 노출되지 않도록 주의하세요.

**또는 `.env` 파일 사용:**
```bash
# .env 파일 생성
GEMINI_API_KEY=여기에_발급받은_API_키_입력
```

### 5. 서버 실행 (반드시 가상환경 활성화 상태에서)

> [!IMPORTANT]
> 가상환경이 활성화되지 않은 상태에서 서버를 실행하려고 하면 에러 메시지와 함께 종료됩니다.

```bash
# Windows
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 또는 가상환경 활성화 후
.\.venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 6. 앱 접속

브라우저에서 다음 주소로 접속:
```
http://127.0.0.1:8000
```

---

## 📖 사용 방법

### 일기 작성하기

1. **대화 시작**: "대화 시작하기" 버튼 클릭
2. **AI와 대화**: AI의 질문에 오늘 있었던 일을 자유롭게 답변
3. **대화 종료**: "그만", "여기까지" 등을 입력하거나 "일기 마무리하기" 버튼 클릭
4. **결과 확인**: 자동 생성된 요약과 감정 태그 확인
5. **이미지 생성** (선택): 원하는 화풍을 선택하고 이미지 생성

### 지난 일기 보기

- 우측 상단의 시계 아이콘(📚) 클릭
- 날짜별 일기 목록에서 원하는 일기 선택

---

## 📁 프로젝트 구조

```
ai_diary/
├── .venv/                    # Python 가상환경
├── app/
│   ├── config/
│   │   └── settings.py       # 설정 및 API 키 관리
│   ├── services/
│   │   ├── gemini_service.py # Gemini AI 통합
│   │   ├── diary_service.py  # 일기 데이터 관리
│   │   └── image_service.py  # 이미지 생성
│   ├── models/
│   │   └── schemas.py        # 데이터 모델
│   ├── routers/
│   │   └── diary_router.py   # API 라우터
│   ├── data/
│   │   ├── diaries/          # 일기 JSON 저장
│   │   └── images/           # 생성된 이미지 저장
│   └── main.py               # FastAPI 앱 엔트리포인트
├── static/
│   ├── index.html            # 프론트엔드 UI
│   ├── style.css             # 스타일시트
│   └── app.js                # JavaScript 로직
├── .env                      # 환경 변수 (API 키)
├── .gitignore
├── requirements.txt          # 의존성 목록
└── README.md
```

---

## 🔧 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 확인 |
| POST | `/api/session/start` | 새 일기 세션 시작 |
| POST | `/api/chat` | 메시지 전송 및 AI 응답 |
| POST | `/api/session/end` | 세션 종료 및 요약 생성 |
| POST | `/api/image/generate` | 이미지 생성 |
| GET | `/api/diaries` | 일기 목록 조회 |
| GET | `/api/diaries/{id}` | 특정 일기 조회 |
| DELETE | `/api/diaries/{id}` | 일기 삭제 |

---

## 🎨 이미지 스타일 옵션

| 스타일 | 설명 |
|--------|------|
| `watercolor` | 부드러운 수채화 스타일 |
| `oil_painting` | 클래식 유화 스타일 |
| `anime` | 애니메이션 일러스트 스타일 |
| `pixel` | 레트로 픽셀 아트 스타일 |
| `sketch` | 연필 스케치 스타일 |
| `realistic` | 사실적인 사진 스타일 |

---

## ❓ 문제 해결

### "API key not valid" 에러
- `settings.py` 또는 `.env` 파일에 올바른 Gemini API 키가 설정되어 있는지 확인하세요.
- [Google AI Studio](https://aistudio.google.com/app/apikey)에서 새 API 키를 발급받으세요.

### 서버 실행 오류
```bash
# 가상환경이 활성화되어 있는지 확인
.\.venv\Scripts\activate

# 패키지 재설치
uv pip install -r requirements.txt
```

### 이미지 생성 실패
- Gemini Imagen API에 대한 접근 권한이 필요합니다.
- 일부 계정에서는 이미지 생성 기능이 제한될 수 있습니다.

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

## 🙏 감사의 말

- Google Gemini API
- FastAPI
- 모든 오픈소스 기여자들

---

**Made with ❤️ for better daily reflection**
