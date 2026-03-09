
-- Add rich content fields to move_passes table
ALTER TABLE public.move_passes
  ADD COLUMN IF NOT EXISTS tenant_name text,
  ADD COLUMN IF NOT EXISTS tenant_phone text,
  ADD COLUMN IF NOT EXISTS tenant_email text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS scheduled_time time;
