# Okta for Agents MVP

Express + TypeScript MVP for agent identity, policy enforcement, approvals, and audit logging.

## Run

Create env file first:

```bash
cp .env.example .env
```

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
npm start
```

Run with Docker (app + Postgres + Redis):

```bash
cp .env.example .env
docker compose up --build
```

Dev mode (watch compiler):

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run full test suite with local ephemeral Postgres (recommended for integration/e2e):

```bash
npm run test:with-db
```

Direct DB-backed test run (requires a reachable Postgres in `DATABASE_URL`):

```bash
npm run test:db
```

Default server: `http://localhost:8080`
API version prefix: `/v1` (legacy unversioned routes remain available)

Environment templates for deployment are included in `.env.staging.example` and `.env.production.example`.

## Environment variables

- `DATABASE_URL` (required, Postgres)
- `PORT` (default: `8080`)
- `TOKEN_SECRET` (default: `local-dev-secret-change-me`)
- `TOKEN_TTL_SECONDS` (default: `600`)
- `CORS_ORIGINS` (default: `http://localhost:3000,http://localhost:5173`)
- `JSON_BODY_LIMIT` (default: `100kb`)
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RATE_LIMIT_MAX_REQUESTS` (default: `120`)
- `TENANT_RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `TENANT_RATE_LIMIT_MAX_REQUESTS` (default: `240`)
- `AGENT_RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `AGENT_RATE_LIMIT_MAX_REQUESTS` (default: `120`)
- `CONNECTOR_RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `CONNECTOR_RATE_LIMIT_MAX_REQUESTS` (default: `180`)
- `TENANT_DAILY_QUOTA` (default: `10000`)
- `TENANT_QUOTA_OVERAGE_BEHAVIOR` (`block` or `allow_with_audit`, default: `block`)
- `CONNECTOR_TIMEOUT_MS` (default: `5000`)
- `CONNECTOR_RETRY_COUNT` (default: `2`)
- `CONNECTOR_RETRY_BACKOFF_MS` (default: `250`)
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: `5`)
- `CIRCUIT_BREAKER_OPEN_MS` (default: `30000`)
- `GITHUB_API_BASE_URL` (default: `https://api.github.com`)
- `JIRA_API_BASE_URL` (default: `https://your-domain.atlassian.net`)
- `SLACK_API_BASE_URL` (default: `https://slack.com/api`)
- `SLACK_BOT_TOKEN` (required for approval notifications)
- `SLACK_SIGNING_SECRET` (required for Slack callbacks)
- `SLACK_APPROVAL_CHANNEL` (required for approval notifications)
- `APPROVAL_EXPIRATION_SWEEP_MS` (default: `60000`)
- `ADMIN_UI_USERNAME` (default: `admin`)
- `ADMIN_UI_PASSWORD` (default: `change-me-admin`, change this in non-local environments)

## Admin UI

- URL: `http://localhost:8080/admin`
- Auth: HTTP Basic using `ADMIN_UI_USERNAME` and `ADMIN_UI_PASSWORD`
- Includes: tenant/agent management, policy editor + preview, approvals queue + decision panel, audit timeline view

## API flow

Optional: configure GitHub token for tenant before GitHub proxy actions.

```bash
curl -s -X POST http://localhost:8080/v1/connectors/github/credentials \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","token":"ghp_xxx"}'
```

Optional: configure Slack token for tenant before Slack proxy actions.

```bash
curl -s -X POST http://localhost:8080/v1/connectors/slack/credentials \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","token":"xoxb-xxx"}'
```

Optional: configure Jira token for tenant before Jira proxy actions.

```bash
curl -s -X POST http://localhost:8080/v1/connectors/jira/credentials \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","token":"jira_xxx"}'
```

1) Create an agent

```bash
curl -s -X POST http://localhost:8080/v1/agents \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","name":"release-agent","environment":"prod"}'
```

2) Create policy (allow)

```bash
curl -s -X POST http://localhost:8080/v1/policies \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","agentId":"<agentId>","connector":"github","actions":["read_pr"],"environment":"prod","effect":"allow"}'
```

3) Mint token

```bash
curl -s -X POST http://localhost:8080/v1/tokens/mint \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","agentId":"<agentId>"}'
```

4) Proxy call

```bash
curl -s -X POST http://localhost:8080/v1/proxy/github/read_pr \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"environment":"prod","payload":{"owner":"acme","repo":"api","pull_number":42}}'
```

GitHub comment example:

```bash
curl -s -X POST http://localhost:8080/v1/proxy/github/comment_pr \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"environment":"prod","payload":{"owner":"acme","repo":"api","issue_number":42,"body":"Looks good"}}'
```

## Approval flow

When policy decision is `require_approval`, proxy returns `202` with `approval.id`.

For production approval flow, configure your Slack app interactivity request URL to:

- `POST /integrations/slack/interactivity`

1) Resolve approval

```bash
curl -s -X POST http://localhost:8080/v1/approvals/<approvalId>/decision \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","approverId":"sec-lead-1","decision":"approved"}'
```

2) Replay proxy call with `approvalId`

```bash
curl -s -X POST http://localhost:8080/v1/proxy/slack/post_message \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"approvalId":"<approvalId>","environment":"prod","payload":{"channel":"#ops","text":"deploy complete"}}'
```

## Query endpoints

- `GET /v1/health`
- `GET /v1/policies?tenantId=acme&agentId=<agentId>`
- `GET /v1/audit-events?tenantId=acme&agentId=<agentId>&eventType=proxy.request`
- `GET /v1/approvals?tenantId=acme&status=pending`
- `GET /v1/connectors/health?tenantId=acme`

## Contract and examples

- OpenAPI: `openapi/openapi.yaml`
- Curl quickstart: `examples/curl/quickstart.sh`
- Postman collection: `examples/postman/okta-for-agents-mvp.postman_collection.json`

## TypeScript SDK + sample app

- SDK source: `src/sdk/typescript/index.ts`
- Sample agent app: `examples/agent-ts/index.ts`
- Run sample: `AGENT_ID=<agent-id> TENANT_ID=acme npm run example:agent`

## Load testing

```bash
npm run build
npm start
npm run loadtest
```

## Operations docs

- Backup/restore: `docs/operations/backup-restore.md`
- Migration rollout/rollback: `docs/operations/migration-rollout.md`
- Connector outage runbook: `docs/operations/connectors-runbook.md`
- SLOs and alert thresholds: `docs/operations/slo-alerts.md`

## Error troubleshooting

- Error catalog + fixes: `docs/error-catalog.md`
