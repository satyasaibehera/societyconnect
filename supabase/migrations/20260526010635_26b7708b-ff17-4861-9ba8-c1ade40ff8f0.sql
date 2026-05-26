
-- =====================================================================
-- 1. Society-membership helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_society_member(_user_id uuid, _society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL AND _society_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.residents
              WHERE user_id = _user_id AND society_id = _society_id AND status = 'approved')
      OR EXISTS (SELECT 1 FROM public.office_bearers
                 WHERE user_id = _user_id AND society_id = _society_id)
      OR EXISTS (SELECT 1 FROM public.security_staff
                 WHERE user_id = _user_id AND society_id = _society_id)
      OR EXISTS (SELECT 1 FROM public.societies
                 WHERE id = _society_id AND created_by = _user_id)
      OR public.has_role(_user_id, 'super_admin'::app_role)
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_society_member(uuid, uuid) FROM anon;

-- =====================================================================
-- 2. Drop blanket "viewable by authenticated" policies
-- =====================================================================
DROP POLICY IF EXISTS "Residents viewable by authenticated"           ON public.residents;
DROP POLICY IF EXISTS "Helpers viewable by authenticated"             ON public.helpers;
DROP POLICY IF EXISTS "Helper assignments viewable by authenticated"  ON public.helper_assignments;
DROP POLICY IF EXISTS "Vehicles viewable by authenticated"            ON public.vehicles;
DROP POLICY IF EXISTS "Vehicle passes viewable by authenticated"      ON public.vehicle_passes;
DROP POLICY IF EXISTS "Visitors viewable by authenticated"            ON public.visitors;
DROP POLICY IF EXISTS "Office bearers viewable by authenticated"      ON public.office_bearers;
DROP POLICY IF EXISTS "Security staff viewable by authenticated"      ON public.security_staff;
DROP POLICY IF EXISTS "Payment categories viewable by authenticated"  ON public.payment_categories;
DROP POLICY IF EXISTS "Complaints viewable by authenticated"          ON public.complaints;

-- =====================================================================
-- 3. Replacement scoped SELECT policies
-- =====================================================================

-- residents: members of own unit + society admins + super admins (kept existing scoped policies)
CREATE POLICY "Society admins can view society residents"
ON public.residents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_society_member(auth.uid(), society_id));

-- helpers: members whose unit the helper is assigned to, plus admins
CREATE POLICY "Society admins can view society helpers"
ON public.helpers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_society_member(auth.uid(), society_id));

-- helper_assignments: scoped via existing "Members can view own unit helper assignments"; add admin/super admin
CREATE POLICY "Society admins can view helper assignments"
ON public.helper_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.buildings b ON b.id = u.building_id
    WHERE u.id = helper_assignments.unit_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
      AND public.is_society_member(auth.uid(), b.society_id)
  )
);

-- vehicles: existing "Members can view own unit vehicles" remains; add admins
CREATE POLICY "Society admins can view vehicles"
ON public.vehicles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_society_member(auth.uid(), society_id));

-- vehicle_passes: requester / unit members / society admins / super admins
CREATE POLICY "Requesters can view own vehicle passes"
ON public.vehicle_passes FOR SELECT TO authenticated
USING (requested_by = auth.uid());

CREATE POLICY "Unit members can view unit vehicle passes"
ON public.vehicle_passes FOR SELECT TO authenticated
USING (unit_id IS NOT NULL AND public.is_unit_member(auth.uid(), unit_id));

CREATE POLICY "Society admins can view society vehicle passes"
ON public.vehicle_passes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_society_member(auth.uid(), society_id));

CREATE POLICY "Security can view society vehicle passes"
ON public.vehicle_passes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'security'::app_role) AND public.is_society_member(auth.uid(), society_id));

-- visitors: existing "Members can view own unit visitors" remains; add creator + admins
CREATE POLICY "Creators can view own visitors"
ON public.visitors FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Society admins can view society visitors"
ON public.visitors FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_society_member(auth.uid(), society_id));

CREATE POLICY "Security can view society visitors"
ON public.visitors FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'security'::app_role) AND public.is_society_member(auth.uid(), society_id));

-- office_bearers: members of same society
CREATE POLICY "Society members can view office bearers"
ON public.office_bearers FOR SELECT TO authenticated
USING (public.is_society_member(auth.uid(), society_id));

-- security_staff: members of same society
CREATE POLICY "Society members can view security staff"
ON public.security_staff FOR SELECT TO authenticated
USING (public.is_society_member(auth.uid(), society_id));

-- payment_categories: members of same society only (contains bank details)
CREATE POLICY "Society members can view payment categories"
ON public.payment_categories FOR SELECT TO authenticated
USING (public.is_society_member(auth.uid(), society_id));

-- complaints: complainant + society admins + super admins
CREATE POLICY "Complainants can view own complaints"
ON public.complaints FOR SELECT TO authenticated
USING (
  resident_id IS NOT NULL
  AND resident_id IN (
    SELECT id FROM public.residents WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Society admins can view society complaints"
ON public.complaints FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_society_member(auth.uid(), society_id));

CREATE POLICY "Super admins can view all complaints"
ON public.complaints FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- =====================================================================
-- 4. move_passes: switch SELECT/INSERT policies from `public` to `authenticated`
-- =====================================================================
DROP POLICY IF EXISTS "Unit members can view unit move passes" ON public.move_passes;
DROP POLICY IF EXISTS "Users can view own move passes"        ON public.move_passes;
DROP POLICY IF EXISTS "Authenticated can create move passes"  ON public.move_passes;
DROP POLICY IF EXISTS "Unit approvers can update move passes" ON public.move_passes;

CREATE POLICY "Unit members can view unit move passes"
ON public.move_passes FOR SELECT TO authenticated
USING (public.is_unit_member(auth.uid(), unit_id));

CREATE POLICY "Users can view own move passes"
ON public.move_passes FOR SELECT TO authenticated
USING (requested_by = auth.uid());

CREATE POLICY "Authenticated can create move passes"
ON public.move_passes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Unit approvers can update move passes"
ON public.move_passes FOR UPDATE TO authenticated
USING (public.is_unit_approver(auth.uid(), unit_id));

-- =====================================================================
-- 5. Storage: resident-photos bucket — restrict writes to owner folder
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can upload resident photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resident photos"           ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resident photos"           ON storage.objects;

CREATE POLICY "Users can upload resident photos in own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resident-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own resident photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own resident photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resident-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
