# Connector Outage and Degraded Mode Runbook

## Detection

Trigger this runbook when one of these happens:

- `CONNECTOR_CIRCUIT_OPEN` errors increase.
- Proxy failures spike for a connector.
- External provider status page reports incident.

## Immediate Actions

1. Identify impacted connector (`github`, `slack`, `jira`).
2. Check `/v1/connectors/health?tenantId=<tenant>`.
3. Communicate degraded state to stakeholders.

## Mitigation

1. Route high-risk actions to `require_approval` policies.
2. Temporarily deny non-essential actions.
3. Retry after circuit window reopens.

## Recovery

1. Confirm provider recovery.
2. Verify successful proxy requests.
3. Revert temporary deny/approval policies.
4. Document incident timeline and preventive follow-up.
