
-- Fix SEC-2: Restrict profiles PII exposure
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Other authenticated users can only see name and avatar (via a view or by allowing select but the sensitive columns are handled at app level)
-- Since RLS is row-level not column-level, we create a policy that allows admins to see all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
);
