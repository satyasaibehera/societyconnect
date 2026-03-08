import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Checks if the current user can approve items for a given unit.
 * Returns true if they are the unit owner OR an active delegate.
 */
export function useUnitApprover() {
  const { user } = useAuth();
  const [myUnitId, setMyUnitId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [unitLabel, setUnitLabel] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [delegateForUnits, setDelegateForUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContext = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Get own resident info
    const { data: resident } = await supabase
      .from("residents")
      .select("unit_id, society_id, resident_type, units!residents_unit_id_fkey(unit_number)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    if (resident) {
      setMyUnitId(resident.unit_id);
      setSocietyId(resident.society_id);
      setUnitLabel((resident.units as any)?.unit_number ?? null);
      setIsOwner(resident.resident_type === "owner");
    }

    // Get active delegations where I am the delegate
    const { data: delegations } = await supabase
      .from("approval_delegates")
      .select("unit_id")
      .eq("delegate_id", user.id)
      .eq("is_active", true)
      .gte("valid_until", new Date().toISOString());

    if (delegations) {
      setDelegateForUnits(delegations.map((d: any) => d.unit_id));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchContext(); }, [fetchContext]);

  const canApproveForUnit = (unitId: string | null) => {
    if (!unitId) return false;
    if (isOwner && unitId === myUnitId) return true;
    return delegateForUnits.includes(unitId);
  };

  return { myUnitId, societyId, unitLabel, isOwner, delegateForUnits, canApproveForUnit, loading, refetch: fetchContext };
}
