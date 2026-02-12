import { sb, formatDate, requireElement, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { guardOrRedirect } from "./rbac.js";

export async function initQueuePage(profile) {
  if (!guardOrRedirect(profile.role, "queue.manage")) return;

  const form = requireElement("queueForm");
  const body = requireElement("queueTbody");

  const loadQueue = async () => {
    const { data, error } = await sb
      .from("queue")
      .select("id,patient_id,status,priority,created_at,patients(full_name)")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    body.innerHTML = (data || []).map((item) => `
      <tr>
        <td>${item.patients?.full_name || item.patient_id}</td>
        <td><span class="badge ${item.status.toLowerCase()}">${item.status}</span></td>
        <td>${item.priority}</td>
        <td>${formatDate(item.created_at)}</td>
        <td>
          <button class="secondary" data-id="${item.id}" data-status="Waiting">Waiting</button>
          <button class="success" data-id="${item.id}" data-status="Completed">Completed</button>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const status = btn.getAttribute("data-status");
        const { error: uErr } = await sb.from("queue").update({ status }).eq("id", id);
        if (uErr) showToast(uErr.message, "error");
        else {
          await logAudit("queue.update", "queue", id, { status });
          loadQueue();
        }
      });
    });
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: requireElement("queuePatientId").value.trim(),
      status: "Open",
      priority: Number(requireElement("queuePriority").value) || 1
    };

    const { data, error } = await sb.from("queue").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }
    await logAudit("queue.create", "queue", data.id, payload);
    form.reset();
    loadQueue();
  });

  // Live updates via Supabase Realtime.
  sb.channel("queue-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, async () => {
      await loadQueue();
    })
    .subscribe();

  loadQueue();
}
