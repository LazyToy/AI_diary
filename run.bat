@echo off
setlocal

set VENV_PATH=.venv
set PYTHON_PATH=%VENV_PATH%\Scripts\python.exe

if not exist "%PYTHON_PATH%" (
    echo [ERROR] Virtual environment not found at %VENV_PATH%
    echo Please create it first using: uv venv or python -m venv .venv
    pause
    exit /b 1
)

echo [INFO] Starting AI Diary App using virtual environment...
"%PYTHON_PATH%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pause
