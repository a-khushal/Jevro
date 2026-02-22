# Migration Rollout and Rollback Plan

## Rollout

1. Validate migration locally: `npm run prisma:migrate:status`.
2. Apply to staging: `npm run prisma:deploy`.
3. Run integration tests and smoke tests in staging.
4. Apply to production during a change window.
5. Monitor API error rates and DB locks for 30 minutes.

## Rollback

1. If migration is backward compatible: deploy previous app version only.
2. If migration is destructive: restore from latest verified backup.
3. Re-run `npm run prisma:migrate:status` and smoke tests.

## Safety Rules

- Avoid destructive schema changes without a two-step rollout.
- Prefer additive migrations first, cleanup migrations later.
- Always have a tested backup from within the last 24 hours.
