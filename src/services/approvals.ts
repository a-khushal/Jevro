import { randomUUID } from "crypto";
import { approvals } from "../store";
import { ApprovalRequest, ApprovalStatus } from "../types";
import { nowIso } from "../utils/time";

const APPROVAL_TTL_MINUTES = 10;

function getExpiryIso(): string {
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000);
  return expiresAt.toISOString();
}

export function createApprovalRequest(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
}): ApprovalRequest {
  const approval: ApprovalRequest = {
    id: randomUUID(),
    tenantId: input.tenantId,
    agentId: input.agentId,
    connector: input.connector,
    action: input.action,
    status: "pending",
    requestedAt: nowIso(),
    expiresAt: getExpiryIso()
  };

  approvals.push(approval);
  return approval;
}

export function resolveApproval(input: {
  approvalId: string;
  approverId: string;
  status: Extract<ApprovalStatus, "approved" | "rejected">;
}): ApprovalRequest | null {
  const approval = approvals.find((item) => item.id === input.approvalId);
  if (!approval || approval.status !== "pending") {
    return null;
  }

  approval.status = input.status;
  approval.resolvedBy = input.approverId;
  approval.resolvedAt = nowIso();
  return approval;
}

export function getUsableApproval(input: {
  approvalId: string;
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
}): ApprovalRequest | null {
  const approval = approvals.find((item) => item.id === input.approvalId);
  if (!approval) {
    return null;
  }

  const isExpired = new Date(approval.expiresAt).getTime() <= Date.now();
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

  return approval;
}

export function consumeApproval(approvalId: string): void {
  const approval = approvals.find((item) => item.id === approvalId);
  if (!approval || approval.status !== "approved") {
    return;
  }

  approval.status = "consumed";
}
