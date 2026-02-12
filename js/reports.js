import { sb, requireElement, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { guardOrRedirect } from "./rbac.js";

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
  });
  return lines.join("\n");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function initReportsPage(profile) {
  if (!guardOrRedirect(profile.role, "reports.read")) return;

  const body = requireElement("reportsTbody");
  let cachedRows = [];

  const runReport = async () => {
    const type = requireElement("reportType").value;
    const from = requireElement("reportFrom").value;
    const to = requireElement("reportTo").value;

    let query = sb
      .from("visits")
      .select("id,visit_date,status,patient_id,clinician_id,users:clinician_id(full_name)")
      .gte("visit_date", from)
      .lte("visit_date", to)
      .order("visit_date", { ascending: false });

    const { data, error } = await query;
    if (error) {
      showToast(error.message, "error");
      return;
    }

    const aggregates = {};
    (data || []).forEach((v) => {
      const key = v.users?.full_name || v.clinician_id || "Unassigned";
      if (!aggregates[key]) aggregates[key] = 0;
      aggregates[key] += 1;
    });

    cachedRows = Object.entries(aggregates).map(([clinician, total]) => ({
      report_type: type,
      from,
      to,
      clinician,
      total_cases: total
    }));

    body.innerHTML = cachedRows.map((r) => `
      <tr>
        <td>${r.report_type}</td>
        <td>${r.from}</td>
        <td>${r.to}</td>
        <td>${r.clinician}</td>
        <td>${r.total_cases}</td>
      </tr>
    `).join("");

    await sb.from("reports_cache").insert({
      report_type: type,
      from_date: from,
      to_date: to,
      generated_by: profile.id,
      data: cachedRows
    });

    await logAudit("reports.generate", "reports_cache", null, { type, from, to });
  };

  requireElement("generateReportBtn").addEventListener("click", runReport);

  requireElement("exportCsvBtn").addEventListener("click", () => {
    if (!cachedRows.length) {
      showToast("Generate report first", "warning");
      return;
    }
    downloadFile(toCsv(cachedRows), "owas-report.csv", "text/csv");
  });

  requireElement("exportPdfBtn").addEventListener("click", () => {
    if (!cachedRows.length) {
      showToast("Generate report first", "warning");
      return;
    }

    const html = `
      <html><head><title>OWAS Report</title>
      <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}</style>
      </head><body>
      <h2>OWAS Report</h2>
      <table>
      <thead><tr><th>Type</th><th>From</th><th>To</th><th>Clinician</th><th>Total</th></tr></thead>
      <tbody>${cachedRows.map((r) => `<tr><td>${r.report_type}</td><td>${r.from}</td><td>${r.to}</td><td>${r.clinician}</td><td>${r.total_cases}</td></tr>`).join("")}</tbody>
      </table>
      <script>window.onload=()=>window.print();</script>
      </body></html>
    `;

    const popup = window.open("", "_blank");
    popup.document.write(html);
    popup.document.close();
  });
}
