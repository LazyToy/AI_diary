"""
Supabase 테이블 생성 및 마이그레이션 스크립트
테이블 생성부터 데이터 마이그레이션까지 한 번에 수행합니다.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# 프로젝트 루트를 path에 추가
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from app.config.supabase_client import get_supabase
from app.config.settings import settings


# 테이블 생성 SQL
CREATE_TABLE_SQL = """
-- 1. diaries 테이블 생성
create table if not exists public.diaries (
    id text primary key,
    created_at timestamp with time zone default now(),
    diary_date date not null,
    conversation jsonb not null default '[]'::jsonb,
    summary text,
    emotion_tags text[] default array[]::text[],
    image_prompt text,
    image_paths text[] default array[]::text[],
    selected_image_index integer default 0,
    bgm_prompt text,
    bgm_path text,
    style text default 'watercolor',
    image_path text,
    melody jsonb,
    music_path text
);

-- 2. 인덱스 생성
create index if not exists idx_diaries_diary_date on public.diaries(diary_date);
create index if not exists idx_diaries_created_at on public.diaries(created_at);
"""

# RLS 정책 SQL (별도 실행)
RLS_POLICIES_SQL = [
    "alter table public.diaries enable row level security;",
    """create policy "diaries_select_policy" on public.diaries for select using (true);""",
    """create policy "diaries_insert_policy" on public.diaries for insert with check (true);""",
    """create policy "diaries_update_policy" on public.diaries for update using (true);""",
    """create policy "diaries_delete_policy" on public.diaries for delete using (true);""",
]


def parse_diary_date(diary_id: str, created_at: str) -> str:
    """diary_id 또는 created_at에서 날짜 추출"""
    try:
        parts = diary_id.split('_')
        if len(parts) >= 2:
            date_str = parts[1]
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    except:
        pass
    
    try:
        dt = datetime.fromisoformat(created_at)
        return dt.strftime("%Y-%m-%d")
    except:
        return datetime.now().strftime("%Y-%m-%d")


def migrate_diary(diary_path: Path) -> dict:
    """단일 diary 파일을 Supabase 형식으로 변환"""
    with open(diary_path, 'r', encoding='utf-8') as f:
        diary_data = json.load(f)
    
    diary_id = diary_data.get('id', diary_path.stem)
    created_at = diary_data.get('created_at', datetime.now().isoformat())
    diary_date = parse_diary_date(diary_id, created_at)
    
    return {
        'id': diary_id,
        'created_at': created_at,
        'diary_date': diary_date,
        'conversation': diary_data.get('conversation', []),
        'summary': diary_data.get('summary'),
        'emotion_tags': diary_data.get('emotion_tags', []),
        'image_prompt': diary_data.get('image_prompt'),
        'image_paths': diary_data.get('image_paths', []),
        'selected_image_index': diary_data.get('selected_image_index', 0),
        'bgm_prompt': diary_data.get('bgm_prompt'),
        'bgm_path': diary_data.get('bgm_path'),
        'style': diary_data.get('style', 'watercolor'),
        'image_path': diary_data.get('image_path'),
        'melody': diary_data.get('melody'),
        'music_path': diary_data.get('music_path'),
    }


def main():
    print("=" * 60)
    print("🚀 Supabase 설정 및 마이그레이션 시작")
    print("=" * 60)
    
    # 1. Supabase 연결
    try:
        supabase = get_supabase()
        print("✅ Supabase 연결 성공!")
    except Exception as e:
        print(f"❌ Supabase 연결 실패: {e}")
        return
    
    # 2. 테이블 생성 (SQL 실행)
    print("\n📋 테이블 생성 중...")
    try:
        # Supabase Python 클라이언트에서는 직접 SQL 실행이 제한적
        # 대신 테이블이 존재하는지 확인하고, 존재하지 않으면 안내
        response = supabase.table("diaries").select("id").limit(1).execute()
        print("✅ diaries 테이블이 이미 존재합니다!")
    except Exception as e:
        error_msg = str(e)
        if "relation" in error_msg and "does not exist" in error_msg:
            print("⚠️ diaries 테이블이 존재하지 않습니다.")
            print("\n" + "=" * 60)
            print("📌 Supabase Dashboard에서 다음 SQL을 실행해주세요:")
            print("=" * 60)
            print(CREATE_TABLE_SQL)
            print("\n그 후 이 스크립트를 다시 실행해주세요.")
            return
        else:
            print(f"⚠️ 테이블 확인 중 오류 (계속 진행): {e}")
    
    # 3. 데이터 마이그레이션
    print("\n📁 데이터 마이그레이션 중...")
    diaries_dir = settings.DIARIES_DIR
    diary_files = list(diaries_dir.glob("diary_*.json"))
    
    if not diary_files:
        print("⚠️ 마이그레이션할 diary 파일이 없습니다.")
        return
    
    print(f"  {len(diary_files)}개의 diary 파일 발견")
    
    success_count = 0
    error_count = 0
    
    for diary_path in diary_files:
        try:
            record = migrate_diary(diary_path)
            response = supabase.table("diaries").upsert(record).execute()
            
            if response.data:
                print(f"  ✅ {record['id']} ({record['diary_date']})")
                success_count += 1
            else:
                print(f"  ⚠️ {diary_path.name}: 응답 없음")
                error_count += 1
                
        except Exception as e:
            print(f"  ❌ {diary_path.name}: {e}")
            error_count += 1
    
    # 4. 결과 출력
    print("\n" + "=" * 60)
    print("🎉 마이그레이션 완료!")
    print(f"  ✅ 성공: {success_count}개")
    print(f"  ❌ 실패: {error_count}개")
    print("=" * 60)
    
    # 5. 데이터 확인
    print("\n📊 Supabase 데이터 확인:")
    try:
        response = supabase.table("diaries").select("id, diary_date, summary").order("created_at", desc=True).limit(5).execute()
        
        if response.data:
            print(f"  최근 {len(response.data)}개 레코드:")
            for row in response.data:
                summary = row.get('summary', '요약 없음')
                if summary and len(summary) > 40:
                    summary = summary[:40] + "..."
                print(f"    📝 {row['id']}")
                print(f"       날짜: {row['diary_date']}, 요약: {summary or '없음'}")
        else:
            print("  데이터가 없습니다.")
    except Exception as e:
        print(f"  데이터 조회 실패: {e}")


if __name__ == "__main__":
    main()
