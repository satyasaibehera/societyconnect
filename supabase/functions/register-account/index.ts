import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { type, email, password, full_name } = body;

    if (!email || !password || !type || !full_name) {
      throw new Error("Missing required fields: email, password, full_name, type");
    }

    // Create user with email auto-confirmed
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError) throw createError;
    if (!newUser.user) throw new Error("Failed to create user");

    const userId = newUser.user.id;

    if (type === "society_admin") {
      const { society_name, address, city, state } = body;
      if (!society_name) throw new Error("Society name is required");

      // Create society (inactive, pending approval)
      const { data: society, error: socError } = await adminClient
        .from("societies")
        .insert({
          name: society_name,
          address: address || null,
          city: city || null,
          state: state || null,
          created_by: userId,
          is_active: false,
        })
        .select()
        .single();
      if (socError) throw socError;

      // Create role request for admin
      const { error: rrError } = await adminClient.from("role_requests").insert({
        requester_id: userId,
        requested_role: "admin",
        society_id: society.id,
        status: "pending",
        reason: `New society registration: ${society_name}`,
      });
      if (rrError) throw rrError;

      return new Response(
        JSON.stringify({ success: true, user_id: userId, registration_type: "society_admin" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (type === "resident") {
      const { society_id, unit_id, phone, date_of_birth, resident_type, photo_base64 } = body;
      if (!society_id || !unit_id) throw new Error("Society and unit are required");

      let photo_url: string | null = null;
      if (photo_base64) {
        const fileName = `photos/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const binaryStr = atob(photo_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const { error: uploadErr } = await adminClient.storage
          .from("resident-photos")
          .upload(fileName, bytes, { contentType: "image/jpeg" });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = adminClient.storage.from("resident-photos").getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }

      const { error: resError } = await adminClient.from("residents").insert({
        full_name,
        phone: phone || null,
        date_of_birth: date_of_birth || null,
        unit_id,
        society_id,
        resident_type: resident_type || "owner",
        user_id: userId,
        photo_url,
        status: "pending",
      });
      if (resError) throw resError;

      return new Response(
        JSON.stringify({ success: true, user_id: userId, registration_type: "resident" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("Invalid registration type. Must be 'society_admin' or 'resident'.");
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
