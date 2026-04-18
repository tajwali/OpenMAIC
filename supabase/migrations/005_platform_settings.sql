-- Platform settings table for admin UI overrides
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key varchar(100) PRIMARY KEY,
  value text,
  updated_by uuid REFERENCES public.user_profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write platform settings via API (bypass RLS via service role)
-- But let's add basic policies just in case
CREATE POLICY "Admins can do everything with platform settings"
  ON public.platform_settings
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));
