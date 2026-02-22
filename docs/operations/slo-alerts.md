# SLOs and Alert Thresholds

## Availability SLO

- Target: 99.9% monthly availability for `/v1/health`, `/v1/tokens/mint`, and `/v1/proxy/*`.
- Error budget: 43m 49s of monthly downtime.

## Latency SLO

- Gateway proxy p95: under 150ms for policy decision + routing overhead.
- Gateway proxy p99: under 250ms for baseline requests (excluding third-party connector latency).

## Approval Flow SLO

- Approval creation success rate: 99.5%+
- Approval decision to replay eligibility: under 2s p95.

## Alert Thresholds

- `proxy.request` failure rate > 5% for 5 minutes: page on-call.
- `CONNECTOR_CIRCUIT_OPEN` occurrences > 20 in 10 minutes: page on-call.
- `INVALID_TOKEN` or auth failures spike > 3x baseline for 10 minutes: security alert.
- Approval pending over TTL count > 0 for 5 minutes: ticket + warning.

## Runbook Links

- Connector outage: `docs/operations/connectors-runbook.md`
- Backup/restore: `docs/operations/backup-restore.md`
- Migration rollout: `docs/operations/migration-rollout.md`
