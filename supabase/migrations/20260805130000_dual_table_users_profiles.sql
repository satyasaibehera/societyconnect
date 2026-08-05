-- Dual-table sync: public.users (credentials) + public.profiles (metadata)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

UPDATE public.profiles
SET phone_number = phone
WHERE phone_number IS NULL AND phone IS NOT NULL;

UPDATE public.profiles SET status = 'pending' WHERE status IS NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles (user_id);

COMMENT ON COLUMN public.users.password_hash IS
  'Placeholder when Supabase Auth manages passwords (SUPABASE_MANAGED_AUTH).';
