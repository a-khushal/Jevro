import { consumeApproval as consumeApprovalRecord, createApproval, getApprovalById, resolveApproval as resolveApprovalRecord } from "../db";
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

  const isExpired = approval.expiresAt.getTime() <= Date.now();
  if (
    approval.status !== "approved" ||
    isExpired ||
    approval.tenantId !== input.tenantId ||
    approval.agentId !== input.agentId ||
    approval.connector !== input.connector ||
    approval.action !== input.action
  ) {
    return null;
  }

  return toApprovalRequest(approval);
}

export async function consumeApproval(approvalId: string): Promise<void> {
  await consumeApprovalRecord(approvalId);
}
