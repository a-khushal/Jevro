# Data Retention Policy

## Controls

- `AUDIT_RETENTION_DAYS`: audit event retention window.
- `APPROVAL_RETENTION_DAYS`: resolved approval retention window.
- `RETENTION_SWEEP_MS`: retention job interval.

## Current behavior

The background retention job purges:

1. `AuditEvent` rows older than audit retention cutoff.
2. `ApprovalRequest` rows in terminal states (`approved`, `rejected`, `consumed`, `expired`) older than approval retention cutoff.
3. Expired entries from `RevokedToken`.

## Verification

Run strict DB-backed tests:

```bash
npm run test:with-db
```

The retention behavior is covered by `src/services/dataRetention.test.ts`.
