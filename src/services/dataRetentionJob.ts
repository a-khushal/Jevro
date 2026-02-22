import { AUDIT_RETENTION_DAYS, APPROVAL_RETENTION_DAYS } from "../config";
import { runDataRetention } from "./dataRetention";

export function startDataRetentionJob(intervalMs: number): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      await runDataRetention({
        auditRetentionDays: AUDIT_RETENTION_DAYS,
        approvalRetentionDays: APPROVAL_RETENTION_DAYS
      });
    } catch (_error) {
      // Keep retention job alive on transient failures.
    }
  }, intervalMs);

  return timer;
}
