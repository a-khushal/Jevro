const REDACTED_KEYS = new Set([
  "authorization",
  "token",
  "secret",
  "password",
  "slack_bot_token",
  "slack_signing_secret"
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactValue(nested);
      }
    }

    return result;
  }

  return value;
}

export function logStructured(event: string, data: Record<string, unknown>): void {
  const redacted = redactValue(data) as Record<string, unknown>;
  const payload = {
    event,
    ...redacted,
    loggedAt: new Date().toISOString()
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
