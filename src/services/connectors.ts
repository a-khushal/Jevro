import { nowIso } from "../utils/time";

const SUPPORTED_CONNECTORS = new Set(["slack", "github", "jira", "postgres"]);

export function isSupportedConnector(connector: string): boolean {
  return SUPPORTED_CONNECTORS.has(connector);
}

export function executeConnectorAction(input: {
  connector: string;
  action: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    connector: input.connector,
    action: input.action,
    executedAt: nowIso(),
    result: "success",
    forwardedPayload: input.payload
  };
}
