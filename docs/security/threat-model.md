# Threat Model and Abuse Cases

## Assets

- Agent identities and short-lived tokens
- Policy definitions and approval records
- Audit logs and connector credentials

## Trust boundaries

1. Client/agent to API boundary
2. API to external connector boundary (GitHub/Slack/Jira)
3. API to database boundary

## Key threats

- Token theft/replay
- Cross-tenant data access attempts
- Approval replay or forged approval decisions
- Connector scope overreach and provider misuse
- Abuse spikes (token failures / policy bypass attempts)

## Mitigations in place

- Token `kid` signing + rotation + revocation list
- Tenant-scoped query filters and required tenant params
- One-time approval consume + replay checks
- Security signal tracking and Slack-based operational alerting
- Rate limits and quota controls

## Residual risks

- In-memory alert counters reset on restart
- External provider outages can degrade decision latency
- High-risk action catalog may need tenant-specific tuning
