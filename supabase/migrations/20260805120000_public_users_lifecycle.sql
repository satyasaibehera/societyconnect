-- Central Neon application users table (keyed by Supabase Auth UUID).
-- Supabase Auth: credentials only. public.users: application identity + lifecycle.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  phone_number text,
  role text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.users SET status = 'pending' WHERE status IS NULL;

ALTER TABLE public.users ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS users_status_idx ON public.users (status);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

COMMENT ON TABLE public.users IS
  'Application user records in Neon DB, keyed by Supabase Auth UUID (id).';
