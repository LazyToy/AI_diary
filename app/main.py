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

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.config.settings import settings
from app.routers import diary_router

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI와의 대화를 통해 자연스럽게 하루를 회고하고, 감정을 시각화하는 일기 앱",
    version="1.0.0"
)

# Include routers
app.include_router(diary_router.router)

# Static files
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


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
