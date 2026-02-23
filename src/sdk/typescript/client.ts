export type AgentEnvironment = "dev" | "staging" | "prod";
export type ProxyDecision = "allow" | "deny" | "require_approval";
export type ApprovalDecision = "approved" | "rejected";

export type MintTokenResponse = {
  token: string;
  expiresInSeconds: number;
  kid?: string;
  jti?: string;
};

export type ProxyResult = {
  decision: ProxyDecision;
  providerResponse?: Record<string, unknown>;
  approval?: {
    id: string;
    tenantId: string;
    agentId: string;
    connector: string;
    action: string;
    status: string;
    requestedAt: string;
    expiresAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
  };
  message?: string;
};

export type ClientConfig = {
  baseUrl: string;
  getToken?: () => string | undefined;
};

export type RunActionInput = {
  connector: string;
  action: string;
  payload: Record<string, unknown>;
  environment?: AgentEnvironment;
  approvalId?: string;
};

type ResolveApprovalInput = {
  approvalId: string;
  tenantId: string;
  approverId: string;
  decision: ApprovalDecision;
};

type RequestInitWithJson = {
  method: "GET" | "POST";
  token?: string;
  body?: unknown;
};

export class OktaForAgentsClient {
  private readonly baseUrl: string;

  private readonly getToken?: () => string | undefined;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.getToken = config.getToken;
  }

  async mintToken(input: { tenantId: string; agentId: string }): Promise<MintTokenResponse> {
    return this.requestJson<MintTokenResponse>("/tokens/mint", {
      method: "POST",
      body: input
    });
  }

  async runAction(input: RunActionInput): Promise<ProxyResult> {
    const token = this.requireToken();
    return this.requestJson<ProxyResult>(`/proxy/${input.connector}/${input.action}`, {
      method: "POST",
      token,
      body: {
        payload: input.payload,
        environment: input.environment,
        approvalId: input.approvalId
      }
    });
  }

  async resolveApproval(input: ResolveApprovalInput): Promise<{ approval: Record<string, unknown> }> {
    return this.requestJson<{ approval: Record<string, unknown> }>(`/approvals/${input.approvalId}/decision`, {
      method: "POST",
      body: {
        tenantId: input.tenantId,
        approverId: input.approverId,
        decision: input.decision
      }
    });
  }

  async replayApprovedAction(input: {
    connector: string;
    action: string;
    payload: Record<string, unknown>;
    approvalId: string;
    environment?: AgentEnvironment;
  }): Promise<ProxyResult> {
    return this.runAction({
      connector: input.connector,
      action: input.action,
      payload: input.payload,
      approvalId: input.approvalId,
      environment: input.environment
    });
  }

  private requireToken(): string {
    const token = this.getToken?.();
    if (!token) {
      throw new Error("No bearer token available. Configure getToken() and mint/assign token first.");
    }

    return token;
  }

  private async requestJson<T>(path: string, init: RequestInitWithJson): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (init.token) {
      headers.authorization = `Bearer ${init.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });

    const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const code = typeof responseBody.code === "string" ? responseBody.code : "HTTP_ERROR";
      const message = typeof responseBody.error === "string" ? responseBody.error : `Request failed: ${response.status}`;
      throw new Error(`${code}: ${message}`);
    }

    return responseBody as T;
  }
}
