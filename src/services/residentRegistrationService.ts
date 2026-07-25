import { supabase } from "@/integrations/supabase/client";

export type ResidentRegistrationMeta = {
  society_id: string;
  unit_id?: string | null;
  building_id?: string | null;
  resident_type?: string;
  date_of_birth?: string | null;
  phone?: string | null;
  full_name?: string;
  email?: string | null;
  request_new_flat?: boolean;
  building_name?: string | null;
  flat_number?: string | null;
  notes?: string | null;
  is_ownership_transfer?: boolean;
  supporting_document_url?: string | null;
};

/**
 * Creates a pending residents row from signup user_metadata if one does not exist.
 * Used after email confirmation when signUp returned no session for an immediate insert.
 */
export async function ensurePendingResidentForUser(userId: string): Promise<{
  created: boolean;
  error: Error | null;
}> {
  const { data: existing, error: existingError } = await supabase
    .from("residents")
    .select("id, status")
    .eq("user_id", userId)
    .limit(1);

  if (existingError) {
    return { created: false, error: new Error(existingError.message) };
  }
  if (existing && existing.length > 0) {
    return { created: false, error: null };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { created: false, error: new Error(userError?.message || "No authenticated user") };
  }

  const meta = userData.user.user_metadata || {};
  const reg = (meta.registration || {}) as ResidentRegistrationMeta;
  const societyId = String(reg.society_id || "").trim();
  const fullName = String(reg.full_name || meta.full_name || "").trim();

  if (!societyId || !fullName) {
    return {
      created: false,
      error: new Error("Missing registration metadata (society or full name)"),
    };
  }

  const unitId = reg.unit_id ? String(reg.unit_id).trim() : null;
  const phone = String(reg.phone || meta.phone || "").trim() || null;
  const email =
    String(reg.email || userData.user.email || "").trim() || null;

  const insertPayload = {
    user_id: userId,
    society_id: societyId,
    unit_id: unitId,
    full_name: fullName,
    phone,
    email,
    date_of_birth: reg.date_of_birth || null,
    resident_type: reg.resident_type || "owner",
    status: "pending" as const,
    is_ownership_transfer: Boolean(reg.is_ownership_transfer),
    supporting_document_url: reg.supporting_document_url || null,
  };

  let { error: insertError } = await supabase.from("residents").insert(insertPayload);

  // If unit_id FK fails (Neon flat id ≠ Supabase unit), retry without unit.
  if (insertError && unitId) {
    const retry = await supabase.from("residents").insert({
      ...insertPayload,
      unit_id: null,
    });
    insertError = retry.error;
  }

  if (insertError) {
    return { created: false, error: new Error(insertError.message) };
  }

  // Best-effort profile write (ignore conflicts / RLS failures)
  try {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (existingProfile && existingProfile.length > 0) {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          date_of_birth: reg.date_of_birth || null,
        })
        .eq("user_id", userId);
    } else {
      await supabase.from("profiles").insert({
        user_id: userId,
        full_name: fullName,
        phone,
        date_of_birth: reg.date_of_birth || null,
      });
    }
  } catch {
    // non-blocking
  }

  return { created: true, error: null };
}
