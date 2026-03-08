
-- Unique partial index: only one approved owner per unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_unit
ON public.residents (unit_id)
WHERE resident_type = 'owner' AND status = 'approved';

-- Function to check if a unit has an approved owner
CREATE OR REPLACE FUNCTION public.unit_has_approved_owner(_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residents
    WHERE unit_id = _unit_id
      AND resident_type = 'owner'
      AND status = 'approved'
  )
$$;

-- Function to transfer ownership (atomically swap roles)
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  _current_owner_id uuid,
  _new_owner_id uuid,
  _invoker_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_owner_user_id uuid;
  _current_unit_id uuid;
  _new_unit_id uuid;
BEGIN
  -- Verify the invoker is the current owner
  SELECT user_id, unit_id INTO _current_owner_user_id, _current_unit_id
  FROM public.residents WHERE id = _current_owner_id AND resident_type = 'owner' AND status = 'approved';

  IF _current_owner_user_id IS NULL OR _current_owner_user_id != _invoker_user_id THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  -- Verify new owner is in same unit and approved
  SELECT unit_id INTO _new_unit_id
  FROM public.residents WHERE id = _new_owner_id AND status = 'approved';

  IF _new_unit_id IS NULL OR _new_unit_id != _current_unit_id THEN
    RAISE EXCEPTION 'New owner must be an approved member of the same unit';
  END IF;

  -- Swap: demote current owner to 'family', promote new owner to 'owner'
  UPDATE public.residents SET resident_type = 'family', updated_at = now()
  WHERE id = _current_owner_id;

  UPDATE public.residents SET resident_type = 'owner', updated_at = now()
  WHERE id = _new_owner_id;
END;
$$;
