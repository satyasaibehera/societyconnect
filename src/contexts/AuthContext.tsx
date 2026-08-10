import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { AlertTriangle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { APP_CONFIG } from "@/config/appConfig";
import { isPublicAuthPath } from "@/lib/authRoutes";
import { supabase } from "@/integrations/supabase/client";
import { clearStaleAuthTokens, signOut as authSignOut } from "@/services/authService";
import {
  clearTenantContext,
  setSessionAccessToken,
  setTenantDbName,
} from "@/services/tenantContext";
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
import type { AppRole } from "@/types/auth";

export type { TenantUserRole } from "@/services/tenantRouterService";
export type { AppRole };
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
  /** Apply a fresh Supabase session immediately after password login. */
  completeSignIn: (session: Session) => Promise<void>;
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
  completeSignIn: async () => {},
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

function syncSessionToken(session: Session | null): void {
  setSessionAccessToken(session?.access_token ?? null);
}

function shouldResolveTenantRole(
  event: AuthChangeEvent | "MANUAL",
  pathname: string,
  session: Session | null,
): boolean {
  const token = session?.access_token?.trim();
  if (!token) return false;

  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
    return true;
  }

  if (event === "MANUAL") {
    return true;
  }

  // INITIAL_SESSION / PASSWORD_RECOVERY / etc. — skip on public auth screens.
  if (isPublicAuthPath(pathname)) {
    return false;
  }

  return true;
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
  const location = useLocation();
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
    clearTenantContext();
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
    syncSessionToken(null);
    resetAuthErrors();
    clearTenantRole();
    finishLoading();
  }, [clearTenantRole, finishLoading, resetAuthErrors]);

  const loadTenantRole = useCallback(
    async (activeSession: Session | null) => {
      const accessToken = activeSession?.access_token?.trim();

      if (!accessToken) {
        syncSessionToken(null);
        clearTenantRole();
        resetAuthErrors();
        finishLoading();
        return;
      }

      syncSessionToken(accessToken);
      setRoleLoading(true);
      resetAuthErrors();
      accessDeniedHandled.current = false;

      try {
        const data = await resolveUserRole(accessToken);
        setTenantRole(data);
        setTenantDbName(data.tenantDbName || APP_CONFIG.appId);
        clearLoginBannerError();
      } catch (err) {
        if (err instanceof TenantRouterError && err.code === TENANT_MAPPING_NOT_FOUND) {
          setLoginBannerError(LOGIN_BANNER_TENANT_MAPPING);
          clearTenantRole();
          await authSignOut();
          setSession(null);
          syncSessionToken(null);
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
          syncSessionToken(null);
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
    syncSessionToken(currentSession?.access_token ?? null);
    await loadTenantRole(currentSession);
  }, [loadTenantRole]);

  const completeSignIn = useCallback(
    async (nextSession: Session) => {
      setSession(nextSession);
      syncSessionToken(nextSession.access_token ?? null);
      setLoading(false);
      await loadTenantRole(nextSession);
    },
    [loadTenantRole],
  );

  useEffect(() => {
    const pathname = location.pathname;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      syncSessionToken(nextSession?.access_token ?? null);
      setLoading(false);

      if (!shouldResolveTenantRole(event, pathname, nextSession)) {
        if (!nextSession?.access_token?.trim()) {
          clearTenantRole();
        }
        finishLoading();
        return;
      }

      void loadTenantRole(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      syncSessionToken(initialSession?.access_token ?? null);
      setLoading(false);

      if (!shouldResolveTenantRole("INITIAL_SESSION", pathname, initialSession)) {
        if (!initialSession?.access_token?.trim()) {
          clearTenantRole();
        }
        finishLoading();
        return;
      }

      void loadTenantRole(initialSession);
    });

    return () => subscription.unsubscribe();
  }, [clearTenantRole, finishLoading, loadTenantRole, location.pathname]);

  const signOut = async () => {
    resetAuthErrors();
    clearTenantRole();
    finishLoading();
    await authSignOut();
    setSession(null);
    syncSessionToken(null);
  };

  const isAuthenticated = Boolean(session?.access_token?.trim());
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
    completeSignIn,
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
