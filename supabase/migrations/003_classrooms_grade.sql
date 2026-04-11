-- Phase 10 Migration: Add grade level to classrooms
-- Run on Supabase LXC:
-- sudo -u postgres psql -d postgres < /tmp/003_classrooms_grade.sql

-- Add grade column to classrooms (stores grade level like "Grade 7", "All Grades", etc.)
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS grade TEXT;

-- Index for filtering by grade
CREATE INDEX IF NOT EXISTS idx_classrooms_grade ON public.classrooms(grade);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
