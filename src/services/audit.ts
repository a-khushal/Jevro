import { randomUUID } from "crypto";
import { auditEvents } from "../store";
import { AuditEvent } from "../types";
import { nowIso } from "../utils/time";

export function addAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
  const fullEvent: AuditEvent = {
    id: randomUUID(),
    timestamp: nowIso(),
    ...event
  };

  auditEvents.push(fullEvent);
  return fullEvent;
}
