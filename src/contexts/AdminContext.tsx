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
  value: AppRole | "platform";
};

export const IMPERSONATION_ROLE_OPTIONS: ImpersonationRoleOption[] = [
  { label: "Platform Admin (super_admin)", value: "platform" },
  { label: "Society Admin (admin)", value: "admin" },
  { label: "Office Bearer (office_bearer)", value: "office_bearer" },
  { label: "Resident (resident)", value: "resident" },
  { label: "Security Guard (security)", value: "security" },
];

export const SOCIETY_SCOPED_ROLES: AppRole[] = [
  "admin",
  "office_bearer",
  "resident",
  "security",
];

type AdminContextValue = {
  impersonatedRole: AppRole | null;
  selectedTenantId: string | null;
  selectedUserId: string | null;
  isPlatformView: boolean;
  showSocietySelector: boolean;
  showUserSelector: boolean;
  setImpersonatedRole: (role: AppRole | null) => void;
  setSelectedTenantId: (tenantId: string | null) => void;
  setSelectedUserId: (userId: string | null) => void;
  resetContext: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminContextProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [impersonatedRole, setImpersonatedRoleState] = useState<AppRole | null>(null);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserIdState] = useState<string | null>(null);

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

  const setImpersonatedRole = useCallback(
    (role: AppRole | null) => {
      setImpersonatedRoleState(role);
      setSelectedTenantIdState(null);
      setSelectedUserIdState(null);
    },
    [],
  );

  const setSelectedTenantId = useCallback((tenantId: string | null) => {
    setSelectedTenantIdState(tenantId);
    setSelectedUserIdState(null);
  }, []);

  const setSelectedUserId = useCallback((userId: string | null) => {
    setSelectedUserIdState(userId);
  }, []);

  const resetContext = useCallback(() => {
    setImpersonatedRoleState(null);
    setSelectedTenantIdState(null);
    setSelectedUserIdState(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      resetContext();
    }
  }, [isAuthenticated, resetContext]);

  const isPlatformView = impersonatedRole === null;
  const showSocietySelector =
    impersonatedRole !== null && SOCIETY_SCOPED_ROLES.includes(impersonatedRole);
  const showUserSelector = impersonatedRole === "resident" && Boolean(selectedTenantId);

  const value = useMemo<AdminContextValue>(
    () => ({
      impersonatedRole,
      selectedTenantId,
      selectedUserId,
      isPlatformView,
      showSocietySelector,
      showUserSelector,
      setImpersonatedRole,
      setSelectedTenantId,
      setSelectedUserId,
      resetContext,
    }),
    [
      impersonatedRole,
      selectedTenantId,
      selectedUserId,
      isPlatformView,
      showSocietySelector,
      showUserSelector,
      setImpersonatedRole,
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
