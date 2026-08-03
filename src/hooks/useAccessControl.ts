import { useEffect, useState } from "react";
import { tenantDb } from "@/services/tenantDb";
import { useEffectiveRoles } from "@/hooks/useUserRole";

interface AccessMap {
  [moduleKey: string]: boolean;
}

export function useAccessControl() {
  const { roles: effectiveRoles, loading: roleLoading } = useEffectiveRoles();
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;

    if (effectiveRoles.length === 0) {
      setAccessMap({});
      setLoading(false);
      return;
    }

    const fetchAccessControls = async () => {
      const { data } = await tenantDb
        .from("access_controls")
        .select("module_key, role_key, is_enabled");

      if (!data) {
        setLoading(false);
        return;
      }

      if (effectiveRoles.includes("super_admin")) {
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

    void fetchAccessControls();
  }, [effectiveRoles, roleLoading]);

  const hasAccess = (moduleKey: string): boolean => {
    if (effectiveRoles.includes("super_admin")) return true;
    return accessMap[moduleKey] ?? false;
  };

  return { hasAccess, loading, effectiveRoles };
}
