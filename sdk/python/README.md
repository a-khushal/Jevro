# Python SDK Wrapper

This SDK mirrors the core TypeScript SDK flows:

- `mint_token(tenant_id, agent_id)`
- `run_action(connector, action, payload, environment=None, approval_id=None)`
- `resolve_approval(approval_id, tenant_id, approver_id, decision)`
- `replay_approved_action(...)`

## Quick usage

```python
from okta_for_agents import OktaForAgentsClient

token_holder = {"value": None}
client = OktaForAgentsClient(
    base_url="http://localhost:8080/v1",
    get_token=lambda: token_holder["value"],
)

minted = client.mint_token("acme", "<agent-id>")
token_holder["value"] = minted.token

result = client.run_action(
    connector="github",
    action="read_pr",
    payload={"owner": "acme", "repo": "api", "pull_number": 42},
    environment="prod",
)
print(result)
```
