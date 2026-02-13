export type Environment = "dev" | "staging" | "prod";
export type Effect = "allow" | "deny" | "require_approval";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "consumed";

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  environment: Environment;
  createdAt: string;
}

export interface Policy {
  id: string;
  tenantId: string;
  agentId: string;
  connector: string;
  actions: string[];
  environment: Environment;
  effect: Effect;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  agentId?: string;
  eventType: string;
  connector?: string;
  action?: string;
  status: "success" | "failure";
  timestamp: string;
  details: Record<string, unknown>;
}

export interface TokenClaims {
  sub: string;
  tenantId: string;
  env: Environment;
  iat: number;
  exp: number;
}

export interface AuthorizeInput {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  environment: Environment;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  status: ApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
