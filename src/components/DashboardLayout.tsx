import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Search, LogOut, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationBell } from "@/components/NotificationBell";
import { useUserRole } from "@/hooks/useUserRole";
import { mapToDisplayRole, APP_ROLE } from "@/config/roleMapping";
import { AdminContextBar } from "@/components/admin/AdminContextBar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { roles, hasRole } = useUserRole();
  const isSuperAdmin = hasRole(APP_ROLE.SUPER_ADMIN);

  const roleLabel = roles.length > 0
    ? roles.map((r) => mapToDisplayRole(r)).join(", ")
    : "Member";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="shrink-0" />
              {title && (
                <h1 className="font-display text-lg font-semibold truncate">
                  {title}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="w-48 lg:w-64 pl-9 h-9 bg-secondary border-0"
                />
              </div>
              <NotificationBell />
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open profile menu"
                    className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                  >
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    {!isSuperAdmin && (
                      <p className="text-xs text-muted-foreground">{roleLabel}</p>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <AdminContextBar />
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile & Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
