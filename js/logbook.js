import { sb, formatDate, requireElement, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { can } from "./rbac.js";

export async function initLogbookPage(profile) {
  const caseForm = requireElement("studentCaseForm");
  const caseBody = requireElement("studentCasesTbody");
  const logbookForm = requireElement("logbookForm");
  const logbookBody = requireElement("logbookTbody");

  if (!can(profile.role, "cases.submit") && !can(profile.role, "cases.approve")) {
    showToast("No permissions for student workflow", "error");
    return;
  }

  const loadCases = async () => {
    let query = sb
      .from("student_cases")
      .select("id,title,description,status,student_id,created_at,users:student_id(full_name,email)")
      .order("created_at", { ascending: false });

    if (profile.role === "Student") query = query.eq("student_id", profile.id);

    const { data, error } = await query;
    if (error) {
      showToast(error.message, "error");
      return;
    }

    caseBody.innerHTML = (data || []).map((c) => `
      <tr>
        <td>${c.title}</td>
        <td>${c.users?.full_name || c.users?.email || c.student_id}</td>
        <td>${c.status}</td>
        <td>${formatDate(c.created_at)}</td>
        <td>
          ${can(profile.role, "cases.approve") ? `<button class="success" data-approve="${c.id}">Approve</button>` : "-"}
        </td>
      </tr>
    `).join("");

    caseBody.querySelectorAll("button[data-approve]").forEach((btn) => {
      btn.addEventListener("click", () => approveCase(btn.getAttribute("data-approve")));
    });
  };

  const approveCase = async (caseId) => {
    const { error: uErr } = await sb.from("student_cases").update({ status: "Approved" }).eq("id", caseId);
    if (uErr) {
      showToast(uErr.message, "error");
      return;
    }

    const { error: aErr } = await sb.from("approvals").insert({
      case_id: caseId,
      supervisor_id: profile.id,
      status: "Approved",
      approved_at: new Date().toISOString()
    });

    if (aErr) {
      showToast(aErr.message, "error");
      return;
    }

    await logAudit("student_cases.approve", "student_cases", caseId, { supervisor_id: profile.id });
    showToast("Case approved", "success");
    loadCases();
  };

  caseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!can(profile.role, "cases.submit")) {
      showToast("Only students can submit", "error");
      return;
    }

    const payload = {
      student_id: profile.id,
      title: requireElement("caseTitle").value.trim(),
      description: requireElement("caseDescription").value.trim(),
      status: "Submitted"
    };

    const { data, error } = await sb.from("student_cases").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    await logAudit("student_cases.create", "student_cases", data.id, payload);
    caseForm.reset();
    showToast("Case submitted", "success");
    loadCases();
  });

  const loadLogbook = async () => {
    let query = sb
      .from("logbook_entries")
      .select("id,procedure_name,procedure_date,status,student_id,users:student_id(full_name,email)")
      .order("procedure_date", { ascending: false });

    if (profile.role === "Student") query = query.eq("student_id", profile.id);

    const { data, error } = await query;
    if (error) {
      showToast(error.message, "error");
      return;
    }

    logbookBody.innerHTML = (data || []).map((e) => `
      <tr>
        <td>${e.procedure_name}</td>
        <td>${e.users?.full_name || e.users?.email || e.student_id}</td>
        <td>${e.procedure_date}</td>
        <td>${e.status}</td>
        <td>
          ${can(profile.role, "logbook.verify") ? `<button class="success" data-verify="${e.id}">Verify</button>` : "-"}
        </td>
      </tr>
    `).join("");

    logbookBody.querySelectorAll("button[data-verify]").forEach((btn) => {
      btn.addEventListener("click", () => verifyEntry(btn.getAttribute("data-verify")));
    });
  };

  const verifyEntry = async (entryId) => {
    const { error } = await sb.from("logbook_entries").update({
      status: "Verified",
      verified_by: profile.id,
      verified_at: new Date().toISOString()
    }).eq("id", entryId);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    await logAudit("logbook.verify", "logbook_entries", entryId, {});
    showToast("Logbook verified", "success");
    loadLogbook();
  };

  logbookForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!can(profile.role, "logbook.write")) {
      showToast("Only students can create logbook entries", "error");
      return;
    }

    const payload = {
      student_id: profile.id,
      procedure_name: requireElement("procedureName").value.trim(),
      procedure_date: requireElement("procedureDate").value,
      details: requireElement("procedureDetails").value.trim(),
      status: "Pending"
    };

    const { data, error } = await sb.from("logbook_entries").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    await logAudit("logbook.create", "logbook_entries", data.id, payload);
    logbookForm.reset();
    showToast("Logbook entry added", "success");
    loadLogbook();
  });

  if (!can(profile.role, "cases.submit")) caseForm.classList.add("hidden");
  if (!can(profile.role, "logbook.write")) logbookForm.classList.add("hidden");

  loadCases();
  loadLogbook();
}
