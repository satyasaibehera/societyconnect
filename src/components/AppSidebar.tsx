import {
  Home,
  Users,
  UserCheck,
  Shield,
  Car,
  Ticket,
  QrCode,
  Bell,
  ClipboardList,
  MessageSquare,
  Vote,
  Calendar,
  FileText,
  Settings,
  Building2,
  Wrench,
  ClipboardCheck,
  Award,
  Heart,
  Eye,
  KeyRound,
  DoorOpen,
  CreditCard,
  IndianRupee,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { APP_CONFIG } from "@/config/appConfig";
import { APP_ROLE } from "@/types/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAccessControl } from "@/hooks/useAccessControl";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, moduleKey: "dashboard" },
  { title: "Approvals", url: "/approvals", icon: ClipboardCheck, moduleKey: "approvals" },
  { title: "Residents", url: "/residents", icon: Users, moduleKey: "residents" },
  { title: "Visitors", url: "/visitors", icon: UserCheck, moduleKey: "visitors" },
  { title: "Security", url: "/security", icon: Shield, moduleKey: "security" },
  { title: "Vehicles", url: "/vehicles", icon: Car, moduleKey: "vehicles" },
  { title: "Helpers", url: "/helpers", icon: Wrench, moduleKey: "helpers" },
  { title: "Payments", url: "/payments", icon: CreditCard, moduleKey: "payments" },
  { title: "Office Bearers", url: "/office-bearers", icon: Award, moduleKey: "office-bearers" },
];

const residentItems = [
  { title: "My Family", url: "/my-family", icon: Heart, moduleKey: "my-family" },
  { title: "My Visitors", url: "/my-visitors", icon: Eye, moduleKey: "my-visitors" },
  { title: "My Helpers", url: "/my-helpers", icon: Wrench, moduleKey: "my-helpers" },
  { title: "My Vehicles", url: "/my-vehicles", icon: Car, moduleKey: "my-vehicles" },
  { title: "My Tenants", url: "/my-tenants", icon: KeyRound, moduleKey: "my-tenants" },
  { title: "My Payments", url: "/my-payments", icon: IndianRupee, moduleKey: "my-payments" },
  { title: "My Approvals", url: "/my-gate-passes", icon: DoorOpen, moduleKey: "my-gate-passes" },
];

const communityItems = [
  { title: "Notices", url: "/notices", icon: ClipboardList, moduleKey: "notices" },
  { title: "Complaints", url: "/complaints", icon: MessageSquare, moduleKey: "complaints" },
  { title: "Voting", url: "/voting", icon: Vote, moduleKey: "voting" },
  { title: "Meetings", url: "/meetings", icon: Calendar, moduleKey: "meetings" },
  { title: "Resolutions", url: "/resolutions", icon: FileText, moduleKey: "resolutions" },
];

const systemItems = [
  { title: "Digital IDs", url: "/digital-ids", icon: QrCode, moduleKey: "digital-ids" },
  { title: "Vehicle Passes", url: "/vehicle-passes", icon: Ticket, moduleKey: "vehicle-passes" },
  { title: "Emergency", url: "/emergency", icon: Bell, moduleKey: "emergency" },
  { title: "Settings", url: "/settings", icon: Settings, moduleKey: "settings" },
];

type MenuItem = typeof mainItems[number];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { hasRole, loading: roleLoading } = useUserRole();
  const { hasAccess, loading: accessLoading } = useAccessControl();
  const isSuperAdmin = hasRole(APP_ROLE.SUPER_ADMIN);
  const isActive = (path: string) => location.pathname === path;

  const filterItems = (items: MenuItem[]) =>
    items.filter((item) => hasAccess(item.moduleKey));

  const renderGroup = (label: string, items: MenuItem[]) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest font-semibold">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <NavLink
                    to={item.url}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold text-sidebar-primary-foreground">
                {APP_CONFIG.appName}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">
                Society Management
              </span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {renderGroup("Management", mainItems)}
        {renderGroup("Resident", residentItems)}
        {renderGroup("Community", communityItems)}
        {renderGroup("System", systemItems)}

        {/* Access Control - Super Admin only */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest font-semibold">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/access-control")}>
                    <NavLink
                      to="/access-control"
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Access Control</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
            <p className="text-xs text-sidebar-foreground/70">
              New resident?
            </p>
            <NavLink
              to="/register-resident"
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Register for Your Flat →
            </NavLink>
          </div>
        )}
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs text-sidebar-foreground/70">
              Need help setting up?
            </p>
            <NavLink
              to="/onboarding"
              className="mt-1 text-xs font-medium text-sidebar-primary hover:underline"
            >
              Run Setup Wizard →
            </NavLink>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
