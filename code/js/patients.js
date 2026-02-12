import { sb, debounce, formatDate, getQueryParam, paginate, requireElement, setLoading, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { guardOrRedirect } from "./rbac.js";

let currentPage = 1;
const pageSize = 10;

export async function initPatientsPage(profile) {
  if (!guardOrRedirect(profile.role, "patients.read")) return;

  const tbody = requireElement("patientsTbody");
  const pager = requireElement("patientsPager");
  const searchInput = requireElement("patientSearch");
  const patientForm = requireElement("patientForm");

  const render = async () => {
    const q = searchInput.value.trim();
    const { from, to } = paginate(currentPage, pageSize);

    setLoading(true);
    let query = sb
      .from("patients")
      .select("id,clinic_number,full_name,date_of_birth,phone,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) query = query.ilike("full_name", `%${q}%`);

    const { data, error, count } = await query;
    setLoading(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    tbody.innerHTML = (data || []).map((p) => `
      <tr>
        <td>${p.clinic_number}</td>
        <td><a href="patient-details.html?id=${p.id}">${p.full_name}</a></td>
        <td>${p.date_of_birth || "-"}</td>
        <td>${p.phone || "-"}</td>
        <td>${formatDate(p.created_at)}</td>
      </tr>
    `).join("");

    const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
    pager.textContent = `Page ${currentPage} of ${totalPages}`;
    requireElement("prevPageBtn").disabled = currentPage <= 1;
    requireElement("nextPageBtn").disabled = currentPage >= totalPages;

    await logAudit("patients.list", "patients", null, { page: currentPage, q });
  };

  searchInput.addEventListener("input", debounce(() => {
    currentPage = 1;
    render();
  }));

  requireElement("prevPageBtn").addEventListener("click", () => {
    currentPage -= 1;
    render();
  });

  requireElement("nextPageBtn").addEventListener("click", () => {
    currentPage += 1;
    render();
  });

  patientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!guardOrRedirect(profile.role, "patients.write")) return;

    const payload = {
      clinic_number: requireElement("clinicNumber").value.trim(),
      full_name: requireElement("fullName").value.trim(),
      date_of_birth: requireElement("dob").value,
      sex: requireElement("sex").value,
      phone: requireElement("phone").value.trim(),
      email: requireElement("patientEmail").value.trim(),
      address: requireElement("address").value.trim(),
      medical_history: requireElement("medicalHistory").value.trim()
    };

    const { data, error } = await sb.from("patients").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    patientForm.reset();
    showToast("Patient added", "success");
    await logAudit("patients.create", "patients", data.id, { clinic_number: payload.clinic_number });
    render();
  });

  render();
}

export async function initPatientDetailsPage(profile) {
  const patientId = getQueryParam("id");
  if (!patientId) {
    showToast("Missing patient id", "error");
    return;
  }

  if (!guardOrRedirect(profile.role, "patients.read")) return;

  const detailsCard = requireElement("patientDetailsCard");
  const updateForm = requireElement("patientUpdateForm");
  const visitForm = requireElement("visitForm");
  const visitsBody = requireElement("visitsTbody");

  const loadPatient = async () => {
    setLoading(true);
    const { data, error } = await sb.from("patients").select("*").eq("id", patientId).single();
    setLoading(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    detailsCard.innerHTML = `
      <p><strong>Clinic #:</strong> ${data.clinic_number}</p>
      <p><strong>Name:</strong> ${data.full_name}</p>
      <p><strong>DOB:</strong> ${data.date_of_birth || "-"}</p>
      <p><strong>Phone:</strong> ${data.phone || "-"}</p>
      <p><strong>Email:</strong> ${data.email || "-"}</p>
      <p><strong>Medical History:</strong> ${data.medical_history || "-"}</p>
    `;

    requireElement("uFullName").value = data.full_name || "";
    requireElement("uPhone").value = data.phone || "";
    requireElement("uAddress").value = data.address || "";
    requireElement("uMedicalHistory").value = data.medical_history || "";

    await logAudit("patients.view", "patients", patientId, {});
  };

  const loadVisits = async () => {
    const { data, error } = await sb
      .from("visits")
      .select("id,visit_date,chief_complaint,status")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    visitsBody.innerHTML = (data || []).map((v) => `
      <tr>
        <td>${formatDate(v.visit_date)}</td>
        <td>${v.chief_complaint || "-"}</td>
        <td>${v.status}</td>
        <td>
          <a href="dental-chart.html?patientId=${patientId}&visitId=${v.id}">Open chart</a>
        </td>
      </tr>
    `).join("");
  };

  updateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!guardOrRedirect(profile.role, "patients.write")) return;

    const payload = {
      full_name: requireElement("uFullName").value.trim(),
      phone: requireElement("uPhone").value.trim(),
      address: requireElement("uAddress").value.trim(),
      medical_history: requireElement("uMedicalHistory").value.trim(),
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from("patients").update(payload).eq("id", patientId);
    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Patient updated", "success");
    await logAudit("patients.update", "patients", patientId, payload);
    loadPatient();
  });

  visitForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      patient_id: patientId,
      visit_date: requireElement("visitDate").value,
      chief_complaint: requireElement("chiefComplaint").value.trim(),
      status: "Open"
    };

    const { data, error } = await sb.from("visits").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Visit created", "success");
    await logAudit("visits.create", "visits", data.id, { patient_id: patientId });
    loadVisits();
  });

  await loadPatient();
  await loadVisits();
}
