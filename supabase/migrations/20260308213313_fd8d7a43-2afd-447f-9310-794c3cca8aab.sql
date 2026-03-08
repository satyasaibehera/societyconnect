
-- Allow owners to also create temporary passes for their own unit (pre-approved)
DROP POLICY "Security can create temporary passes" ON public.vehicle_passes;

CREATE POLICY "Security or owners can create temporary passes"
ON public.vehicle_passes FOR INSERT TO authenticated
WITH CHECK (
  pass_type = 'temporary' AND (
    has_role(auth.uid(), 'security'::app_role)
    OR (unit_id IS NOT NULL AND is_unit_owner(auth.uid(), unit_id))
  )
);
