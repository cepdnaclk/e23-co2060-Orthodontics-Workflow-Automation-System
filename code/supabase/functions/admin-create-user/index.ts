import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data: callerAuth, error: callerErr } = await adminClient.auth.getUser(token);
    if (callerErr || !callerAuth?.user) {
      return new Response(JSON.stringify({ error: "Invalid caller session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const callerId = callerAuth.user.id;
    const { data: callerProfile, error: roleErr } = await adminClient
      .from("users")
      .select("id,role_id")
      .eq("id", callerId)
      .single();

    let callerRoleName = "";
    if (!roleErr && callerProfile?.role_id) {
      const { data: callerRole } = await adminClient
        .from("roles")
        .select("name")
        .eq("id", callerProfile.role_id)
        .maybeSingle();
      callerRoleName = callerRole?.name || "";
    }

    if (roleErr || callerRoleName !== "Admin") {
      return new Response(JSON.stringify({ error: "Only Admin can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = await req.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const tempPassword = String(payload.tempPassword || "");
    const fullName = String(payload.fullName || "").trim();
    const roleName = String(payload.roleName || "").trim();

    if (!email || !tempPassword || !roleName) {
      return new Response(JSON.stringify({ error: "email, tempPassword and roleName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (tempPassword.length < 8) {
      return new Response(JSON.stringify({ error: "Temporary password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: roleRow, error: roleLookupErr } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();

    if (roleLookupErr || !roleRow) {
      return new Response(JSON.stringify({ error: `Invalid role: ${roleName}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split("@")[0]
      }
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Failed to create auth user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const newUserId = created.user.id;
    const { error: profileErr } = await adminClient.from("users").insert({
      id: newUserId,
      role_id: roleRow.id,
      full_name: fullName || email.split("@")[0],
      email
    });

    if (profileErr) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ userId: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
