-- Application user lifecycle status (Neon / public.profiles).
-- Supabase Auth holds credentials only; profiles holds app state keyed by auth UUID.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles (status);

COMMENT ON COLUMN public.profiles.status IS
  'Application lifecycle: pending (awaiting approval), active, suspended. Synced with Supabase Auth ban state via userLifecycleService.';
