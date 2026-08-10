import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppRole } from "@/types/auth";
import { APP_ROLE } from "@/types/auth";
import {
  DEFAULT_ADMIN_CONTEXT_ROLE,
  isPlatformAdminContextRole,
  isSocietyScopedAppRole,
} from "@/config/roleMapping";
import {
  clearAdminContextSnapshot,
  setAdminContextSnapshot,
} from "@/services/adminContextStore";
import { useAuth } from "@/contexts/AuthContext";

type AdminContextValue = {
  /** Active context role — defaults to platform super_admin view. */
  contextRole: AppRole;
  impersonatedRole: AppRole | null;
  selectedTenantId: string | null;
  selectedUserId: string | null;
  isPlatformView: boolean;
  showSocietySelector: boolean;
  showUserSelector: boolean;
  setContextRole: (role: AppRole) => void;
  setSelectedTenantId: (tenantId: string | null) => void;
  setSelectedUserId: (userId: string | null) => void;
  resetContext: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminContextProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [contextRole, setContextRoleState] = useState<AppRole>(DEFAULT_ADMIN_CONTEXT_ROLE);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserIdState] = useState<string | null>(null);

  const impersonatedRole = isPlatformAdminContextRole(contextRole) ? null : contextRole;

  const syncStore = useCallback(
    (next: {
      impersonatedRole: AppRole | null;
      selectedTenantId: string | null;
      selectedUserId: string | null;
    }) => {
      setAdminContextSnapshot(next);
    },
    [],
  );

  useEffect(() => {
    syncStore({ impersonatedRole, selectedTenantId, selectedUserId });
  }, [impersonatedRole, selectedTenantId, selectedUserId, syncStore]);

  useEffect(() => {
    return () => {
      clearAdminContextSnapshot();
    };
  }, []);

  const setContextRole = useCallback((role: AppRole) => {
    setContextRoleState(role);
    setSelectedTenantIdState(null);
    setSelectedUserIdState(null);
  }, []);

  const setSelectedTenantId = useCallback((tenantId: string | null) => {
    setSelectedTenantIdState(tenantId);
    setSelectedUserIdState(null);
  }, []);

  const setSelectedUserId = useCallback((userId: string | null) => {
    setSelectedUserIdState(userId);
  }, []);

  const resetContext = useCallback(() => {
    setContextRoleState(DEFAULT_ADMIN_CONTEXT_ROLE);
    setSelectedTenantIdState(null);
    setSelectedUserIdState(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      resetContext();
    }
  }, [isAuthenticated, resetContext]);

  const isPlatformView = contextRole === DEFAULT_ADMIN_CONTEXT_ROLE;
  const showSocietySelector = isSocietyScopedAppRole(contextRole);
  const showUserSelector = contextRole === APP_ROLE.RESIDENT && Boolean(selectedTenantId);

  const value = useMemo<AdminContextValue>(
    () => ({
      contextRole,
      impersonatedRole,
      selectedTenantId,
      selectedUserId,
      isPlatformView,
      showSocietySelector,
      showUserSelector,
      setContextRole,
      setSelectedTenantId,
      setSelectedUserId,
      resetContext,
    }),
    [
      contextRole,
      impersonatedRole,
      selectedTenantId,
      selectedUserId,
      isPlatformView,
      showSocietySelector,
      showUserSelector,
      setContextRole,
      setSelectedTenantId,
      setSelectedUserId,
      resetContext,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext must be used within AdminContextProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside the provider (e.g. api-adjacent utilities). */
export function useAdminContextOptional(): AdminContextValue | null {
  return useContext(AdminContext);
}
