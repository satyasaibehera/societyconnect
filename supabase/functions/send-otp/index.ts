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

async function sendEmailViaResend(to: string, code: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!resendKey || !lovableKey) return false;
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "SocietyConnect <onboarding@resend.dev>",
        to: [to],
        subject: `Your SocietyConnect verification code: ${code}`,
        html: `<div style="font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:auto">
          <h2 style="color:#1f2470;margin:0 0 16px">Verify your email</h2>
          <p style="color:#444">Use this 6-digit code to verify your email for SocietyConnect registration. The code expires in 10 minutes.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f3f4ff;border-radius:8px;color:#1f2470;margin:16px 0">${code}</div>
          <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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

    if (!["email", "phone"].includes(kind)) throw new Error("Invalid kind");
    if (!target) throw new Error("Target is required");
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) throw new Error("Invalid email");
    if (kind === "phone" && !/^\+\d{7,15}$/.test(target)) throw new Error("Invalid phone (use +<country><number>)");

    // Rate-limit: 1 send per 60 seconds per target
    const { data: recent } = await admin
      .from("otp_codes")
      .select("created_at")
      .eq("kind", kind)
      .eq("target", target)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1);
    if (recent && recent.length > 0) throw new Error("Please wait a minute before requesting another code");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const code_hash = await sha256(code);
    const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insErr } = await admin.from("otp_codes").insert({
      kind, target, code_hash, expires_at,
    });
    if (insErr) throw insErr;

    let delivered = false;
    if (kind === "email") {
      delivered = await sendEmailViaResend(target, code);
    }

    // Dev-mode fallback: ONLY return the raw code in the response when an
    // explicit dev flag is set. Never expose OTP codes in production, since
    // doing so completely defeats out-of-band verification.
    const devMode = (Deno.env.get("OTP_DEV_MODE") || "").toLowerCase() === "true";
    const dev_code = !delivered && devMode ? code : null;

    if (!delivered && !devMode) {
      // No delivery channel configured for this kind. Surface a clear error
      // instead of silently leaking the code.
      if (kind === "phone") {
        throw new Error("SMS delivery is not configured. Please contact support.");
      }
      throw new Error("Email delivery is not configured. Please contact support.");
    }

    return new Response(
      JSON.stringify({ success: true, delivered, dev_code, expires_at }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});