import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface AccessMap {
  [moduleKey: string]: boolean;
}

export function useAccessControl() {
  const { user } = useAuth();
  const { roles, loading: roleLoading } = useUserRole();
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [effectiveRoles, setEffectiveRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine effective roles: user_roles + resident_type mapping
  useEffect(() => {
    if (!user || roleLoading) return;

    const determine = async () => {
      const effective: string[] = [...roles];

      // If user has no admin/super_admin role, check resident_type
      const { data: resident } = await supabase
        .from("residents")
        .select("resident_type")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      if (resident?.resident_type) {
        effective.push(resident.resident_type); // owner, tenant, family
      }

      // Map office_bearer role
      const { data: ob } = await supabase
        .from("office_bearers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (ob && !effective.includes("office_bearer")) {
        effective.push("office_bearer");
      }

      setEffectiveRoles([...new Set(effective)]);
    };

    determine();
  }, [user, roles, roleLoading]);

  // Fetch access controls and build map based on effective roles
  useEffect(() => {
    if (effectiveRoles.length === 0 && !roleLoading) {
      setLoading(false);
      return;
    }
    if (effectiveRoles.length === 0) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("access_controls")
        .select("module_key, role_key, is_enabled");

      if (!data) {
        setLoading(false);
        return;
      }

      // Super admins always have full access
      if (effectiveRoles.includes("super_admin")) {
        const map: AccessMap = {};
        data.forEach((r) => {
          map[r.module_key as string] = true;
        });
        setAccessMap(map);
        setLoading(false);
        return;
      }

      // For other roles: module is accessible if ANY of user's effective roles has it enabled
      const map: AccessMap = {};
      data.forEach((row) => {
        const key = row.module_key as string;
        if (effectiveRoles.includes(row.role_key as string) && row.is_enabled) {
          map[key] = true;
        }
        // Initialize to false if not yet set
        if (!(key in map)) {
          map[key] = false;
        }
      });

      setAccessMap(map);
      setLoading(false);
    };

    fetch();
  }, [effectiveRoles, roleLoading]);

  const hasAccess = (moduleKey: string): boolean => {
    // Super admins always have access
    if (effectiveRoles.includes("super_admin")) return true;
    return accessMap[moduleKey] ?? false;
  };

  return { hasAccess, loading, effectiveRoles };
}
