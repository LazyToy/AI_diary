-- Supabase + Clerk 연동 설정 SQL (RLS 정책 포함)
-- Supabase Dashboard > SQL Editor에서 실행하세요.
-- 
-- 참고: Clerk을 Supabase Third-party Auth Provider로 먼저 설정해야 합니다.
-- 1. Clerk Dashboard > Integrations > Supabase 활성화
-- 2. Supabase Dashboard > Authentication > Sign In / Up > Add provider > Clerk

-- 1. 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY, -- Clerk User ID (sub claim)
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- user_id 컬럼 등 추가 (기존 테이블 존재 시 대응)
DO $$ 
BEGIN 
    -- Users table columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
        ALTER TABLE public.users ADD COLUMN full_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
        ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
    END IF;

    -- Diaries table columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diaries' AND column_name='user_id') THEN
        ALTER TABLE public.diaries ADD COLUMN user_id TEXT DEFAULT (auth.jwt()->>'sub');
    END IF;
END $$;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON public.diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_diary_date ON public.diaries(diary_date);
CREATE INDEX IF NOT EXISTS idx_diaries_created_at ON public.diaries(created_at);

-- 4. RLS (Row Level Security) 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

-- 5. 기존 정책 삭제 (깨끗한 상태로 재생성)
DROP POLICY IF EXISTS "Allow public access" ON public.users;
DROP POLICY IF EXISTS "Allow public access" ON public.diaries;
DROP POLICY IF EXISTS "diaries_delete_policy" ON public.diaries;
DROP POLICY IF EXISTS "diaries_select_policy" ON public.diaries;
DROP POLICY IF EXISTS "diaries_insert_policy" ON public.diaries;
DROP POLICY IF EXISTS "diaries_update_policy" ON public.diaries;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_upsert_policy" ON public.users;

-- 6. Clerk JWT 기반 RLS 정책 생성

-- Users 테이블: 인증된 사용자는 자신의 정보 조회 가능
CREATE POLICY "users_select_policy"
ON public.users
FOR SELECT
TO authenticated
USING (
    (SELECT auth.jwt()->>'sub') = id
);

-- Users 테이블: 인증된 사용자는 자신의 정보 삽입 가능 (첫 로그인 시)
CREATE POLICY "users_insert_policy"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.jwt()->>'sub') = id
);

-- Users 테이블: 인증된 사용자는 자신의 정보 수정 가능
CREATE POLICY "users_update_policy"
ON public.users
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.jwt()->>'sub') = id
)
WITH CHECK (
    (SELECT auth.jwt()->>'sub') = id
);

-- Diaries 테이블: 자신의 일기만 CRUD 가능
CREATE POLICY "diaries_select_policy"
ON public.diaries
FOR SELECT
TO authenticated
USING (
    (SELECT auth.jwt()->>'sub') = user_id
);

CREATE POLICY "diaries_insert_policy"
ON public.diaries
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.jwt()->>'sub') = user_id
);

CREATE POLICY "diaries_update_policy"
ON public.diaries
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.jwt()->>'sub') = user_id
)
WITH CHECK (
    (SELECT auth.jwt()->>'sub') = user_id
);

CREATE POLICY "diaries_delete_policy"
ON public.diaries
FOR DELETE
TO authenticated
USING (
    (SELECT auth.jwt()->>'sub') = user_id
);

-- 7. 서비스 역할 키(Service Role Key)를 사용하는 백엔드용 정책 (선택사항)
-- 백엔드에서 service_role 키를 사용하면 RLS를 우회할 수 있습니다.
-- 현재 anon key를 사용하므로 위 정책이 적용됩니다.

-- 실행 확인 메시지
SELECT 'Clerk + Supabase 연동 설정이 완료되었습니다!' as message;

-- 테이블 확인
SELECT table_name, is_insertable_into 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('users', 'diaries');

-- RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
