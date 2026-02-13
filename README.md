# Okta for Agents MVP

Express + TypeScript MVP for agent identity, policy enforcement, approvals, and audit logging.

## Run

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

## API flow

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
  -d '{"payload":{"repo":"acme/api"}}'
```

## Approval flow

When policy decision is `require_approval`, proxy returns `202` with `approval.id`.

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
