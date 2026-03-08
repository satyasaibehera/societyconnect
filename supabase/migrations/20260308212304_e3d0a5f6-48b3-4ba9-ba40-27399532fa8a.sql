
CREATE POLICY "Owners can delete own vehicles"
ON public.vehicles
FOR DELETE
TO authenticated
USING (resident_id = get_user_resident_id(auth.uid()));

CREATE POLICY "Owners can update own vehicles"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (resident_id = get_user_resident_id(auth.uid()));
