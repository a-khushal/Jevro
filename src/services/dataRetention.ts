import {
  purgeAuditEventsBefore,
  purgeExpiredRevokedTokens,
  purgeExpiredIdempotencyRecords,
  purgeResolvedApprovalsBefore
} from "../db";

function getCutoff(days: number): Date {
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(Date.now() - days * msPerDay);
}

export async function runDataRetention(input: {
  auditRetentionDays: number;
  approvalRetentionDays: number;
}): Promise<{
  deletedAuditEvents: number;
  deletedApprovals: number;
  deletedRevokedTokens: number;
  deletedIdempotencyRecords: number;
}> {
  const now = new Date();
  const auditCutoff = getCutoff(input.auditRetentionDays);
  const approvalsCutoff = getCutoff(input.approvalRetentionDays);

  const [auditResult, approvalsResult, revokedTokensResult, idempotencyResult] = await Promise.all([
    purgeAuditEventsBefore(auditCutoff),
    purgeResolvedApprovalsBefore(approvalsCutoff),
    purgeExpiredRevokedTokens(now),
    purgeExpiredIdempotencyRecords(now)
  ]);

  return {
    deletedAuditEvents: auditResult.count,
    deletedApprovals: approvalsResult.count,
    deletedRevokedTokens: revokedTokensResult.count,
    deletedIdempotencyRecords: idempotencyResult.count
  };
}
