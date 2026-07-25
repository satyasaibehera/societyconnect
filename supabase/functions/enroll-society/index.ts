import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EnrollBody = {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  society_name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  /** Present for standard flow after client signUp */
  user_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const superAdminEmail = (
      Deno.env.get("SUPER_ADMIN_EMAIL") ||
      Deno.env.get("VITE_SUPER_ADMIN_EMAIL") ||
      ""
    )
      .trim()
      .toLowerCase();

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as EnrollBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const societyName = String(body.society_name || "").trim();

    if (!email || !fullName || !societyName) {
      throw new Error("Missing required fields: email, full_name, society_name");
    }

    // Platform Admin bootstrap: email match only (never an env password).
    // Account password is always the form-submitted password from the client.
    const isPlatformAdmin = Boolean(superAdminEmail) && email === superAdminEmail;

    if (isPlatformAdmin) {
      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      const confirmedAt = new Date().toISOString();

      // Create or fetch confirmed Platform Admin using the form password
      let userId: string | null = null;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });

      if (createError) {
        // User may already exist — update confirmation + form password
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
        if (!existing) throw createError;
        userId = existing.id;
        const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone },
        });
        if (updateError) throw updateError;
      } else {
        userId = created.user?.id ?? null;
      }

      if (!userId) throw new Error("Failed to create Platform Admin user");

      // Pre-confirm so email_confirmed_at is set (immediate login + password resets).
      const { data: confirmedUser, error: confirmError } = await admin.auth.admin.updateUserById(
        userId,
        { email_confirm: true },
      );
      if (confirmError) throw confirmError;
      const emailConfirmedAt =
        confirmedUser?.user?.email_confirmed_at || confirmedAt;

      // Upsert profile
      await admin.from("profiles").upsert(
        { user_id: userId, full_name: fullName, phone },
        { onConflict: "user_id" },
      );

      // Assign platform role (DB enum: super_admin ≡ PLATFORM_ADMIN / SUPER_ADMIN)
      const { data: existingRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await admin
          .from("user_roles")
          .insert({ user_id: userId, role: "super_admin" });
        if (roleError) throw roleError;
      }

      // Active platform society for bootstrap context
      const { data: society, error: socError } = await admin
        .from("societies")
        .insert({
          name: societyName,
          address: body.address || null,
          city: body.city || null,
          state: body.state || null,
          created_by: userId,
          is_active: true,
        })
        .select("id")
        .single();
      if (socError) throw socError;

      return new Response(
        JSON.stringify({
          success: true,
          mode: "platform_admin",
          status: "APPROVED",
          role: "PLATFORM_ADMIN",
          email_confirmed_at: emailConfirmedAt,
          user_id: userId,
          society_id: society.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Standard society onboarding (PENDING_APPROVAL) ───────────────────
    // Expect client to have already called signUp; user_id required.
    const userId = String(body.user_id || "").trim();
    if (!userId) {
      throw new Error("user_id is required for standard society enrollment");
    }

    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(userId);
    if (getUserError || !userData.user) throw new Error("User not found for enrollment");
    if ((userData.user.email || "").toLowerCase() !== email) {
      throw new Error("Email does not match the signup user");
    }

    await admin.from("profiles").upsert(
      { user_id: userId, full_name: fullName, phone },
      { onConflict: "user_id" },
    );

    const { data: society, error: socError } = await admin
      .from("societies")
      .insert({
        name: societyName,
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        created_by: userId,
        is_active: false,
      })
      .select("id")
      .single();
    if (socError) throw socError;

    const { error: rrError } = await admin.from("role_requests").insert({
      requester_id: userId,
      requested_role: "admin",
      society_id: society.id,
      status: "pending",
      reason: `Society onboarding request: ${societyName}`,
    });
    if (rrError) throw rrError;

    return new Response(
      JSON.stringify({
        success: true,
        mode: "standard",
        status: "PENDING_APPROVAL",
        user_id: userId,
        society_id: society.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Enrollment failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
