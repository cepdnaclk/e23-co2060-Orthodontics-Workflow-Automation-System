import { sb, formatDate, requireElement, showToast } from "./supabaseClient.js";
import { logAudit } from "./audit.js";
import { can, guardOrRedirect } from "./rbac.js";

export async function initMaterialsPage(profile) {
  if (!guardOrRedirect(profile.role, "materials.read")) return;

  const form = requireElement("materialsForm");
  const usageForm = requireElement("materialUsageForm");
  const body = requireElement("materialsTbody");

  const loadMaterials = async () => {
    const { data, error } = await sb.from("materials").select("*").order("name");
    if (error) {
      showToast(error.message, "error");
      return;
    }

    body.innerHTML = (data || []).map((m) => {
      const low = Number(m.current_stock) <= Number(m.threshold);
      return `
        <tr>
          <td>${m.name}</td>
          <td>${m.current_stock}</td>
          <td>${m.threshold}</td>
          <td>${formatDate(m.updated_at)}</td>
          <td>${low ? '<span class="badge low">Low stock</span>' : 'Normal'}</td>
        </tr>
      `;
    }).join("");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!can(profile.role, "materials.write")) {
      showToast("No permission to add materials", "error");
      return;
    }

    const payload = {
      name: requireElement("materialName").value.trim(),
      current_stock: Number(requireElement("materialStock").value),
      threshold: Number(requireElement("materialThreshold").value)
    };

    const { data, error } = await sb.from("materials").insert(payload).select("id").single();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    await logAudit("materials.create", "materials", data.id, payload);
    showToast("Material added", "success");
    form.reset();
    loadMaterials();
  });

  usageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!can(profile.role, "materials.write")) {
      showToast("No permission to log usage", "error");
      return;
    }

    const materialId = requireElement("usageMaterialId").value.trim();
    const usedQty = Number(requireElement("usageQty").value);

    const { data: material, error: mErr } = await sb.from("materials").select("id,current_stock").eq("id", materialId).single();
    if (mErr) {
      showToast(mErr.message, "error");
      return;
    }

    const newStock = Number(material.current_stock) - usedQty;

    const { data, error } = await sb.from("material_usage").insert({
      material_id: materialId,
      used_qty: usedQty,
      used_by: profile.id,
      notes: requireElement("usageNotes").value.trim()
    }).select("id").single();

    if (error) {
      showToast(error.message, "error");
      return;
    }

    const { error: uErr } = await sb.from("materials").update({
      current_stock: newStock,
      updated_at: new Date().toISOString()
    }).eq("id", materialId);

    if (uErr) {
      showToast(uErr.message, "error");
      return;
    }

    await logAudit("materials.consume", "material_usage", data.id, { material_id: materialId, used_qty: usedQty });
    usageForm.reset();
    showToast("Material usage recorded", "success");
    loadMaterials();
  });

  if (!can(profile.role, "materials.write")) {
    form.classList.add("hidden");
    usageForm.classList.add("hidden");
  }

  loadMaterials();
}
