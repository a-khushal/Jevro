import {
  consumeApproval as consumeApprovalRecord,
  createApproval,
  expireApproval,
  getApprovalById,
  listExpiredPendingApprovals,
  resolveApproval as resolveApprovalRecord
} from "../db";
import { ApprovalRequest, ApprovalStatus } from "../types";

const APPROVAL_TTL_MINUTES = 10;

function getExpiryDate(): Date {
  return new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000);
}

function toApprovalRequest(record: {
  id: string;
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  status: string;
  requestedAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}): ApprovalRequest {
  return {
    id: record.id,
    tenantId: record.tenantId,
    agentId: record.agentId,
    connector: record.connector,
    action: record.action,
    status: record.status as ApprovalStatus,
    requestedAt: record.requestedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : undefined,
    resolvedBy: record.resolvedBy ?? undefined
  };
}

export function isApprovalUsable(
  approval: {
    tenantId: string;
    agentId: string;
    connector: string;
    action: string;
    status: string;
    expiresAt: Date;
  },
  input: {
    tenantId: string;
    agentId: string;
    connector: string;
    action: string;
  }
): boolean {
  const isExpired = approval.expiresAt.getTime() <= Date.now();
  return !(
    approval.status !== "approved" ||
    isExpired ||
    approval.tenantId !== input.tenantId ||
    approval.agentId !== input.agentId ||
    approval.connector !== input.connector ||
    approval.action !== input.action
  );
}

export async function createApprovalRequest(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
}): Promise<ApprovalRequest> {
  const created = await createApproval({
    tenantId: input.tenantId,
    agentId: input.agentId,
    connector: input.connector,
    action: input.action,
    requestedAt: new Date(),
    expiresAt: getExpiryDate()
  });

  return toApprovalRequest(created);
}

export async function resolveApproval(input: {
  approvalId: string;
  tenantId?: string;
  approverId: string;
  status: Extract<ApprovalStatus, "approved" | "rejected">;
}): Promise<ApprovalRequest | null> {
  const updated = await resolveApprovalRecord(input);
  if (updated.count === 0) {
    return null;
  }

  const approval = await getApprovalById(input.approvalId);
  if (!approval) {
    return null;
  }

  return toApprovalRequest(approval);
}

export async function getUsableApproval(input: {
  approvalId: string;
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
}): Promise<ApprovalRequest | null> {
  const approval = await getApprovalById(input.approvalId);
  if (!approval) {
    return null;
  }

  if (!isApprovalUsable(approval, input)) {
    return null;
  }

  return toApprovalRequest(approval);
}

export async function consumeApproval(approvalId: string): Promise<void> {
  await consumeApprovalRecord(approvalId);
}

export async function expirePendingApprovals(batchSize = 100): Promise<ApprovalRequest[]> {
  const now = new Date();
  const pending = await listExpiredPendingApprovals({ now, limit: batchSize });
  if (pending.length === 0) {
    return [];
  }

  const expired: ApprovalRequest[] = [];
  for (const approval of pending) {
    const updated = await expireApproval(approval.id, now);
    if (updated.count > 0) {
      expired.push(
        toApprovalRequest({
          ...approval,
          status: "expired",
          resolvedAt: now,
          resolvedBy: "system:auto-expire"
        })
      );
    }
  }

  return expired;
}
