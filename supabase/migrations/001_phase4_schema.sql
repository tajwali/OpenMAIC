-- Phase 4 Schema Migration
-- Run on Supabase LXC: sudo -u postgres psql -d postgres < /tmp/001_phase4_schema.sql

-- 1. Update user_profiles role constraint
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'teacher', 'school_student', 'mature_student'));

-- 2. Add new columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS school TEXT;

-- 3. Quiz results table
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2),
  answers JSONB DEFAULT '[]',
  taken_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Course progress table
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE CASCADE,
  scenes_completed TEXT[] DEFAULT '{}',
  last_scene_id TEXT,
  completed BOOLEAN DEFAULT FALSE,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, classroom_id)
);

-- 5. Course assignments table
CREATE TABLE IF NOT EXISTS public.course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(classroom_id, assigned_to)
);

-- 6. Exams table
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_classroom_ids TEXT[] DEFAULT '{}',
  questions JSONB DEFAULT '[]',
  time_limit_minutes INTEGER DEFAULT 30,
  difficulty TEXT DEFAULT 'mixed'
    CHECK (difficulty IN ('easy','medium','hard','mixed')),
  is_self_exam BOOLEAN DEFAULT FALSE,
  assigned_to UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Exam results table
CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2),
  time_taken_seconds INTEGER,
  answers JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_classroom_id ON public.quiz_results(classroom_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_user_id ON public.course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_assigned_to ON public.course_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_id ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_teacher_id ON public.user_profiles(teacher_id);

-- 9. Permissions
GRANT ALL ON public.quiz_results TO authenticated;
GRANT ALL ON public.course_progress TO authenticated;
GRANT ALL ON public.course_assignments TO authenticated;
GRANT ALL ON public.exams TO authenticated;
GRANT ALL ON public.exam_results TO authenticated;
GRANT ALL ON public.quiz_results TO service_role;
GRANT ALL ON public.course_progress TO service_role;
GRANT ALL ON public.course_assignments TO service_role;
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.exam_results TO service_role;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
