# Error Catalog and Troubleshooting

## Common API Errors

| Code | Meaning | Typical fix |
| --- | --- | --- |
| `MISSING_BEARER_TOKEN` | Proxy call missing auth header | Send `Authorization: Bearer <token>` |
| `INVALID_TOKEN` | Token invalid or expired | Mint a fresh token via `/v1/tokens/mint` |
| `INVALID_AGENT` | Agent does not belong to tenant | Verify `tenantId` + `agentId` pair |
| `AGENT_ENVIRONMENT_MISMATCH` | Agent environment does not match request/policy | Use matching `environment` values |
| `UNSUPPORTED_CONNECTOR` | Unknown connector id | Use one of `github`, `slack`, `jira`, `postgres` |
| `UNSUPPORTED_CONNECTOR_ACTION` | Action is not valid for connector | Check connector/action matrix in policy |
| `CONNECTOR_SCOPE_MISSING` | Credential token lacks required scope | Re-issue token with proper scopes |
| `CONNECTOR_CIRCUIT_OPEN` | Connector temporarily blocked after failures | Retry after cooldown, inspect provider outage |
| `TENANT_RATE_LIMITED` | Tenant request window exceeded | Backoff/retry with jitter |
| `AGENT_RATE_LIMITED` | Agent request window exceeded | Reduce per-agent burst traffic |
| `CONNECTOR_RATE_LIMITED` | Connector request window exceeded | Spread traffic across time window |
| `TENANT_QUOTA_EXCEEDED` | Tenant daily quota reached | Increase quota or wait for next day window |
| `APPROVAL_NOT_FOUND` | Approval missing, already resolved, wrong tenant | Verify approval id and tenant |
| `SLACK_SIGNATURE_INVALID` | Invalid Slack callback signature | Verify `SLACK_SIGNING_SECRET` and request body handling |

## Fast Troubleshooting Checklist

1. Confirm env config with `npm run prisma:validate` and `.env` values.
2. Check health endpoint: `GET /v1/health`.
3. Verify tenant-scoped list requests include `tenantId` query.
4. Reproduce with API examples in `examples/curl/quickstart.sh`.
5. Inspect recent events: `GET /v1/audit-events?tenantId=<tenant>`.
6. If connector failures persist, follow `docs/operations/connectors-runbook.md`.
