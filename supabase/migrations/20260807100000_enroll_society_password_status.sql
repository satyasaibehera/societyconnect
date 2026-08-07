-- enroll-society: bcrypt password storage + society enrollment status fields.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password text;

ALTER TABLE public.societies ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE public.societies ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING';

COMMENT ON COLUMN public.users.password IS
  'Bcrypt password hash synced from Supabase Auth enrollment.';

COMMENT ON COLUMN public.societies.status IS
  'Enrollment lifecycle status (e.g. PENDING, ACTIVE).';
