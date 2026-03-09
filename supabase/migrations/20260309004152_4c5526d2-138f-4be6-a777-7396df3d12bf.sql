
-- Add configurable flag to societies for requiring admin approval on move passes
ALTER TABLE public.societies
ADD COLUMN requires_admin_for_move_pass boolean NOT NULL DEFAULT false;

-- Create move_passes table for move-in / move-out gate pass workflow
CREATE TABLE public.move_passes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies(id),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  requested_by uuid NOT NULL,
  pass_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending_owner',
  scheduled_date date,
  notes text,
  -- Owner approval step
  owner_approved_by uuid,
  owner_approved_at timestamp with time zone,
  owner_rejection_reason text,
  -- Admin approval step (only when requires_admin_for_move_pass = true)
  admin_approved_by uuid,
  admin_approved_at timestamp with time zone,
  admin_rejection_reason text,
  -- Dues clearance (for move-out, tracked by admin)
  dues_cleared boolean NOT NULL DEFAULT false,
  dues_cleared_by uuid,
  dues_cleared_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Validation trigger (instead of CHECK constraint) to ensure valid pass_type
CREATE OR REPLACE FUNCTION public.validate_move_pass()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pass_type NOT IN ('move_in', 'move_out') THEN
    RAISE EXCEPTION 'pass_type must be move_in or move_out';
  END IF;
  IF NEW.status NOT IN ('pending_owner', 'pending_admin', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid status value';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_move_pass_trigger
BEFORE INSERT OR UPDATE ON public.move_passes
FOR EACH ROW EXECUTE FUNCTION public.validate_move_pass();

-- Auto-update updated_at
CREATE TRIGGER update_move_passes_updated_at
BEFORE UPDATE ON public.move_passes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.move_passes ENABLE ROW LEVEL SECURITY;

-- RLS: Requesters can view their own passes
CREATE POLICY "Users can view own move passes"
ON public.move_passes FOR SELECT
USING (requested_by = auth.uid());

-- RLS: Unit members can view move passes for their unit
CREATE POLICY "Unit members can view unit move passes"
ON public.move_passes FOR SELECT
USING (is_unit_member(auth.uid(), unit_id));

-- RLS: Authenticated can create move passes (must be the requester)
CREATE POLICY "Authenticated can create move passes"
ON public.move_passes FOR INSERT
WITH CHECK (auth.uid() = requested_by);

-- RLS: Unit approvers (owners + active delegates) can update passes for their unit
CREATE POLICY "Unit approvers can update move passes"
ON public.move_passes FOR UPDATE
USING (is_unit_approver(auth.uid(), unit_id));

-- RLS: Admins can fully manage move passes
CREATE POLICY "Admins can manage move passes"
ON public.move_passes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Super admins can manage move passes
CREATE POLICY "Super admins can manage move passes"
ON public.move_passes FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));
