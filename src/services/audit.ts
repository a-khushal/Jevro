import { AuditEvent } from "../types";
import { createAuditEvent } from "../db";

export async function addAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<AuditEvent> {
  const created = await createAuditEvent(event);
  return {
    id: created.id,
    tenantId: created.tenantId,
    agentId: created.agentId ?? undefined,
    eventType: created.eventType,
    connector: created.connector ?? undefined,
    action: created.action ?? undefined,
    status: created.status as "success" | "failure",
    timestamp: created.timestamp.toISOString(),
    details: created.details as Record<string, unknown>
  };
}
