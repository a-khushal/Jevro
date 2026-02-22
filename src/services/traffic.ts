import {
  AGENT_RATE_LIMIT_MAX_REQUESTS,
  AGENT_RATE_LIMIT_WINDOW_MS,
  CONNECTOR_RATE_LIMIT_MAX_REQUESTS,
  CONNECTOR_RATE_LIMIT_WINDOW_MS,
  TENANT_DAILY_QUOTA,
  TENANT_QUOTA_OVERAGE_BEHAVIOR,
  TENANT_RATE_LIMIT_MAX_REQUESTS,
  TENANT_RATE_LIMIT_WINDOW_MS
} from "../config";
import { AppError } from "../errors";

type CounterWindow = {
  startedAtMs: number;
  count: number;
};

type DailyQuotaCounter = {
  day: string;
  count: number;
};

type EnforceTrafficInput = {
  tenantId: string;
  agentId: string;
  connector: string;
};

type EnforceTrafficResult = {
  quotaExceeded: boolean;
};

const tenantWindowCounters = new Map<string, CounterWindow>();
const agentWindowCounters = new Map<string, CounterWindow>();
const connectorWindowCounters = new Map<string, CounterWindow>();
const tenantDailyQuotaCounters = new Map<string, DailyQuotaCounter>();

function nowMs(): number {
  return Date.now();
}

function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function incrementWindowCounter(input: {
  store: Map<string, CounterWindow>;
  key: string;
  windowMs: number;
  maxRequests: number;
  code: string;
  label: string;
  now: number;
}): void {
  const current = input.store.get(input.key);
  if (!current || input.now - current.startedAtMs >= input.windowMs) {
    input.store.set(input.key, { startedAtMs: input.now, count: 1 });
    return;
  }

  const nextCount = current.count + 1;
  if (nextCount > input.maxRequests) {
    throw new AppError(429, input.code, `${input.label} rate limit exceeded`);
  }

  input.store.set(input.key, { startedAtMs: current.startedAtMs, count: nextCount });
}

function checkAndIncrementTenantDailyQuota(tenantId: string, now: Date): boolean {
  const day = getDayKey(now);
  const current = tenantDailyQuotaCounters.get(tenantId);

  if (!current || current.day !== day) {
    tenantDailyQuotaCounters.set(tenantId, { day, count: 1 });
    return false;
  }

  if (current.count >= TENANT_DAILY_QUOTA) {
    if (TENANT_QUOTA_OVERAGE_BEHAVIOR === "allow_with_audit") {
      return true;
    }

    throw new AppError(429, "TENANT_QUOTA_EXCEEDED", "Tenant daily quota exceeded");
  }

  tenantDailyQuotaCounters.set(tenantId, { day, count: current.count + 1 });
  return false;
}

export function enforceTrafficControls(input: EnforceTrafficInput): EnforceTrafficResult {
  const now = nowMs();

  incrementWindowCounter({
    store: tenantWindowCounters,
    key: input.tenantId,
    windowMs: TENANT_RATE_LIMIT_WINDOW_MS,
    maxRequests: TENANT_RATE_LIMIT_MAX_REQUESTS,
    code: "TENANT_RATE_LIMITED",
    label: "Tenant",
    now
  });

  incrementWindowCounter({
    store: agentWindowCounters,
    key: `${input.tenantId}:${input.agentId}`,
    windowMs: AGENT_RATE_LIMIT_WINDOW_MS,
    maxRequests: AGENT_RATE_LIMIT_MAX_REQUESTS,
    code: "AGENT_RATE_LIMITED",
    label: "Agent",
    now
  });

  incrementWindowCounter({
    store: connectorWindowCounters,
    key: `${input.tenantId}:${input.connector}`,
    windowMs: CONNECTOR_RATE_LIMIT_WINDOW_MS,
    maxRequests: CONNECTOR_RATE_LIMIT_MAX_REQUESTS,
    code: "CONNECTOR_RATE_LIMITED",
    label: "Connector",
    now
  });

  const quotaExceeded = checkAndIncrementTenantDailyQuota(input.tenantId, new Date(now));
  return { quotaExceeded };
}

export function resetTrafficControlsForTests(): void {
  tenantWindowCounters.clear();
  agentWindowCounters.clear();
  connectorWindowCounters.clear();
  tenantDailyQuotaCounters.clear();
}
