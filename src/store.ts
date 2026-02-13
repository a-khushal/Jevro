import { Agent, ApprovalRequest, AuditEvent, Policy } from "./types";

export const agents = new Map<string, Agent>();
export const policies: Policy[] = [];
export const auditEvents: AuditEvent[] = [];
export const approvals: ApprovalRequest[] = [];
