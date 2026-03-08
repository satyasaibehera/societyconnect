
-- Helper function: check if user is an owner of a given unit
CREATE OR REPLACE FUNCTION public.is_unit_owner(_user_id uuid, _unit_id uuid)
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
$$;

-- Helper function: check if user belongs to a unit (owner or tenant)
CREATE OR REPLACE FUNCTION public.is_unit_member(_user_id uuid, _unit_id uuid)
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
      AND status = 'approved'
  )
$$;

-- Helper function: get user's unit_id
CREATE OR REPLACE FUNCTION public.get_user_unit_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id FROM public.residents
  WHERE user_id = _user_id AND status = 'approved'
  LIMIT 1
$$;

-- Helper function: get user's resident id
CREATE OR REPLACE FUNCTION public.get_user_resident_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.residents
  WHERE user_id = _user_id AND status = 'approved'
  LIMIT 1
$$;

-- ============================================================
-- RESIDENTS table: owners can insert family/tenants for own unit
-- ============================================================

-- Owners can insert residents for their own unit
CREATE POLICY "Owners can insert residents for own unit"
ON public.residents FOR INSERT TO authenticated
WITH CHECK (
  unit_id IS NOT NULL
  AND public.is_unit_owner(auth.uid(), unit_id)
);

-- Members (owner+tenant) can view residents in their unit
CREATE POLICY "Members can view own unit residents"
ON public.residents FOR SELECT TO authenticated
USING (
  unit_id IS NOT NULL
  AND public.is_unit_member(auth.uid(), unit_id)
);

-- Owners can update residents in their own unit
CREATE POLICY "Owners can update own unit residents"
ON public.residents FOR UPDATE TO authenticated
USING (
  unit_id IS NOT NULL
  AND public.is_unit_owner(auth.uid(), unit_id)
);

-- ============================================================
-- VISITORS table: owners can insert for own unit, members can view
-- ============================================================

-- Owners can insert visitors for their unit
CREATE POLICY "Owners can insert visitors for own unit"
ON public.visitors FOR INSERT TO authenticated
WITH CHECK (
  visiting_unit_id IS NOT NULL
  AND public.is_unit_owner(auth.uid(), visiting_unit_id)
);

-- Members can view visitors for their unit
CREATE POLICY "Members can view own unit visitors"
ON public.visitors FOR SELECT TO authenticated
USING (
  visiting_unit_id IS NOT NULL
  AND public.is_unit_member(auth.uid(), visiting_unit_id)
);

-- ============================================================
-- VEHICLES table: owners can insert for own resident_id, members can view
-- ============================================================

-- Owners can insert vehicles linked to their resident record
CREATE POLICY "Owners can insert own vehicles"
ON public.vehicles FOR INSERT TO authenticated
WITH CHECK (
  resident_id IS NOT NULL
  AND resident_id = public.get_user_resident_id(auth.uid())
);

-- Members can view vehicles in their unit
CREATE POLICY "Members can view own unit vehicles"
ON public.vehicles FOR SELECT TO authenticated
USING (
  resident_id IN (
    SELECT id FROM public.residents
    WHERE unit_id = public.get_user_unit_id(auth.uid())
  )
);

-- ============================================================
-- HELPER_ASSIGNMENTS table: owners can insert for own unit, members can view
-- ============================================================

-- Owners can insert helper assignments for own unit
CREATE POLICY "Owners can insert helper assignments for own unit"
ON public.helper_assignments FOR INSERT TO authenticated
WITH CHECK (
  public.is_unit_owner(auth.uid(), unit_id)
);

-- Members can view helper assignments for their unit
CREATE POLICY "Members can view own unit helper assignments"
ON public.helper_assignments FOR SELECT TO authenticated
USING (
  public.is_unit_member(auth.uid(), unit_id)
);

-- ============================================================
-- HELPERS table: residents can view helpers in their assignments
-- ============================================================

-- Members can view helpers assigned to their unit
CREATE POLICY "Members can view helpers assigned to own unit"
ON public.helpers FOR SELECT TO authenticated
USING (
  id IN (
    SELECT helper_id FROM public.helper_assignments
    WHERE unit_id = public.get_user_unit_id(auth.uid())
  )
);
