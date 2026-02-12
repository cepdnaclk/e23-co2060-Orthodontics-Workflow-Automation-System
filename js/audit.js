import { sb } from "./supabaseClient.js";

// Centralized audit logger so all modules can record access and mutations.
export async function logAudit(action, entityType, entityId = null, metadata = {}) {
  const { data } = await sb.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return;

  await sb.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });
}
