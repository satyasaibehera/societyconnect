-- Approval status type
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Residents table
CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  age INTEGER,
  resident_type TEXT NOT NULL DEFAULT 'owner' CHECK (resident_type IN ('owner', 'tenant')),
  photo_url TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents viewable by authenticated" ON public.residents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage residents" ON public.residents
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage society residents" ON public.residents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own resident record" ON public.residents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_residents_updated_at
  BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Visitors table
CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  visiting_unit_id UUID REFERENCES public.units(id),
  visiting_unit_label TEXT,
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  purpose TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visitors viewable by authenticated" ON public.visitors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage visitors" ON public.visitors
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage visitors" ON public.visitors
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can create visitors" ON public.visitors
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Domestic helpers table
CREATE TABLE public.helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  service_type TEXT,
  photo_url TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helpers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Helpers viewable by authenticated" ON public.helpers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage helpers" ON public.helpers
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage helpers" ON public.helpers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can create helpers" ON public.helpers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE TRIGGER update_helpers_updated_at
  BEFORE UPDATE ON public.helpers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper-unit assignments
CREATE TABLE public.helper_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  helper_id UUID NOT NULL REFERENCES public.helpers(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helper_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Helper assignments viewable by authenticated" ON public.helper_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage helper assignments" ON public.helper_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT CHECK (vehicle_type IN ('car', 'bike', 'other')),
  parking_slot TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicles viewable by authenticated" ON public.vehicles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage vehicles" ON public.vehicles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage vehicles" ON public.vehicles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Role requests (for admin/super admin onboarding approval)
CREATE TABLE public.role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role app_role NOT NULL,
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE,
  reason TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own role requests" ON public.role_requests
  FOR SELECT USING (auth.uid() = requester_id);
CREATE POLICY "Users can create own role requests" ON public.role_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Super admins can manage all role requests" ON public.role_requests
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can view society role requests" ON public.role_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update society role requests" ON public.role_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_role_requests_updated_at
  BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notices table
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notices viewable by authenticated" ON public.notices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage notices" ON public.notices
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage notices" ON public.notices
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Complaints table
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES public.residents(id),
  category TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Complaints viewable by authenticated" ON public.complaints
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage complaints" ON public.complaints
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage complaints" ON public.complaints
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Voting polls
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Polls viewable by authenticated" ON public.polls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage polls" ON public.polls
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage polls" ON public.polls
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Votes
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES public.residents(id),
  vote_option TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, resident_id)
);
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes viewable by authenticated" ON public.votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage votes" ON public.votes
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  agenda TEXT,
  meeting_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meetings viewable by authenticated" ON public.meetings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage meetings" ON public.meetings
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage meetings" ON public.meetings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Resolutions
CREATE TABLE public.resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  decision_date DATE,
  related_poll_id UUID REFERENCES public.polls(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resolutions viewable by authenticated" ON public.resolutions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage resolutions" ON public.resolutions
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage resolutions" ON public.resolutions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Security staff table
CREATE TABLE public.security_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.security_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security staff viewable by authenticated" ON public.security_staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage security staff" ON public.security_staff
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage security staff" ON public.security_staff
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));