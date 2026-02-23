import { createHash } from "crypto";
import { AuditEvent } from "../types";
import { createAuditEvent, getLatestAuditEventForTenant } from "../db";
import { getRequestId } from "./requestContext";

function computeIntegrityHash(input: {
  tenantId: string;
  eventType: string;
  connector?: string;
  action?: string;
  status: string;
  details: Record<string, unknown>;
  previousHash?: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        eventType: input.eventType,
        connector: input.connector,
        action: input.action,
        status: input.status,
        details: input.details,
        previousHash: input.previousHash ?? null
      })
    )
    .digest("hex");
}

export async function addAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<AuditEvent> {
  const previous = await getLatestAuditEventForTenant(event.tenantId);
  const previousMeta = previous?.details as { _meta?: { integrityHash?: string } } | undefined;
  const previousHash = previousMeta?._meta?.integrityHash;
  const requestId = getRequestId();
  const integrityHash = computeIntegrityHash({
    tenantId: event.tenantId,
    eventType: event.eventType,
    connector: event.connector,
    action: event.action,
    status: event.status,
    details: event.details,
    previousHash
  });

  const details = {
    ...event.details,
    _meta: {
      requestId,
      previousEventId: previous?.id ?? null,
      previousHash: previousHash ?? null,
      integrityHash
    }
  };

  const created = await createAuditEvent({
    ...event,
    details
  });
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
