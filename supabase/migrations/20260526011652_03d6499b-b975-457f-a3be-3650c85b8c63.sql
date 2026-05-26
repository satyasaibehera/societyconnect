
CREATE OR REPLACE FUNCTION public.get_owned_unit_ids(_society_id uuid)
RETURNS TABLE(unit_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.unit_id
  FROM public.residents r
  JOIN public.societies s ON s.id = r.society_id
  WHERE r.society_id = _society_id
    AND r.resident_type = 'owner'
    AND r.status = 'approved'
    AND r.unit_id IS NOT NULL
    AND s.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_owned_unit_ids(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anon can view approved owner unit ids" ON public.residents;
