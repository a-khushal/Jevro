# TypeScript Agent Example

This example uses the local TypeScript SDK wrapper to:

1. Mint an agent token
2. Attempt a connector action
3. Handle `require_approval` and replay after approval

## Run

```bash
AGENT_ID=<agent-id> TENANT_ID=acme npm run example:agent
```

Optional auto-approve for local testing:

```bash
AGENT_ID=<agent-id> TENANT_ID=acme AUTO_APPROVE=1 APPROVER_ID=sec-lead-1 npm run example:agent
```
