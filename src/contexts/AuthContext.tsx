import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Building2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { APP_CONFIG } from "@/config/appConfig";
import { supabase } from "@/integrations/supabase/client";
import { signOut as authSignOut } from "@/services/authService";
import { setTenantDbName } from "@/services/tenantContext";
import {
  resolveUserRole,
  TENANT_MAPPING_NOT_FOUND,
  TenantRouterError,
  type TenantUserRole,
} from "@/services/tenantRouterService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type { TenantUserRole };

export type AuthErrorCode = typeof TENANT_MAPPING_NOT_FOUND | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  tenantRole: TenantUserRole | null;
  authError: AuthErrorCode;
  signOut: () => Promise<void>;
  refreshTenantRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  roleLoading: false,
  tenantRole: null,
  authError: null,
  signOut: async () => {},
  refreshTenantRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function TenantMappingNotFoundScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Building2 className="h-7 w-7 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold">Society assignment required</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account exists, but you have not been assigned to a society yet. Please contact
            your administrator.
          </p>
        </div>
        <Button variant="outline" onClick={onSignOut} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </Card>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [tenantRole, setTenantRole] = useState<TenantUserRole | null>(null);
  const [authError, setAuthError] = useState<AuthErrorCode>(null);
  const accessDeniedHandled = useRef(false);

  const clearTenantRole = useCallback(() => {
    setTenantRole(null);
    setRoleLoading(false);
    setTenantDbName(null);
  }, []);

  const loadTenantRole = useCallback(
    async (activeSession: Session | null) => {
      if (!activeSession?.access_token) {
        clearTenantRole();
        setAuthError(null);
        return;
      }

      setRoleLoading(true);
      setAuthError(null);
      accessDeniedHandled.current = false;

      try {
        const data = await resolveUserRole(activeSession.access_token);
        setTenantRole(data);
        setTenantDbName(data.tenantDbName || APP_CONFIG.appId);
      } catch (err) {
        if (err instanceof TenantRouterError && err.code === TENANT_MAPPING_NOT_FOUND) {
          setAuthError(TENANT_MAPPING_NOT_FOUND);
          clearTenantRole();
          return;
        }

        if (err instanceof TenantRouterError && err.status === 403) {
          if (!accessDeniedHandled.current) {
            accessDeniedHandled.current = true;
            toast.error(`You do not have access to ${APP_CONFIG.appName}`);
          }
          clearTenantRole();
          setAuthError(null);
          await authSignOut();
          setSession(null);
          return;
        }

        console.error("[AuthContext] resolve-user-role failed:", err);
        clearTenantRole();
        setAuthError(null);
      } finally {
        setRoleLoading(false);
      }
    },
    [clearTenantRole],
  );

  const refreshTenantRole = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    setSession(currentSession);
    await loadTenantRole(currentSession);
  }, [loadTenantRole]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void loadTenantRole(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setLoading(false);
      void loadTenantRole(initialSession);
    });

    return () => subscription.unsubscribe();
  }, [loadTenantRole]);

  const signOut = async () => {
    setAuthError(null);
    clearTenantRole();
    await authSignOut();
    setSession(null);
  };

  if (authError === TENANT_MAPPING_NOT_FOUND) {
    return (
      <AuthContext.Provider
        value={{
          session,
          user: session?.user ?? null,
          loading,
          roleLoading: false,
          tenantRole: null,
          authError,
          signOut,
          refreshTenantRole,
        }}
      >
        <TenantMappingNotFoundScreen onSignOut={() => void signOut()} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        roleLoading,
        tenantRole,
        authError,
        signOut,
        refreshTenantRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
