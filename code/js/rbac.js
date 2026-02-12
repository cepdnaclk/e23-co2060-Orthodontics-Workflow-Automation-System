import { showToast } from "./supabaseClient.js";

export const permissions = {
  Admin: ["*"],
  ConsultantOrthodontist: ["patients.read", "patients.write", "radiographs.read", "reports.read", "queue.manage", "appointments.manage", "cases.approve", "logbook.verify", "materials.read"],
  DentalSurgeon: ["patients.read", "patients.write", "radiographs.read", "appointments.manage", "queue.manage", "reports.read"],
  Clinician: ["patients.read", "patients.write", "radiographs.read", "appointments.manage", "queue.manage"],
  Nurse: ["patients.read", "appointments.manage", "queue.manage", "materials.read", "materials.write"],
  Student: ["patients.read", "cases.submit", "logbook.write", "radiographs.read.own"]
};

export function can(role, permission) {
  const grants = permissions[role] || [];
  return grants.includes("*") || grants.includes(permission);
}

export function guardOrRedirect(role, permission, redirect = "dashboard.html") {
  if (!can(role, permission)) {
    showToast("Access denied for this role", "error");
    window.location.href = redirect;
    return false;
  }
  return true;
}

export function applyPermissionVisibility(role) {
  document.querySelectorAll("[data-permission]").forEach((node) => {
    const permission = node.getAttribute("data-permission");
    if (!can(role, permission)) {
      node.classList.add("hidden");
    }
  });
}
