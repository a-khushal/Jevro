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

Dev mode (watch compiler):

```bash
npm run dev
```

Default server: `http://localhost:8080`

## Environment variables

- `DATABASE_URL` (required, Postgres)
- `PORT` (default: `8080`)
- `TOKEN_SECRET` (default: `local-dev-secret-change-me`)
- `TOKEN_TTL_SECONDS` (default: `600`)
- `CORS_ORIGINS` (default: `http://localhost:3000,http://localhost:5173`)
- `JSON_BODY_LIMIT` (default: `100kb`)
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RATE_LIMIT_MAX_REQUESTS` (default: `120`)
- `CONNECTOR_TIMEOUT_MS` (default: `5000`)
- `CONNECTOR_RETRY_COUNT` (default: `2`)
- `CONNECTOR_RETRY_BACKOFF_MS` (default: `250`)
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: `5`)
- `CIRCUIT_BREAKER_OPEN_MS` (default: `30000`)
- `GITHUB_API_BASE_URL` (default: `https://api.github.com`)
- `SLACK_BOT_TOKEN` (required for approval notifications)
- `SLACK_SIGNING_SECRET` (required for Slack callbacks)
- `SLACK_APPROVAL_CHANNEL` (required for approval notifications)

## API flow

Optional: configure GitHub token for tenant before GitHub proxy actions.

```bash
curl -s -X POST http://localhost:8080/connectors/github/credentials \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","token":"ghp_xxx"}'
```

1) Create an agent

```bash
curl -s -X POST http://localhost:8080/agents \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","name":"release-agent","environment":"prod"}'
```

2) Create policy (allow)

```bash
curl -s -X POST http://localhost:8080/policies \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","agentId":"<agentId>","connector":"github","actions":["read_pr"],"environment":"prod","effect":"allow"}'
```

3) Mint token

```bash
curl -s -X POST http://localhost:8080/tokens/mint \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","agentId":"<agentId>"}'
```

4) Proxy call

```bash
curl -s -X POST http://localhost:8080/proxy/github/read_pr \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"payload":{"owner":"acme","repo":"api","pull_number":42}}'
```

GitHub comment example:

```bash
curl -s -X POST http://localhost:8080/proxy/github/comment_pr \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"payload":{"owner":"acme","repo":"api","issue_number":42,"body":"Looks good"}}'
```

## Approval flow

When policy decision is `require_approval`, proxy returns `202` with `approval.id`.

For production approval flow, configure your Slack app interactivity request URL to:

- `POST /integrations/slack/interactivity`

1) Resolve approval

```bash
curl -s -X POST http://localhost:8080/approvals/<approvalId>/decision \
  -H "content-type: application/json" \
  -d '{"approverId":"sec-lead-1","decision":"approved"}'
```

2) Replay proxy call with `approvalId`

```bash
curl -s -X POST http://localhost:8080/proxy/slack/post_message \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{"approvalId":"<approvalId>","payload":{"channel":"#ops","text":"deploy complete"}}'
```

## Query endpoints

- `GET /health`
- `GET /policies?tenantId=acme&agentId=<agentId>`
- `GET /audit-events?tenantId=acme&agentId=<agentId>&eventType=proxy.request`
- `GET /approvals?tenantId=acme&status=pending`
