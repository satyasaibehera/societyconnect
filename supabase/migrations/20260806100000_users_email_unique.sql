-- Required for enroll-society ON CONFLICT (email) self-healing upserts.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON public.users (email)
WHERE email IS NOT NULL AND trim(email) <> '';
