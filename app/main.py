import sys
import os

# 가상환경 실행 확인 (최상단 가드)
def ensure_venv():
    is_venv = sys.prefix != sys.base_prefix or 'VIRTUAL_ENV' in os.environ
    if not is_venv:
        print("\n" + "!" * 60)
        print(" [ERROR] 가상환경(.venv)이 활성화되지 않았습니다!")
        print(" 애플리케이션의 안정성을 위해 반드시 가상환경에서 실행해야 합니다.")
        print(" 실행 방법: .\\run.bat (Windows) 또는 가상환경 활성화 후 실행")
        print("!" * 60 + "\n")
        sys.exit(1)

ensure_venv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import traceback

from app.config.settings import settings
from app.routers import diary_router, stats_router
from app.services.music_service import music_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 실행될 로직
    print("서버 시작: 모델 프리로딩을 시작합니다...")
    try:
        music_service._load_model()
    except Exception as e:
        print(f"모델 프리로딩 중 오류 발생: {e}")
    
    yield
    # 서버 종료 시 실행될 로직
    print("서버 종료 중...")

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI와의 대화를 통해 자연스럽게 하루를 회고하고, 감정을 시각화하는 일기 앱",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(diary_router.router)
app.include_router(stats_router.router)

# 글로벌 예외 처리기
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"\n{'='*20} GLOBAL ERROR {'='*20}", flush=True)
    print(f"Path: {request.url.path}", flush=True)
    print(f"Error: {exc}", flush=True)
    traceback.print_exc()
    print('='*54 + '\n', flush=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)}
    )

# Static files
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/api/config")
async def get_config():
    """프론트엔드에 필요한 설정값 반환 (보안 주의: Secret Key 노출 금지)"""
    return {
        "clerk_publishable_key": settings.CLERK_PUBLISHABLE_KEY
    }


@app.get("/")
async def root():
    """Serve the main page"""
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Welcome to AI Diary API", "docs": "/docs"}


@app.get("/favicon.ico")
async def favicon():
    """Serve favicon"""
    favicon_path = static_dir / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(favicon_path)
    return {"status": "no favicon"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
