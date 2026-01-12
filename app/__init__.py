"""AI Diary Application Package"""

import sys
import os

# 가상환경 실행 확인
def check_venv():
    """가상환경에서 실행 중인지 확인합니다."""
    # sys.prefix와 sys.base_prefix가 다르면 가상환경임
    # 또는 'VIRTUAL_ENV' 환경변수가 있으면 가상환경임
    is_venv = sys.prefix != sys.base_prefix or 'VIRTUAL_ENV' in os.environ
    
    if not is_venv:
        print("!" * 50)
        print("에러: 가상환경(.venv)이 활성화되지 않았습니다!")
        print("반드시 가상환경을 활성화한 후 실행해주세요.")
        print("Windows: .\\.venv\\Scripts\\activate")
        print("macOS/Linux: source .venv/bin/activate")
        print("!" * 50)
        sys.exit(1)

check_venv()
