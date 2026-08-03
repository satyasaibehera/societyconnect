import { useEffect, useState, useCallback } from "react";
import { tenantDb } from "@/services/tenantDb";
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
    const { data: resident } = await tenantDb.from("residents")
      .select("unit_id, society_id, resident_type")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    if (resident) {
      setMyUnitId(resident.unit_id);
      setSocietyId(resident.society_id);
      setIsOwner(resident.resident_type === "owner");
      if (resident.unit_id) {
        const { data: unit } = await tenantDb.from("units")
          .select("unit_number")
          .eq("id", resident.unit_id)
          .maybeSingle();
        setUnitLabel(unit?.unit_number ?? null);
      }
    }

    // Get active delegations where I am the delegate
    const { data: delegations } = await tenantDb.from("approval_delegates")
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
