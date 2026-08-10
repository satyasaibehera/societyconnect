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
import {
  clearAdminContextSnapshot,
  setAdminContextSnapshot,
} from "@/services/adminContextStore";
import { useAuth } from "@/contexts/AuthContext";

export type ImpersonationRoleOption = {
  label: string;
  value: AppRole;
};

export const IMPERSONATION_ROLE_OPTIONS: ImpersonationRoleOption[] = [
  { label: "Platform Admin", value: "super_admin" },
  { label: "Society Admin", value: "admin" },
  { label: "Office Bearer", value: "office_bearer" },
  { label: "Resident", value: "resident" },
  { label: "Security Guard", value: "security" },
];

export const SOCIETY_SCOPED_ROLES: AppRole[] = [
  "admin",
  "office_bearer",
  "resident",
  "security",
];

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

const DEFAULT_CONTEXT_ROLE: AppRole = "super_admin";

export function AdminContextProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [contextRole, setContextRoleState] = useState<AppRole>(DEFAULT_CONTEXT_ROLE);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserIdState] = useState<string | null>(null);

  const impersonatedRole = contextRole === "super_admin" ? null : contextRole;

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
    setContextRoleState(DEFAULT_CONTEXT_ROLE);
    setSelectedTenantIdState(null);
    setSelectedUserIdState(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      resetContext();
    }
  }, [isAuthenticated, resetContext]);

  const isPlatformView = contextRole === "super_admin";
  const showSocietySelector = SOCIETY_SCOPED_ROLES.includes(contextRole);
  const showUserSelector = contextRole === "resident" && Boolean(selectedTenantId);

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
