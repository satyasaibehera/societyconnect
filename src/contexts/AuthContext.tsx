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
import { AlertTriangle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { APP_CONFIG } from "@/config/appConfig";
import { supabase } from "@/integrations/supabase/client";
import { clearStaleAuthTokens, signOut as authSignOut } from "@/services/authService";
import { setTenantDbName } from "@/services/tenantContext";
import {
  INVALID_AUTH_TOKEN,
  LOGIN_BANNER_INVALID_CREDENTIALS,
  LOGIN_BANNER_TENANT_MAPPING,
  resolveUserRole,
  TENANT_MAPPING_NOT_FOUND,
  TenantRouterError,
  type TenantUserRole,
} from "@/services/tenantRouterService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type { TenantUserRole };
export {
  LOGIN_BANNER_INVALID_CREDENTIALS,
  LOGIN_BANNER_TENANT_MAPPING,
} from "@/services/tenantRouterService";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  tenantRole: TenantUserRole | null;
  authError: string | null;
  authErrorCode: string | null;
  /** User-facing banner message for the login page. */
  loginBannerError: string | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshTenantRole: () => Promise<void>;
  clearLoginBannerError: () => void;
  setLoginBannerError: (message: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  roleLoading: false,
  tenantRole: null,
  authError: null,
  authErrorCode: null,
  loginBannerError: null,
  isAuthenticated: false,
  signOut: async () => {},
  refreshTenantRole: async () => {},
  clearLoginBannerError: () => {},
  setLoginBannerError: () => {},
});

export const useAuth = () => useContext(AuthContext);

function isInvalidAccessTokenError(err: TenantRouterError): boolean {
  if (err.status === 401) return true;
  if (err.code === INVALID_AUTH_TOKEN) return true;
  const haystack = [
    err.message,
    typeof err.errorData.error === "string" ? err.errorData.error : "",
    typeof err.errorData.message === "string" ? err.errorData.message : "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes("invalid access token");
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
  const [loginBannerError, setLoginBannerError] = useState<string | null>(null);
  const accessDeniedHandled = useRef(false);

  const clearTenantRole = useCallback(() => {
    setTenantRole(null);
    setTenantDbName(null);
  }, []);

  const resetAuthErrors = useCallback(() => {
    setAuthError(null);
    setAuthErrorCode(null);
  }, []);

  const clearLoginBannerError = useCallback(() => {
    setLoginBannerError(null);
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
        clearLoginBannerError();
      } catch (err) {
        if (err instanceof TenantRouterError && err.code === TENANT_MAPPING_NOT_FOUND) {
          setLoginBannerError(LOGIN_BANNER_TENANT_MAPPING);
          clearTenantRole();
          await authSignOut();
          setSession(null);
          resetAuthErrors();
          return;
        }

        if (err instanceof TenantRouterError && isInvalidAccessTokenError(err)) {
          console.error("[AuthContext] ❌ Primary Authentication Failed.");
          setLoginBannerError(LOGIN_BANNER_INVALID_CREDENTIALS);
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
    [clearLoginBannerError, clearTenantRole, finishLoading, handleInvalidSession, resetAuthErrors],
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
    loginBannerError,
    isAuthenticated,
    signOut,
    refreshTenantRole,
    clearLoginBannerError,
    setLoginBannerError,
  };

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
