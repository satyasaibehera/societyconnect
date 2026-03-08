
ALTER TABLE public.societies ADD COLUMN IF NOT EXISTS temp_pass_validity_hours integer NOT NULL DEFAULT 24;
