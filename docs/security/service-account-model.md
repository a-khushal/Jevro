# Service Account / Machine Principal Model

## Principal types

- `agent`: default interactive/automation principal
- `service_account`: long-lived machine identity registered via `/v1/service-accounts`

## Behavior

- Both principal types use the same token minting and policy evaluation flow.
- Tokens include principal metadata in claims (`principalType`).
- Policies are still scoped by tenant + agent id + environment.

## Recommended usage

- Use `service_account` for CI/CD bots and backend automation.
- Use tenant token TTL overrides to tighten long-lived machine blast radius.
- Combine with high-priority deny policies for emergency stop controls.
