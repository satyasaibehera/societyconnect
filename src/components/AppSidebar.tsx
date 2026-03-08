import {
  Home,
  Users,
  UserCheck,
  Shield,
  Car,
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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
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
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Approvals", url: "/approvals", icon: ClipboardCheck },
  { title: "Residents", url: "/residents", icon: Users },
  { title: "Visitors", url: "/visitors", icon: UserCheck },
  { title: "Security", url: "/security", icon: Shield },
  { title: "Vehicles", url: "/vehicles", icon: Car },
  { title: "Helpers", url: "/helpers", icon: Wrench },
];

const communityItems = [
  { title: "Notices", url: "/notices", icon: ClipboardList },
  { title: "Complaints", url: "/complaints", icon: MessageSquare },
  { title: "Voting", url: "/voting", icon: Vote },
  { title: "Meetings", url: "/meetings", icon: Calendar },
  { title: "Resolutions", url: "/resolutions", icon: FileText },
];

const systemItems = [
  { title: "Digital IDs", url: "/digital-ids", icon: QrCode },
  { title: "Emergency", url: "/emergency", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isManagement, loading: roleLoading } = useUserRole();
  const isActive = (path: string) => location.pathname === path;

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest font-semibold">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
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
                SocietyConnect
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">
                Society Management
              </span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {isManagement && renderGroup("Management", mainItems)}
        {renderGroup("Community", communityItems)}
        {renderGroup("System", systemItems)}
      </SidebarContent>

      <SidebarFooter className="p-4">
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
