
-- 1. Allow anonymous users to read active societies (needed for registration dropdown)
CREATE POLICY "Anon can view active societies"
ON public.societies
FOR SELECT
TO anon
USING (is_active = true);

-- Same for buildings/units so resident reg can populate flat list pre-login
CREATE POLICY "Anon can view buildings of active societies"
ON public.buildings
FOR SELECT
TO anon
USING (society_id IN (SELECT id FROM public.societies WHERE is_active = true));

CREATE POLICY "Anon can view units of active societies"
ON public.units
FOR SELECT
TO anon
USING (building_id IN (
  SELECT b.id FROM public.buildings b
  JOIN public.societies s ON s.id = b.society_id
  WHERE s.is_active = true
));

-- Allow anon to see approved owner residents (just unit_id) for the "available flats" filter
CREATE POLICY "Anon can view approved owner unit ids"
ON public.residents
FOR SELECT
TO anon
USING (status = 'approved' AND resident_type = 'owner');

-- 2. OTP codes table for email + phone verification during registration
CREATE TABLE public.otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('email','phone')),
  target text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_target ON public.otp_codes (kind, target, created_at DESC);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No client policies — only edge functions (service role) touch this table.
-- Super admins can read for debugging.
CREATE POLICY "Super admins can view otp codes"
ON public.otp_codes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
