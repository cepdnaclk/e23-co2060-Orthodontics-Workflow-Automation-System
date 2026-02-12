import { sb, formatDate, requireElement, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { guardOrRedirect } from "./rbac.js";

export async function initAppointmentsPage(profile) {
  if (!guardOrRedirect(profile.role, "appointments.manage")) return;

  const form = requireElement("appointmentForm");
  const body = requireElement("appointmentsTbody");

  const load = async () => {
    const { data, error } = await sb
      .from("appointments")
      .select("id,patient_id,appointment_at,status,reminder_sent_at,patients(full_name,clinic_number)")
      .order("appointment_at", { ascending: true });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    body.innerHTML = (data || []).map((a) => `
      <tr>
        <td>${a.patients?.clinic_number || "-"}</td>
        <td>${a.patients?.full_name || a.patient_id}</td>
        <td>${formatDate(a.appointment_at)}</td>
        <td>${a.status}</td>
        <td>${a.reminder_sent_at ? formatDate(a.reminder_sent_at) : "-"}</td>
        <td>
          <button class="secondary" data-status="Completed" data-id="${a.id}">Complete</button>
          <button class="warning" data-status="Cancelled" data-id="${a.id}">Cancel</button>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => updateStatus(btn.getAttribute("data-id"), btn.getAttribute("data-status")));
    });
  };

  const updateStatus = async (id, status) => {
    const { error } = await sb.from("appointments").update({ status }).eq("id", id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    await logAudit("appointments.update", "appointments", id, { status });
    load();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: requireElement("appointmentPatientId").value.trim(),
      appointment_at: requireElement("appointmentAt").value,
      reason: requireElement("appointmentReason").value.trim(),
      status: "Scheduled"
    };

    const { data, error } = await sb.from("appointments").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    await logAudit("appointments.create", "appointments", data.id, payload);
    form.reset();
    showToast("Appointment scheduled", "success");
    load();
  });

  requireElement("sendRemindersBtn").addEventListener("click", async () => {
    const { data, error } = await sb.functions.invoke("send-appointment-reminders", {
      body: { source: "owas-ui" }
    });

    if (error) {
      showToast(`Reminder function error: ${error.message}`, "error");
      return;
    }

    showToast(`Reminders triggered: ${data?.sent || 0}`, "success");
    await logAudit("appointments.reminders", "appointments", null, data || {});
    load();
  });

  // SMS integration stub hook for future provider integration (Twilio, Vonage, etc.)
  window.owasSendSmsStub = async function sendSmsStub(phone, text) {
    console.info("SMS stub", { phone, text });
    return { ok: true, provider: "stub" };
  };

  load();
}
