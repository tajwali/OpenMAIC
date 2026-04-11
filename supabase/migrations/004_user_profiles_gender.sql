-- Add gender column to user_profiles for teacher profile settings
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT;
