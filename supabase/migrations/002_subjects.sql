-- Phase 9 Schema Migration: Course Subjects
-- Run on Supabase LXC:
-- sudo -u postgres psql -d postgres < /tmp/002_subjects.sql

-- 1. Subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📚',
  created_by UUID REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Default subjects
INSERT INTO public.subjects (name, icon, is_default) VALUES
  ('Mathematics', '📐', true),
  ('Physics', '⚡', true),
  ('Chemistry', '🧪', true),
  ('Biology', '🔬', true),
  ('Computer Science', '💻', true),
  ('History', '📜', true),
  ('Geography', '🌍', true),
  ('English', '📖', true),
  ('Islamic Studies', '☪️', true),
  ('Other', '📚', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Add subject_id and short_title to classrooms
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id),
  ADD COLUMN IF NOT EXISTS short_title TEXT;

-- 4. Permissions
GRANT ALL ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_classrooms_subject_id ON public.classrooms(subject_id);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
