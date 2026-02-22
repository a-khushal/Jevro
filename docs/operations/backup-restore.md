# Backup and Restore Strategy

## Backup

1. Run nightly logical backups with `pg_dump`.
2. Store encrypted snapshots in object storage with 30-day retention.
3. Run weekly restore drills in staging.

### Example backup command

```bash
pg_dump "$DATABASE_URL" --format=custom --file="backup-$(date +%F).dump"
```

## Restore

1. Provision an empty target database.
2. Apply restore from the selected backup file.
3. Run `npm run prisma:migrate:status`.
4. Run smoke tests (`/v1/health`, token mint flow).

### Example restore command

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" backup-2026-01-01.dump
```
