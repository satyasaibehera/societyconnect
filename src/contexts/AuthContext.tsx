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
import { AlertTriangle, Building2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { APP_CONFIG } from "@/config/appConfig";
import { supabase } from "@/integrations/supabase/client";
import { clearStaleAuthTokens, signOut as authSignOut } from "@/services/authService";
import { setTenantDbName } from "@/services/tenantContext";
import {
  resolveUserRole,
  TENANT_MAPPING_NOT_FOUND,
  TenantRouterError,
  type TenantUserRole,
} from "@/services/tenantRouterService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type { TenantUserRole };

export const TENANT_MAPPING_DEFAULT_MESSAGE =
  "Your account exists, but you have not been assigned to a society yet. Please contact your administrator.";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  tenantRole: TenantUserRole | null;
  /** Server-provided error message from role resolution, when applicable. */
  authError: string | null;
  /** Machine-readable error code from the tenant router (e.g. TENANT_MAPPING_NOT_FOUND). */
  authErrorCode: string | null;
  isAuthenticated: boolean;
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
  authErrorCode: null,
  isAuthenticated: false,
  signOut: async () => {},
  refreshTenantRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function isInvalidAccessTokenError(err: TenantRouterError): boolean {
  if (err.status === 401) return true;
  const haystack = [
    err.message,
    typeof err.errorData.error === "string" ? err.errorData.error : "",
    typeof err.errorData.message === "string" ? err.errorData.message : "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes("invalid access token");
}

function TenantMappingErrorBanner({
  message,
  onSignOut,
}: {
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full p-6 space-y-5">
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/5 text-foreground">
          <Building2 className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Society assignment required
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">{message}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onSignOut} className="w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </Card>
    </div>
  );
}

function AuthResolutionErrorBanner({
  message,
  onSignOut,
}: {
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full p-6 space-y-5">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to verify access</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const accessDeniedHandled = useRef(false);

  const clearTenantRole = useCallback(() => {
    setTenantRole(null);
    setTenantDbName(null);
  }, []);

  const resetAuthErrors = useCallback(() => {
    setAuthError(null);
    setAuthErrorCode(null);
  }, []);

  const finishLoading = useCallback(() => {
    setRoleLoading(false);
    setLoading(false);
  }, []);

  const handleInvalidSession = useCallback(async () => {
    await clearStaleAuthTokens();
    setSession(null);
    resetAuthErrors();
    clearTenantRole();
    finishLoading();
  }, [clearTenantRole, finishLoading, resetAuthErrors]);

  const loadTenantRole = useCallback(
    async (activeSession: Session | null) => {
      if (!activeSession?.access_token) {
        clearTenantRole();
        resetAuthErrors();
        finishLoading();
        return;
      }

      setRoleLoading(true);
      resetAuthErrors();
      accessDeniedHandled.current = false;

      try {
        const data = await resolveUserRole(activeSession.access_token);
        setTenantRole(data);
        setTenantDbName(data.tenantDbName || APP_CONFIG.appId);
      } catch (err) {
        if (err instanceof TenantRouterError && err.code === TENANT_MAPPING_NOT_FOUND) {
          setAuthError(err.message || TENANT_MAPPING_DEFAULT_MESSAGE);
          setAuthErrorCode(TENANT_MAPPING_NOT_FOUND);
          clearTenantRole();
          return;
        }

        if (err instanceof TenantRouterError && isInvalidAccessTokenError(err)) {
          console.warn("[AuthContext] Invalid or expired access token; clearing session.");
          await handleInvalidSession();
          return;
        }

        if (err instanceof TenantRouterError && err.status === 403) {
          if (!accessDeniedHandled.current) {
            accessDeniedHandled.current = true;
            toast.error(`You do not have access to ${APP_CONFIG.appName}`);
          }
          resetAuthErrors();
          clearTenantRole();
          await authSignOut();
          setSession(null);
          return;
        }

        const fallbackMessage =
          err instanceof TenantRouterError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unable to verify your access. Please try again.";

        console.error("[AuthContext] resolve-user-role failed:", err);
        setAuthError(fallbackMessage);
        setAuthErrorCode("ROLE_RESOLUTION_FAILED");
        clearTenantRole();
      } finally {
        finishLoading();
      }
    },
    [clearTenantRole, finishLoading, handleInvalidSession, resetAuthErrors],
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
    resetAuthErrors();
    clearTenantRole();
    finishLoading();
    await authSignOut();
    setSession(null);
  };

  const isAuthenticated = session !== null;
  const showTenantMappingBanner = authErrorCode === TENANT_MAPPING_NOT_FOUND;
  const showResolutionErrorBanner =
    authErrorCode === "ROLE_RESOLUTION_FAILED" && Boolean(authError);

  const contextValue: AuthContextType = {
    session,
    user: session?.user ?? null,
    loading,
    roleLoading,
    tenantRole,
    authError,
    authErrorCode,
    isAuthenticated,
    signOut,
    refreshTenantRole,
  };

  if (showTenantMappingBanner) {
    return (
      <AuthContext.Provider value={{ ...contextValue, roleLoading: false, loading: false }}>
        <TenantMappingErrorBanner
          message={authError || TENANT_MAPPING_DEFAULT_MESSAGE}
          onSignOut={() => void signOut()}
        />
      </AuthContext.Provider>
    );
  }

  if (showResolutionErrorBanner) {
    return (
      <AuthContext.Provider value={{ ...contextValue, roleLoading: false, loading: false }}>
        <AuthResolutionErrorBanner
          message={authError!}
          onSignOut={() => void signOut()}
        />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
