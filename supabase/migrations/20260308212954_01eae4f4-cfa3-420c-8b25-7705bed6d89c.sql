
-- Vehicle passes table
CREATE TABLE public.vehicle_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL,
  vehicle_type text,
  pass_type text NOT NULL DEFAULT 'permanent' CHECK (pass_type IN ('temporary', 'permanent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  visitor_name text,
  visitor_phone text,
  purpose text,
  unit_id uuid REFERENCES public.units(id),
  unit_label text,
  society_id uuid NOT NULL REFERENCES public.societies(id),
  requested_by uuid,
  approved_by uuid,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_passes ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view passes
CREATE POLICY "Vehicle passes viewable by authenticated"
ON public.vehicle_passes FOR SELECT TO authenticated
USING (true);

-- Security staff can create temporary passes
CREATE POLICY "Security can create temporary passes"
ON public.vehicle_passes FOR INSERT TO authenticated
WITH CHECK (
  pass_type = 'temporary' AND has_role(auth.uid(), 'security'::app_role)
);

-- Owners can create permanent passes for own unit
CREATE POLICY "Owners can create permanent passes"
ON public.vehicle_passes FOR INSERT TO authenticated
WITH CHECK (
  pass_type = 'permanent' AND unit_id IS NOT NULL AND is_unit_owner(auth.uid(), unit_id)
);

-- Unit owners can approve/reject temporary passes for their unit
CREATE POLICY "Owners can update passes for own unit"
ON public.vehicle_passes FOR UPDATE TO authenticated
USING (unit_id IS NOT NULL AND is_unit_owner(auth.uid(), unit_id));

-- Admins can manage all passes
CREATE POLICY "Admins can manage vehicle passes"
ON public.vehicle_passes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Super admins can manage all passes
CREATE POLICY "Super admins can manage vehicle passes"
ON public.vehicle_passes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
