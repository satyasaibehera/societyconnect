import { useEffect, useState } from "react";
import { tenantDb } from "@/services/tenantDb";
import { APP_ROLE } from "@/types/auth";
import { useEffectiveRoles } from "@/hooks/useUserRole";
import { useCanLoadTenantData } from "@/hooks/useCanLoadTenantData";

interface AccessMap {
  [moduleKey: string]: boolean;
}

type UseAccessControlOptions = {
  /** When false, skips tenant access_controls fetch (e.g. platform admin without society). */
  enabled?: boolean;
};

export function useAccessControl(options: UseAccessControlOptions = {}) {
  const { enabled = true } = options;
  const { roles: effectiveRoles, loading: roleLoading } = useEffectiveRoles();
  const canLoadTenantData = useCanLoadTenantData();
  const queriesEnabled = enabled && canLoadTenantData;

  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!queriesEnabled) {
      setAccessMap({});
      setLoading(false);
      return;
    }

    if (roleLoading) return;

    if (effectiveRoles.length === 0) {
      setAccessMap({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAccessControls = async () => {
      const { data } = await tenantDb
        .from("access_controls")
        .select("module_key, role_key, is_enabled");

      if (cancelled) return;

      if (!data) {
        setLoading(false);
        return;
      }

      if (effectiveRoles.includes(APP_ROLE.SUPER_ADMIN)) {
        const map: AccessMap = {};
        data.forEach((r) => {
          map[r.module_key as string] = true;
        });
        setAccessMap(map);
        setLoading(false);
        return;
      }

      const map: AccessMap = {};
      data.forEach((row) => {
        const key = row.module_key as string;
        if (effectiveRoles.includes(row.role_key as string) && row.is_enabled) {
          map[key] = true;
        }
        if (!(key in map)) {
          map[key] = false;
        }
      });

      setAccessMap(map);
      setLoading(false);
    };

    setLoading(true);
    void fetchAccessControls();

    return () => {
      cancelled = true;
    };
  }, [effectiveRoles, roleLoading, queriesEnabled]);

  const hasAccess = (moduleKey: string): boolean => {
    if (!queriesEnabled && effectiveRoles.includes(APP_ROLE.SUPER_ADMIN)) return true;
    if (!queriesEnabled) return false;
    if (effectiveRoles.includes(APP_ROLE.SUPER_ADMIN)) return true;
    return accessMap[moduleKey] ?? false;
  };

  return { hasAccess, loading: queriesEnabled && (loading || roleLoading), effectiveRoles };
}
