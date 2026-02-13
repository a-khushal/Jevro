import {
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_OPEN_MS,
  CONNECTOR_RETRY_BACKOFF_MS,
  CONNECTOR_RETRY_COUNT,
  CONNECTOR_TIMEOUT_MS,
  GITHUB_API_BASE_URL
} from "../config";
import { getConnectorCredential } from "../db";
import { AppError } from "../errors";
import { nowIso } from "../utils/time";

const SUPPORTED_CONNECTORS = new Set(["slack", "github", "jira", "postgres"]);

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

const circuitStateByKey = new Map<string, CircuitState>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCircuitKey(tenantId: string, connector: string): string {
  return `${tenantId}:${connector}`;
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
}

function markConnectorFailure(tenantId: string, connector: string): void {
  const key = getCircuitKey(tenantId, connector);
  const current = circuitStateByKey.get(key) ?? { failures: 0, openUntil: 0 };
  const failures = current.failures + 1;
  const openUntil = failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD ? Date.now() + CIRCUIT_BREAKER_OPEN_MS : 0;
  circuitStateByKey.set(key, { failures, openUntil });
}

function getPayloadValue<T>(payload: Record<string, unknown>, key: string): T {
  return payload[key] as T;
}

function getGithubActionRequest(input: {
  action: string;
  payload: Record<string, unknown>;
}): { method: "GET" | "POST"; path: string; body?: Record<string, unknown> } {
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

  throw new AppError(400, "GITHUB_ACTION_UNSUPPORTED", `Unsupported GitHub action: ${input.action}`);
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

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(502, "GITHUB_API_ERROR", `GitHub API failed (${response.status})`, {
          status: response.status,
          requestId,
          body: text
        });
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        connector: input.connector,
        action: input.action,
        executedAt: nowIso(),
        result: "success",
        github: {
          requestId,
          rateRemaining,
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

export function isSupportedConnector(connector: string): boolean {
  return SUPPORTED_CONNECTORS.has(connector);
}

export async function executeConnectorAction(input: ConnectorExecutionInput): Promise<Record<string, unknown>> {
  assertCircuitClosed(input.tenantId, input.connector);

  try {
    let result: Record<string, unknown>;

    if (input.connector === "github") {
      result = await executeGithubAction(input);
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
    markConnectorFailure(input.tenantId, input.connector);
    throw error;
  }
}
