import { sb, formatDate, getQueryParam, requireElement, setLoading, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { guardOrRedirect } from "./rbac.js";

const STATUS_COLORS = {
  Normal: "#d1fae5",
  Caries: "#fca5a5",
  Extraction: "#9ca3af",
  Filling: "#93c5fd",
  Braces: "#fde68a"
};

function buildTeethSvg() {
  const width = 1100;
  const height = 270;
  const toothW = 55;
  const toothH = 70;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-label="Dental chart">`;
  let x = 10;

  // Upper arch 1..16
  for (let i = 1; i <= 16; i += 1) {
    svg += `<g data-tooth="${i}"><rect class="tooth" x="${x}" y="20" width="${toothW}" height="${toothH}" fill="${STATUS_COLORS.Normal}" /><text x="${x + 20}" y="65" font-size="14">${i}</text></g>`;
    x += 66;
  }

  x = 10;
  // Lower arch 17..32
  for (let i = 17; i <= 32; i += 1) {
    svg += `<g data-tooth="${i}"><rect class="tooth" x="${x}" y="150" width="${toothW}" height="${toothH}" fill="${STATUS_COLORS.Normal}" /><text x="${x + 16}" y="194" font-size="14">${i}</text></g>`;
    x += 66;
  }

  svg += "</svg>";
  return svg;
}

export async function initDentalChartPage(profile) {
  if (!guardOrRedirect(profile.role, "patients.read")) return;

  const patientId = getQueryParam("patientId");
  const visitId = getQueryParam("visitId");
  if (!patientId || !visitId) {
    showToast("patientId and visitId are required", "error");
    return;
  }

  const chartContainer = requireElement("chartContainer");
  const statusSelect = requireElement("toothStatus");
  const selectedToothEl = requireElement("selectedTooth");
  const notesEditor = requireElement("notesEditor");
  const notesBody = requireElement("notesTbody");
  const radioBody = requireElement("radioTbody");

  chartContainer.innerHTML = buildTeethSvg();

  const state = {
    selectedTooth: null,
    teeth: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [String(i + 1), "Normal"]))
  };

  const paintTooth = (toothNo, status) => {
    const group = chartContainer.querySelector(`g[data-tooth="${toothNo}"]`);
    if (!group) return;
    const rect = group.querySelector("rect");
    rect.setAttribute("fill", STATUS_COLORS[status] || STATUS_COLORS.Normal);
  };

  chartContainer.querySelectorAll("g[data-tooth]").forEach((g) => {
    g.addEventListener("click", () => {
      chartContainer.querySelectorAll(".tooth").forEach((t) => t.classList.remove("active"));
      const toothNo = g.getAttribute("data-tooth");
      g.querySelector("rect").classList.add("active");
      state.selectedTooth = toothNo;
      selectedToothEl.textContent = toothNo;
      statusSelect.value = state.teeth[toothNo] || "Normal";
    });
  });

  statusSelect.addEventListener("change", () => {
    if (!state.selectedTooth) {
      showToast("Select a tooth first", "warning");
      return;
    }
    state.teeth[state.selectedTooth] = statusSelect.value;
    paintTooth(state.selectedTooth, statusSelect.value);
  });

  requireElement("saveChartBtn").addEventListener("click", async () => {
    const payload = {
      patient_id: patientId,
      visit_id: visitId,
      chart_data: state.teeth,
      visit_date: new Date().toISOString().slice(0, 10)
    };
    const { error } = await sb.from("dental_charts").upsert(payload, { onConflict: "visit_id" });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Dental chart saved", "success");
    await logAudit("dental_chart.save", "dental_charts", visitId, { patient_id: patientId });
  });

  const loadChart = async () => {
    const { data } = await sb
      .from("dental_charts")
      .select("chart_data")
      .eq("visit_id", visitId)
      .maybeSingle();

    if (data?.chart_data) {
      state.teeth = data.chart_data;
      Object.entries(state.teeth).forEach(([tooth, status]) => paintTooth(tooth, status));
    }
  };

  const loadNotes = async () => {
    const { data, error } = await sb
      .from("treatment_notes")
      .select("id,note_html,created_at,author_id,users(full_name,email)")
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    notesBody.innerHTML = (data || []).map((n) => `
      <tr>
        <td>${formatDate(n.created_at)}</td>
        <td>${n.users?.full_name || n.users?.email || n.author_id}</td>
        <td>${n.note_html}</td>
      </tr>
    `).join("");
  };

  requireElement("saveNoteBtn").addEventListener("click", async () => {
    const noteHtml = notesEditor.innerHTML.trim();
    if (!noteHtml) {
      showToast("Note cannot be empty", "warning");
      return;
    }

    const { data: authData } = await sb.auth.getUser();
    const authorId = authData.user?.id;

    const { error } = await sb.from("treatment_notes").insert({
      patient_id: patientId,
      visit_id: visitId,
      author_id: authorId,
      note_html: noteHtml
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    notesEditor.innerHTML = "";
    showToast("Note added", "success");
    await logAudit("treatment_notes.create", "treatment_notes", visitId, {});
    loadNotes();
  });

  const loadRadiographs = async () => {
    const { data, error } = await sb
      .from("radiographs")
      .select("id,file_name,file_path,file_type,created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    radioBody.innerHTML = (data || []).map((r) => `
      <tr>
        <td>${r.file_name}</td>
        <td>${r.file_type}</td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="secondary" data-open="${r.file_path}">Open</button></td>
      </tr>
    `).join("");

    radioBody.querySelectorAll("button[data-open]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const path = btn.getAttribute("data-open");
        const { data: signed, error: signedErr } = await sb.storage
          .from("radiographs")
          .createSignedUrl(path, 60);

        if (signedErr) {
          showToast(signedErr.message, "error");
          return;
        }
        window.open(signed.signedUrl, "_blank");
        await logAudit("radiographs.view", "radiographs", null, { file_path: path });
      });
    });
  };

  requireElement("uploadRadiographForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!guardOrRedirect(profile.role, "radiographs.read")) {
      // Students can only view own uploads by RLS. Block upload unless write role.
      if (profile.role !== "Student") return;
    }

    const fileInput = requireElement("radiographFile");
    const file = fileInput.files[0];
    if (!file) {
      showToast("Select a file", "warning");
      return;
    }

    const safeName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const path = `${patientId}/${visitId}/${safeName}`;

    setLoading(true);
    const { error: uploadErr } = await sb.storage
      .from("radiographs")
      .upload(path, file, { upsert: false });
    setLoading(false);

    if (uploadErr) {
      showToast(uploadErr.message, "error");
      return;
    }

    const { data: userData } = await sb.auth.getUser();
    const { error: rowErr } = await sb.from("radiographs").insert({
      patient_id: patientId,
      visit_id: visitId,
      uploaded_by: userData.user?.id,
      file_name: file.name,
      file_path: path,
      file_type: file.type
    });

    if (rowErr) {
      showToast(rowErr.message, "error");
      return;
    }

    fileInput.value = "";
    showToast("Radiograph uploaded", "success");
    await logAudit("radiographs.upload", "radiographs", null, { patient_id: patientId, visit_id: visitId });
    loadRadiographs();
  });

  await loadChart();
  await loadNotes();
  await loadRadiographs();
}
