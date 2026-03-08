
-- Table for approval delegation
CREATE TABLE public.approval_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  delegate_id uuid NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, delegate_id, owner_id)
);

ALTER TABLE public.approval_delegates ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own delegations
CREATE POLICY "Owners can manage own delegations"
ON public.approval_delegates FOR ALL TO authenticated
USING (is_unit_owner(auth.uid(), unit_id))
WITH CHECK (is_unit_owner(auth.uid(), unit_id));

-- Delegates can view their own delegations
CREATE POLICY "Delegates can view own delegations"
ON public.approval_delegates FOR SELECT TO authenticated
USING (delegate_id = auth.uid());

-- Admins can view all delegations
CREATE POLICY "Admins can view all delegations"
ON public.approval_delegates FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Function: check if user is unit approver (owner or active delegate)
CREATE OR REPLACE FUNCTION public.is_unit_approver(_user_id uuid, _unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residents
    WHERE user_id = _user_id
      AND unit_id = _unit_id
      AND resident_type = 'owner'
      AND status = 'approved'
  )
  OR EXISTS (
    SELECT 1 FROM public.approval_delegates
    WHERE delegate_id = _user_id
      AND approval_delegates.unit_id = _unit_id
      AND is_active = true
      AND now() BETWEEN valid_from AND valid_until
  )
$$;

-- Update vehicle_passes RLS: allow delegates to approve temp passes
DROP POLICY IF EXISTS "Owners can update passes for own unit" ON public.vehicle_passes;
CREATE POLICY "Approvers can update passes for own unit"
ON public.vehicle_passes FOR UPDATE TO authenticated
USING (unit_id IS NOT NULL AND is_unit_approver(auth.uid(), unit_id));

-- Update visitors RLS: allow delegates to update visitors for own unit
CREATE POLICY "Approvers can update own unit visitors"
ON public.visitors FOR UPDATE TO authenticated
USING (visiting_unit_id IS NOT NULL AND is_unit_approver(auth.uid(), visiting_unit_id));
