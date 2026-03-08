import { supabase } from "@/integrations/supabase/client";

let cachedSocietyId: string | null = null;

export async function getSocietyId(): Promise<string | null> {
  if (cachedSocietyId) return cachedSocietyId;
  const { data } = await supabase
    .from("societies")
    .select("id")
    .limit(1)
    .maybeSingle();
  cachedSocietyId = data?.id ?? null;
  return cachedSocietyId;
}

export function clearSocietyCache() {
  cachedSocietyId = null;
}
