import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, RotateCcw, Shield, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminContext } from "@/contexts/AdminContext";
import {
  getAdminContextRoleOptions,
  isPlatformAdminContextRole,
  mapToDisplayRole,
} from "@/config/roleMapping";
import {
  fetchPlatformSocieties,
  fetchPlatformSocietyResidents,
  type PlatformResident,
  type PlatformSociety,
} from "@/lib/api/platform";
import type { AppRole } from "@/types/auth";

export function AdminContextBar() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    contextRole,
    selectedTenantId,
    selectedUserId,
    isPlatformView,
    showSocietySelector,
    showUserSelector,
    setContextRole,
    setSelectedTenantId,
    setSelectedUserId,
    resetContext,
  } = useAdminContext();

  const roleOptions = useMemo(() => getAdminContextRoleOptions(), []);

  const [societies, setSocieties] = useState<PlatformSociety[]>([]);
  const [residents, setResidents] = useState<PlatformResident[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(false);
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [societyError, setSocietyError] = useState<string | null>(null);
  const [residentError, setResidentError] = useState<string | null>(null);

  const loadSocieties = useCallback(async () => {
    setLoadingSocieties(true);
    setSocietyError(null);

    try {
      const rows = await fetchPlatformSocieties();
      setSocieties(rows);
    } catch (err) {
      console.error("[AdminContextBar] Failed to load societies from /api/societies:", err);
      setSocietyError(err instanceof Error ? err.message : "Failed to load societies");
      setSocieties([]);
    } finally {
      setLoadingSocieties(false);
    }
  }, []);

  const handleRoleChange = (value: string) => {
    const role = value as AppRole;
    setContextRole(role);

    if (isPlatformAdminContextRole(role)) {
      setSocieties([]);
      setSocietyError(null);
      setLoadingSocieties(false);
      return;
    }

    if (!authLoading && isAuthenticated) {
      void loadSocieties();
    }
  };

  // Residents: fetch only after society is chosen while impersonating resident.
  useEffect(() => {
    if (!showUserSelector || !selectedTenantId || authLoading || !isAuthenticated) {
      setResidents([]);
      setResidentError(null);
      setLoadingResidents(false);
      return;
    }

    let cancelled = false;
    setLoadingResidents(true);
    setResidentError(null);

    fetchPlatformSocietyResidents(selectedTenantId)
      .then((rows) => {
        if (!cancelled) setResidents(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[AdminContextBar] Failed to load society residents:", err);
          setResidentError(err instanceof Error ? err.message : "Failed to load residents");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingResidents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showUserSelector, selectedTenantId, authLoading, isAuthenticated]);

  const handleReset = () => {
    resetContext();
    setSocieties([]);
    setSocietyError(null);
    setResidents([]);
    setResidentError(null);
    setLoadingSocieties(false);
    setLoadingResidents(false);
  };

  const hasActiveContext = !isPlatformView || Boolean(selectedTenantId);
  const defaultRoleLabel = mapToDisplayRole("super_admin");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary shrink-0 pointer-events-none">
        <Shield className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Admin Context</span>
      </div>

      <Select value={contextRole} onValueChange={handleRoleChange}>
        <SelectTrigger
          aria-label="Select admin context role"
          className="h-8 w-[160px] sm:w-[190px] text-xs bg-background cursor-pointer"
        >
          <SelectValue placeholder={defaultRoleLabel} />
        </SelectTrigger>
        <SelectContent className="z-[100]">
          {roleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs cursor-pointer">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showSocietySelector && (
        <Select value={selectedTenantId ?? undefined} onValueChange={setSelectedTenantId}>
          <SelectTrigger
            aria-label="Select target society"
            className="h-8 w-[180px] sm:w-[220px] text-xs bg-background cursor-pointer"
          >
            <SelectValue placeholder="Select Target Society..." />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {loadingSocieties && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading societies...
              </div>
            )}
            {!loadingSocieties &&
              societies.map((society) => (
                <SelectItem key={society.id} value={society.id} className="text-xs cursor-pointer">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {society.name}
                    {society.city ? ` · ${society.city}` : ""}
                  </span>
                </SelectItem>
              ))}
            {!loadingSocieties && societies.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {societyError || "No active societies found"}
              </div>
            )}
          </SelectContent>
        </Select>
      )}

      {showUserSelector && (
        <Select value={selectedUserId ?? undefined} onValueChange={setSelectedUserId}>
          <SelectTrigger
            aria-label="Select target resident"
            className="h-8 w-[180px] sm:w-[220px] text-xs bg-background cursor-pointer"
          >
            <SelectValue placeholder="Select Target Resident..." />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {loadingResidents && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading residents...
              </div>
            )}
            {!loadingResidents &&
              residents
                .filter((resident) => resident.user_id)
                .map((resident) => (
                  <SelectItem
                    key={resident.id}
                    value={resident.user_id!}
                    className="text-xs cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <UserCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {resident.full_name}
                      <span className="text-muted-foreground">· {resident.resident_type}</span>
                    </span>
                  </SelectItem>
                ))}
            {!loadingResidents && residents.filter((r) => r.user_id).length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {residentError || "No approved residents in this society"}
              </div>
            )}
          </SelectContent>
        </Select>
      )}

      {hasActiveContext && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Context
        </Button>
      )}
    </div>
  );
}
