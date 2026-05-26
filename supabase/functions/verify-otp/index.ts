import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const kind: string = body.kind;
    const target: string = (body.target || "").trim();
    const code: string = (body.code || "").trim();

    if (!["email", "phone"].includes(kind)) throw new Error("Invalid kind");
    if (!target || !/^\d{6}$/.test(code)) throw new Error("Code must be 6 digits");

    const { data: rows } = await admin
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts, verified_at")
      .eq("kind", kind)
      .eq("target", target)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) throw new Error("No code requested for this target");
    if (row.verified_at) {
      return new Response(JSON.stringify({ success: true, already_verified: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired — request a new one");
    if (row.attempts >= 5) throw new Error("Too many attempts — request a new code");

    const supplied_hash = await sha256(code);
    if (supplied_hash !== row.code_hash) {
      await admin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect code");
    }

    await admin.from("otp_codes").update({ verified_at: new Date().toISOString() }).eq("id", row.id);

    return new Response(JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});