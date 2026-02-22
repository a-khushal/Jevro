# Tenant Isolation Audit Sweep

## Scope

This sweep verifies that tenant context is enforced across query and mutation paths:

- list endpoints require `tenantId`
- token mint requires tenant-owned `agentId`
- approval decisions require matching tenant
- policy updates/deletes require matching tenant
- connector health requires tenant context

## Automated coverage

- `src/routes/integration.api.test.ts`
- `src/routes/security.tenant-isolation.test.ts`
- `src/routes/policy.lifecycle.test.ts`

Run strict suite with DB:

```bash
npm run test:with-db
```
