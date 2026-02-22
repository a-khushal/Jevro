import { addAuditEvent } from "./audit";
import { expirePendingApprovals } from "./approvals";

export function startApprovalExpirationJob(intervalMs: number): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const expired = await expirePendingApprovals();

      for (const approval of expired) {
        await addAuditEvent({
          tenantId: approval.tenantId,
          agentId: approval.agentId,
          eventType: "approval.expired",
          connector: approval.connector,
          action: approval.action,
          status: "failure",
          details: { approvalId: approval.id, reason: "ttl_elapsed" }
        });
      }
    } catch (_error) {
      // Keep background job alive on transient failures.
    }
  }, intervalMs);

  return timer;
}
