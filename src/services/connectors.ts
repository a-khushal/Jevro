import {
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_OPEN_MS,
  CONNECTOR_RETRY_BACKOFF_MS,
  CONNECTOR_RETRY_COUNT,
  CONNECTOR_TIMEOUT_MS,
  GITHUB_API_BASE_URL,
  JIRA_API_BASE_URL,
  POSTGRES_CONNECTOR_URL,
  POSTGRES_READONLY_MAX_ROWS,
  SLACK_API_BASE_URL
} from "../config";
import { getConnectorCredential } from "../db";
import { AppError } from "../errors";
import { nowIso } from "../utils/time";
import { Pool } from "pg";

const SUPPORTED_CONNECTORS = new Set(["slack", "github", "jira", "postgres"]);
const ACTIONS_BY_CONNECTOR: Record<string, Set<string>> = {
  github: new Set(["read_pr", "comment_pr", "merge_pr"]),
  slack: new Set(["post_message", "read_channel", "lookup_user"]),
  jira: new Set(["read_issue", "transition_issue"]),
  postgres: new Set(["query_readonly"])
};

const REQUIRED_SCOPES_BY_ACTION: Record<string, string[]> = {
  "github:read_pr": ["repo", "public_repo", "pull_request:read"],
  "github:comment_pr": ["repo", "public_repo", "issues:write"],
  "github:merge_pr": ["repo", "public_repo", "pull_request:write"],
  "slack:post_message": ["chat:write"],
  "slack:read_channel": ["channels:read", "groups:read"],
  "slack:lookup_user": ["users:read"],
  "jira:transition_issue": ["write:jira-work"]
};

const WRITE_ACTIONS = new Set([
  "github:comment_pr",
  "github:merge_pr",
  "slack:post_message",
  "jira:transition_issue"
]);

let postgresPool: Pool | null = null;

function getPostgresPool(): Pool {
  if (!postgresPool) {
    postgresPool = new Pool({ connectionString: POSTGRES_CONNECTOR_URL });
  }

  return postgresPool;
}

type ConnectorExecutionInput = {
  tenantId: string;
  connector: string;
  action: string;
  payload: Record<string, unknown>;
};

type CircuitState = {
  failures: number;
  openUntil: number;
};

type ConnectorTelemetry = {
  totalSuccess: number;
  totalFailure: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
};

const circuitStateByKey = new Map<string, CircuitState>();
const telemetryByKey = new Map<string, ConnectorTelemetry>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCircuitKey(tenantId: string, connector: string): string {
  return `${tenantId}:${connector}`;
}

function getCircuitStatus(tenantId: string, connector: string): "closed" | "open" {
  const state = circuitStateByKey.get(getCircuitKey(tenantId, connector));
  if (!state) {
    return "closed";
  }

  return state.openUntil > Date.now() ? "open" : "closed";
}

function assertCircuitClosed(tenantId: string, connector: string): void {
  const key = getCircuitKey(tenantId, connector);
  const state = circuitStateByKey.get(key);
  if (!state) {
    return;
  }

  if (state.openUntil > Date.now()) {
    throw new AppError(503, "CONNECTOR_CIRCUIT_OPEN", `${connector} connector is temporarily unavailable`);
  }

  state.openUntil = 0;
}

function markConnectorSuccess(tenantId: string, connector: string): void {
  const key = getCircuitKey(tenantId, connector);
  circuitStateByKey.set(key, { failures: 0, openUntil: 0 });

  const telemetry = telemetryByKey.get(key) ?? { totalSuccess: 0, totalFailure: 0 };
  telemetryByKey.set(key, {
    ...telemetry,
    totalSuccess: telemetry.totalSuccess + 1,
    lastSuccessAt: nowIso()
  });
}

function markConnectorFailure(tenantId: string, connector: string, error?: unknown): void {
  const key = getCircuitKey(tenantId, connector);
  const current = circuitStateByKey.get(key) ?? { failures: 0, openUntil: 0 };
  const failures = current.failures + 1;
  const openUntil = failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD ? Date.now() + CIRCUIT_BREAKER_OPEN_MS : 0;
  circuitStateByKey.set(key, { failures, openUntil });

  const telemetry = telemetryByKey.get(key) ?? { totalSuccess: 0, totalFailure: 0 };
  telemetryByKey.set(key, {
    ...telemetry,
    totalFailure: telemetry.totalFailure + 1,
    lastFailureAt: nowIso(),
    lastErrorCode: error instanceof AppError ? error.code : undefined,
    lastErrorMessage: error instanceof Error ? error.message : undefined
  });
}

function getPayloadValue<T>(payload: Record<string, unknown>, key: string): T {
  return payload[key] as T;
}

function parseCommaSeparatedHeader(headerValue: string | null): string[] {
  if (!headerValue) {
    return [];
  }

  return headerValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function assertActionScopes(input: { connector: string; action: string; grantedScopes: string[] }): void {
  const key = `${input.connector}:${input.action}`;
  const required = REQUIRED_SCOPES_BY_ACTION[key];
  if (!required || required.length === 0) {
    return;
  }

  if (input.grantedScopes.length === 0) {
    return;
  }

  if (!required.some((scope) => input.grantedScopes.includes(scope))) {
    throw new AppError(403, "CONNECTOR_SCOPE_MISSING", `Missing required scope for ${key}`, {
      requiredScopes: required,
      grantedScopes: input.grantedScopes
    });
  }
}

function getGithubActionRequest(input: {
  action: string;
  payload: Record<string, unknown>;
}): { method: "GET" | "POST" | "PUT"; path: string; body?: Record<string, unknown> } {
  if (input.action === "read_pr") {
    const owner = getPayloadValue<string>(input.payload, "owner");
    const repo = getPayloadValue<string>(input.payload, "repo");
    const pullNumber = getPayloadValue<number>(input.payload, "pull_number");

    if (!owner || !repo || typeof pullNumber !== "number") {
      throw new AppError(400, "GITHUB_PAYLOAD_INVALID", "read_pr requires owner, repo, pull_number");
    }

    return {
      method: "GET",
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}`
    };
  }

  if (input.action === "comment_pr") {
    const owner = getPayloadValue<string>(input.payload, "owner");
    const repo = getPayloadValue<string>(input.payload, "repo");
    const issueNumber = getPayloadValue<number>(input.payload, "issue_number");
    const body = getPayloadValue<string>(input.payload, "body");

    if (!owner || !repo || typeof issueNumber !== "number" || !body) {
      throw new AppError(400, "GITHUB_PAYLOAD_INVALID", "comment_pr requires owner, repo, issue_number, body");
    }

    return {
      method: "POST",
      path: `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      body: { body }
    };
  }

  if (input.action === "merge_pr") {
    const owner = getPayloadValue<string>(input.payload, "owner");
    const repo = getPayloadValue<string>(input.payload, "repo");
    const pullNumber = getPayloadValue<number>(input.payload, "pull_number");
    const mergeMethod = getPayloadValue<string>(input.payload, "merge_method") ?? "merge";

    if (!owner || !repo || typeof pullNumber !== "number") {
      throw new AppError(400, "GITHUB_PAYLOAD_INVALID", "merge_pr requires owner, repo, pull_number");
    }

    return {
      method: "PUT",
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
      body: {
        merge_method: mergeMethod
      }
    };
  }

  throw new AppError(400, "GITHUB_ACTION_UNSUPPORTED", `Unsupported GitHub action: ${input.action}`);
}

function getSlackActionRequest(input: {
  action: string;
  payload: Record<string, unknown>;
}): { method: "POST"; path: string; body: Record<string, unknown> } {
  if (input.action === "post_message") {
    const channel = getPayloadValue<string>(input.payload, "channel");
    const text = getPayloadValue<string>(input.payload, "text");

    if (!channel || !text) {
      throw new AppError(400, "SLACK_PAYLOAD_INVALID", "post_message requires channel and text");
    }

    return {
      method: "POST",
      path: "/chat.postMessage",
      body: { channel, text }
    };
  }

  if (input.action === "read_channel") {
    const channel = getPayloadValue<string>(input.payload, "channel");
    if (!channel) {
      throw new AppError(400, "SLACK_PAYLOAD_INVALID", "read_channel requires channel");
    }

    return {
      method: "POST",
      path: "/conversations.info",
      body: { channel }
    };
  }

  if (input.action === "lookup_user") {
    const user = getPayloadValue<string>(input.payload, "user");
    if (!user) {
      throw new AppError(400, "SLACK_PAYLOAD_INVALID", "lookup_user requires user");
    }

    return {
      method: "POST",
      path: "/users.info",
      body: { user }
    };
  }

  throw new AppError(400, "SLACK_ACTION_UNSUPPORTED", `Unsupported Slack action: ${input.action}`);
}

function getJiraActionRequest(input: {
  action: string;
  payload: Record<string, unknown>;
}): { method: "GET" | "POST"; path: string; body?: Record<string, unknown> } {
  if (input.action === "read_issue") {
    const issueKey = getPayloadValue<string>(input.payload, "issue_key");
    if (!issueKey) {
      throw new AppError(400, "JIRA_PAYLOAD_INVALID", "read_issue requires issue_key");
    }

    return {
      method: "GET",
      path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}`
    };
  }

  if (input.action === "transition_issue") {
    const issueKey = getPayloadValue<string>(input.payload, "issue_key");
    const transitionId = getPayloadValue<string>(input.payload, "transition_id");
    if (!issueKey || !transitionId) {
      throw new AppError(400, "JIRA_PAYLOAD_INVALID", "transition_issue requires issue_key and transition_id");
    }

    return {
      method: "POST",
      path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      body: {
        transition: {
          id: transitionId
        }
      }
    };
  }

  throw new AppError(400, "JIRA_ACTION_UNSUPPORTED", `Unsupported Jira action: ${input.action}`);
}

function getPostgresReadonlyRequest(input: {
  tenantId: string;
  payload: Record<string, unknown>;
}): { sql: string; values: unknown[] } {
  const queryId = getPayloadValue<string>(input.payload, "query_id");
  const params = (getPayloadValue<Record<string, unknown>>(input.payload, "params") ?? {}) as Record<string, unknown>;

  if (!queryId) {
    throw new AppError(400, "POSTGRES_PAYLOAD_INVALID", "query_readonly requires query_id");
  }

  if (queryId === "list_recent_audit_events") {
    const limitRaw = Number(params.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, POSTGRES_READONLY_MAX_ROWS)) : 20;
    return {
      sql: 'SELECT "id", "eventType", "status", "timestamp" FROM "AuditEvent" WHERE "tenantId" = $1 ORDER BY "timestamp" DESC LIMIT $2',
      values: [input.tenantId, limit]
    };
  }

  if (queryId === "list_pending_approvals") {
    const limitRaw = Number(params.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, POSTGRES_READONLY_MAX_ROWS)) : 20;
    return {
      sql: 'SELECT "id", "connector", "action", "status", "requestedAt" FROM "ApprovalRequest" WHERE "tenantId" = $1 AND "status" = $2 ORDER BY "requestedAt" DESC LIMIT $3',
      values: [input.tenantId, "pending", limit]
    };
  }

  throw new AppError(400, "POSTGRES_QUERY_NOT_ALLOWED", `Unsupported query_id: ${queryId}`);
}

async function executeGithubAction(input: ConnectorExecutionInput): Promise<Record<string, unknown>> {
  const credential = await getConnectorCredential({ tenantId: input.tenantId, connector: "github" });
  if (!credential) {
    throw new AppError(400, "GITHUB_CREDENTIALS_MISSING", "GitHub credentials not configured for tenant");
  }

  const request = getGithubActionRequest({ action: input.action, payload: input.payload });

  let lastError: unknown;
  const attempts = CONNECTOR_RETRY_COUNT + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTOR_TIMEOUT_MS);

    try {
      const response = await fetch(`${GITHUB_API_BASE_URL}${request.path}`, {
        method: request.method,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${credential.token}`,
          "x-github-api-version": "2022-11-28",
          "content-type": "application/json"
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal
      });

      const requestId = response.headers.get("x-github-request-id") ?? "unknown";
      const rateRemaining = response.headers.get("x-ratelimit-remaining") ?? "unknown";
      const grantedScopes = parseCommaSeparatedHeader(response.headers.get("x-oauth-scopes"));

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(502, "GITHUB_API_ERROR", `GitHub API failed (${response.status})`, {
          status: response.status,
          requestId,
          grantedScopes,
          body: text
        });
      }

      assertActionScopes({
        connector: "github",
        action: input.action,
        grantedScopes
      });

      const data = (await response.json()) as Record<string, unknown>;
      return {
        connector: input.connector,
        action: input.action,
        executedAt: nowIso(),
        result: "success",
        github: {
          requestId,
          rateRemaining,
          grantedScopes,
          status: response.status
        },
        data
      };
    } catch (error: unknown) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(CONNECTOR_RETRY_BACKOFF_MS * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GitHub connector failed");
}

async function executeSlackAction(input: ConnectorExecutionInput): Promise<Record<string, unknown>> {
  const credential = await getConnectorCredential({ tenantId: input.tenantId, connector: "slack" });
  if (!credential) {
    throw new AppError(400, "SLACK_CREDENTIALS_MISSING", "Slack credentials not configured for tenant");
  }

  const request = getSlackActionRequest({ action: input.action, payload: input.payload });

  let lastError: unknown;
  const attempts = CONNECTOR_RETRY_COUNT + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTOR_TIMEOUT_MS);

    try {
      const response = await fetch(`${SLACK_API_BASE_URL}${request.path}`, {
        method: request.method,
        headers: {
          authorization: `Bearer ${credential.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(request.body),
        signal: controller.signal
      });
      const grantedScopes = parseCommaSeparatedHeader(response.headers.get("x-oauth-scopes"));

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(502, "SLACK_API_ERROR", `Slack API failed (${response.status})`, {
          status: response.status,
          grantedScopes,
          body: text
        });
      }

      const data = (await response.json()) as { ok?: boolean; error?: string } & Record<string, unknown>;
      if (!data.ok) {
        if (data.error === "missing_scope") {
          throw new AppError(403, "CONNECTOR_SCOPE_MISSING", "Slack token missing required scope", {
            connector: "slack",
            action: input.action,
            grantedScopes
          });
        }

        throw new AppError(502, "SLACK_API_ERROR", `Slack API returned error: ${data.error ?? "unknown"}`);
      }

      assertActionScopes({
        connector: "slack",
        action: input.action,
        grantedScopes
      });

      return {
        connector: input.connector,
        action: input.action,
        executedAt: nowIso(),
        result: "success",
        slack: {
          grantedScopes,
          status: response.status
        },
        data
      };
    } catch (error: unknown) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(CONNECTOR_RETRY_BACKOFF_MS * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Slack connector failed");
}

async function executeJiraAction(input: ConnectorExecutionInput): Promise<Record<string, unknown>> {
  const credential = await getConnectorCredential({ tenantId: input.tenantId, connector: "jira" });
  if (!credential) {
    throw new AppError(400, "JIRA_CREDENTIALS_MISSING", "Jira credentials not configured for tenant");
  }

  const request = getJiraActionRequest({ action: input.action, payload: input.payload });

  let lastError: unknown;
  const attempts = CONNECTOR_RETRY_COUNT + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTOR_TIMEOUT_MS);

    try {
      const response = await fetch(`${JIRA_API_BASE_URL}${request.path}`, {
        method: request.method,
        headers: {
          authorization: `Bearer ${credential.token}`,
          accept: "application/json",
          "content-type": "application/json"
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(502, "JIRA_API_ERROR", `Jira API failed (${response.status})`, {
          status: response.status,
          body: text
        });
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        connector: input.connector,
        action: input.action,
        executedAt: nowIso(),
        result: "success",
        jira: {
          status: response.status
        },
        data
      };
    } catch (error: unknown) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(CONNECTOR_RETRY_BACKOFF_MS * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Jira connector failed");
}

async function executePostgresReadonlyAction(input: ConnectorExecutionInput): Promise<Record<string, unknown>> {
  if (input.action !== "query_readonly") {
    throw new AppError(400, "POSTGRES_ACTION_UNSUPPORTED", `Unsupported Postgres action: ${input.action}`);
  }

  const request = getPostgresReadonlyRequest({ tenantId: input.tenantId, payload: input.payload });
  const pool = getPostgresPool();
  const result = await pool.query(request.sql, request.values);

  return {
    connector: input.connector,
    action: input.action,
    executedAt: nowIso(),
    result: "success",
    postgres: {
      rowCount: result.rowCount
    },
    data: result.rows
  };
}

export function isSupportedConnector(connector: string): boolean {
  return SUPPORTED_CONNECTORS.has(connector);
}

export function isConnectorActionSupported(connector: string, action: string): boolean {
  const supportedActions = ACTIONS_BY_CONNECTOR[connector];
  return !!supportedActions && supportedActions.has(action);
}

export function getSupportedActionsForConnector(connector: string): string[] {
  return [...(ACTIONS_BY_CONNECTOR[connector] ?? new Set<string>())];
}

export function isWriteConnectorAction(connector: string, action: string): boolean {
  return WRITE_ACTIONS.has(`${connector}:${action}`);
}

function getRequiredScopesForConnector(connector: string): Record<string, string[]> {
  const scopes: Record<string, string[]> = {};
  for (const action of getSupportedActionsForConnector(connector)) {
    const key = `${connector}:${action}`;
    if (REQUIRED_SCOPES_BY_ACTION[key]) {
      scopes[action] = REQUIRED_SCOPES_BY_ACTION[key];
    }
  }

  return scopes;
}

export async function getConnectorHealthForTenant(input: {
  tenantId: string;
  connector: string;
}): Promise<{
  connector: string;
  configured: boolean;
  circuit: "open" | "closed";
  circuitFailures: number;
  circuitOpenUntil: string | null;
  supportedActions: string[];
  requiredScopesByAction: Record<string, string[]>;
  telemetry: ConnectorTelemetry;
}> {
  const configured = input.connector === "postgres"
    ? true
    : !!(await getConnectorCredential({ tenantId: input.tenantId, connector: input.connector }));
  const key = getCircuitKey(input.tenantId, input.connector);
  const circuitState = circuitStateByKey.get(key) ?? { failures: 0, openUntil: 0 };
  const telemetry = telemetryByKey.get(key) ?? { totalSuccess: 0, totalFailure: 0 };

  return {
    connector: input.connector,
    configured,
    circuit: getCircuitStatus(input.tenantId, input.connector),
    circuitFailures: circuitState.failures,
    circuitOpenUntil: circuitState.openUntil > 0 ? new Date(circuitState.openUntil).toISOString() : null,
    supportedActions: getSupportedActionsForConnector(input.connector),
    requiredScopesByAction: getRequiredScopesForConnector(input.connector),
    telemetry
  };
}

export async function executeConnectorAction(input: ConnectorExecutionInput): Promise<Record<string, unknown>> {
  assertCircuitClosed(input.tenantId, input.connector);

  try {
    let result: Record<string, unknown>;

    if (input.connector === "github") {
      result = await executeGithubAction(input);
    } else if (input.connector === "slack") {
      result = await executeSlackAction(input);
    } else if (input.connector === "jira") {
      result = await executeJiraAction(input);
    } else if (input.connector === "postgres") {
      result = await executePostgresReadonlyAction(input);
    } else {
      result = {
        connector: input.connector,
        action: input.action,
        executedAt: nowIso(),
        result: "success",
        forwardedPayload: input.payload
      };
    }

    markConnectorSuccess(input.tenantId, input.connector);
    return result;
  } catch (error) {
    markConnectorFailure(input.tenantId, input.connector, error);
    throw error;
  }
}
