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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id,patient_id,appointment_at,status")
      .gte("appointment_at", now.toISOString())
      .lte("appointment_at", in24h.toISOString())
      .eq("status", "Scheduled");

    if (error) throw error;

    // Email provider integration point (SendGrid/Resend/etc)
    // For now this function marks reminders as sent.
    const ids = (appointments || []).map((a) => a.id);
    if (ids.length > 0) {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", ids);
      if (updateError) throw updateError;
    }

    // SMS integration stub hook
    const smsStub = {
      enabled: false,
      provider: "stub",
      message: "Implement SMS provider API call here"
    };

    return new Response(JSON.stringify({ sent: ids.length, sms: smsStub }), {
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
