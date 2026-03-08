import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "super_admin" | "admin" | "office_bearer" | "resident" | "security";

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setRoles((data || []).map((r) => r.role));
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const hasRole = (...check: AppRole[]) => check.some((r) => roles.includes(r));
  const isManagement = hasRole("super_admin", "admin");
  const isSecurity = hasRole("security");

  return { roles, loading, hasRole, isManagement, isSecurity };
}
