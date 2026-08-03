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
import { toast } from "sonner";
import { APP_CONFIG } from "@/config/appConfig";
import { supabase } from "@/integrations/supabase/client";
import { signOut as authSignOut } from "@/services/authService";
import { setTenantDbName } from "@/services/tenantContext";
import {
  resolveUserRole,
  type TenantUserRole,
} from "@/services/tenantRouterService";

export type { TenantUserRole };

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  tenantRole: TenantUserRole | null;
  signOut: () => Promise<void>;
  refreshTenantRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  roleLoading: false,
  tenantRole: null,
  signOut: async () => {},
  refreshTenantRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [tenantRole, setTenantRole] = useState<TenantUserRole | null>(null);
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
        return;
      }

      setRoleLoading(true);
      accessDeniedHandled.current = false;

      const result = await resolveUserRole(activeSession.access_token);

      if (result.ok === false && result.status === 403) {
        if (!accessDeniedHandled.current) {
          accessDeniedHandled.current = true;
          toast.error(`You do not have access to ${APP_CONFIG.appName}`);
        }
        clearTenantRole();
        await authSignOut();
        setSession(null);
        return;
      }

      if (!result.ok) {
        console.error("[AuthContext] resolve-user-role failed:", result.error);
        clearTenantRole();
        return;
      }

      setTenantRole(result.data);
      setTenantDbName(result.data.tenantDbName || APP_CONFIG.appId);
      setRoleLoading(false);
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
    clearTenantRole();
    await authSignOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        roleLoading,
        tenantRole,
        signOut,
        refreshTenantRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
