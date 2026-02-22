import { SECURITY_ALERT_THRESHOLD, SECURITY_ALERT_WINDOW_MS } from "../config";
import { sendSlackOperationalAlert } from "./slack";

type SecuritySignal = "token_failure" | "policy_bypass_attempt";

type SignalWindow = {
  timestamps: number[];
  lastAlertAt: number;
};

const signalWindows = new Map<string, SignalWindow>();

function getSignalKey(signal: SecuritySignal, tenantId?: string): string {
  return `${signal}:${tenantId ?? "global"}`;
}

function pruneOldTimestamps(timestamps: number[], now: number): number[] {
  const minTime = now - SECURITY_ALERT_WINDOW_MS;
  return timestamps.filter((value) => value >= minTime);
}

export async function recordSecuritySignal(input: {
  signal: SecuritySignal;
  tenantId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const now = Date.now();
  const key = getSignalKey(input.signal, input.tenantId);
  const current = signalWindows.get(key) ?? { timestamps: [], lastAlertAt: 0 };
  const nextTimestamps = pruneOldTimestamps([...current.timestamps, now], now);
  const nextState: SignalWindow = { timestamps: nextTimestamps, lastAlertAt: current.lastAlertAt };
  signalWindows.set(key, nextState);

  if (nextTimestamps.length < SECURITY_ALERT_THRESHOLD) {
    return;
  }

  if (now - nextState.lastAlertAt < SECURITY_ALERT_WINDOW_MS) {
    return;
  }

  nextState.lastAlertAt = now;
  signalWindows.set(key, nextState);

  const detailsText = input.details ? JSON.stringify(input.details) : "{}";
  await sendSlackOperationalAlert(
    `Security alert: ${input.signal} crossed threshold for tenant ${input.tenantId ?? "global"}. ` +
      `count=${nextTimestamps.length} windowMs=${SECURITY_ALERT_WINDOW_MS} details=${detailsText}`
  );
}

export function getSecuritySignalSnapshot(): Record<string, { count: number; windowMs: number; threshold: number }> {
  const snapshot: Record<string, { count: number; windowMs: number; threshold: number }> = {};

  for (const [key, state] of signalWindows.entries()) {
    snapshot[key] = {
      count: pruneOldTimestamps(state.timestamps, Date.now()).length,
      windowMs: SECURITY_ALERT_WINDOW_MS,
      threshold: SECURITY_ALERT_THRESHOLD
    };
  }

  return snapshot;
}
