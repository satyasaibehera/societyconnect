import type { Request, Response } from "express";

type EnrollBody = {
  email?: string;
  password?: string;
  full_name?: string;
  phone_number?: string | null;
  society_name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

function resolveSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

/**
 * POST /api/v1/auth/enroll
 * Proxies society enrollment to the enroll-society Supabase Edge Function.
 */
export async function handleSocietyEnroll(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as EnrollBody;

  const email = body.email?.trim();
  const password = body.password;
  const full_name = body.full_name?.trim();
  const society_name = body.society_name?.trim();

  if (!email || !password || !full_name || !society_name) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: email, password, full_name, and society_name are mandatory.",
    });
    return;
  }

  const supabase = resolveSupabaseConfig();
  if (!supabase) {
    res.status(500).json({
      success: false,
      error: "Enrollment service is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    });
    return;
  }

  try {
    const upstream = await fetch(`${supabase.url}/functions/v1/enroll-society`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabase.serviceRoleKey}`,
        apikey: supabase.serviceRoleKey,
      },
      body: JSON.stringify({
        email,
        password,
        full_name,
        phone: body.phone_number ?? null,
        society_name,
        address: body.address ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        pincode: body.pincode ?? null,
      }),
    });

    const contentType = upstream.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await upstream.json()
      : { error: await upstream.text() };

    if (!upstream.ok || payload?.success === false) {
      const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 400;
      const upstreamError =
        typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.message === "string"
            ? payload.message
            : "Society enrollment failed.";

      const isAccountExists =
        payload?.code === "ACCOUNT_EXISTS" ||
        /already exists|already registered|account with this email/i.test(upstreamError);

      const message =
        typeof payload?.message === "string" && payload.message.trim()
          ? payload.message.trim()
          : upstreamError;

      res.status(status).json({
        success: false,
        message,
        error: upstreamError,
        code:
          (typeof payload?.code === "string" && payload.code) ||
          (isAccountExists ? "ACCOUNT_EXISTS" : undefined),
        support_hint:
          (typeof payload?.support_hint === "string" && payload.support_hint) ||
          (isAccountExists
            ? "If you already registered, sign in with your password or use password reset."
            : undefined),
        action:
          (typeof payload?.action === "string" && payload.action) ||
          (isAccountExists ? "LOGIN_OR_RESET" : undefined),
      });
      return;
    }

    const userId =
      (typeof payload?.user?.id === "string" && payload.user.id) ||
      (typeof payload?.userId === "string" && payload.userId) ||
      null;

    const societyId =
      (typeof payload?.society_id === "string" && payload.society_id) ||
      (typeof payload?.society?.id === "string" && payload.society.id) ||
      null;

    res.status(201).json({
      success: true,
      data: { userId, societyId },
    });
  } catch (err) {
    console.error("[POST /api/v1/auth/enroll]", err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Society enrollment failed.",
    });
  }
}
