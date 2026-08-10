import { useEffect, useState } from "react";
import { Building2, RotateCcw, Shield, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminContext, IMPERSONATION_ROLE_OPTIONS } from "@/contexts/AdminContext";
import {
  fetchPlatformSocieties,
  fetchPlatformSocietyResidents,
  type PlatformResident,
  type PlatformSociety,
} from "@/lib/api/platform";
import type { AppRole } from "@/types/auth";

export function AdminContextBar() {
  const {
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
  } = useAdminContext();

  const [societies, setSocieties] = useState<PlatformSociety[]>([]);
  const [residents, setResidents] = useState<PlatformResident[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(false);
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [societyError, setSocietyError] = useState<string | null>(null);
  const [residentError, setResidentError] = useState<string | null>(null);

  const roleSelectValue = isPlatformView ? "platform" : impersonatedRole ?? "platform";

  useEffect(() => {
    if (!showSocietySelector) {
      setSocieties([]);
      setSocietyError(null);
      return;
    }

    let cancelled = false;
    setLoadingSocieties(true);
    setSocietyError(null);

    fetchPlatformSocieties()
      .then((rows) => {
        if (!cancelled) setSocieties(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setSocietyError(err instanceof Error ? err.message : "Failed to load societies");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSocieties(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showSocietySelector]);

  useEffect(() => {
    if (!showUserSelector || !selectedTenantId) {
      setResidents([]);
      setResidentError(null);
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
          setResidentError(err instanceof Error ? err.message : "Failed to load residents");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingResidents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showUserSelector, selectedTenantId]);

  const handleRoleChange = (value: string) => {
    if (value === "platform") {
      resetContext();
      return;
    }
    setImpersonatedRole(value as AppRole);
  };

  const hasActiveContext = !isPlatformView || Boolean(selectedTenantId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary shrink-0">
        <Shield className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Admin Context</span>
      </div>

      <Select value={roleSelectValue} onValueChange={handleRoleChange}>
        <SelectTrigger className="h-8 w-[180px] sm:w-[210px] text-xs bg-background">
          <SelectValue placeholder="Platform Admin" />
        </SelectTrigger>
        <SelectContent>
          {IMPERSONATION_ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showSocietySelector && (
        <Select
          value={selectedTenantId ?? undefined}
          onValueChange={setSelectedTenantId}
          disabled={loadingSocieties}
        >
          <SelectTrigger className="h-8 w-[180px] sm:w-[220px] text-xs bg-background">
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select Target Society..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            {societies.map((society) => (
              <SelectItem key={society.id} value={society.id} className="text-xs">
                {society.name}
                {society.city ? ` · ${society.city}` : ""}
              </SelectItem>
            ))}
            {!loadingSocieties && societies.length === 0 && (
              <SelectItem value="__empty" disabled className="text-xs">
                {societyError || "No active societies found"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}

      {showUserSelector && (
        <Select
          value={selectedUserId ?? undefined}
          onValueChange={setSelectedUserId}
          disabled={loadingResidents || !selectedTenantId}
        >
          <SelectTrigger className="h-8 w-[180px] sm:w-[220px] text-xs bg-background">
            <div className="flex items-center gap-1.5 truncate">
              <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select Target Resident..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            {residents
              .filter((resident) => resident.user_id)
              .map((resident) => (
                <SelectItem
                  key={resident.id}
                  value={resident.user_id!}
                  className="text-xs"
                >
                  {resident.full_name}
                  <span className="text-muted-foreground"> · {resident.resident_type}</span>
                </SelectItem>
              ))}
            {!loadingResidents && residents.length === 0 && (
              <SelectItem value="__empty_residents" disabled className="text-xs">
                {residentError || "No approved residents in this society"}
              </SelectItem>
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
          onClick={resetContext}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Context
        </Button>
      )}
    </div>
  );
}
