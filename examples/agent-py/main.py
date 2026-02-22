import os
import sys

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sdk/python"))
)

from okta_for_agents import OktaForAgentsClient


def main() -> None:
    base_url = os.getenv("API_BASE_URL", "http://localhost:8080/v1")
    tenant_id = os.getenv("TENANT_ID", "acme")
    agent_id = os.getenv("AGENT_ID")
    approver_id = os.getenv("APPROVER_ID", "sec-lead-1")

    if not agent_id:
        raise RuntimeError("Set AGENT_ID before running Python example")

    token_holder = {"value": None}
    client = OktaForAgentsClient(
        base_url=base_url, get_token=lambda: token_holder["value"]
    )

    minted = client.mint_token(tenant_id=tenant_id, agent_id=agent_id)
    token_holder["value"] = minted.token

    first = client.run_action(
        connector="slack",
        action="post_message",
        payload={"channel": "#ops", "text": "deploy complete"},
        environment="prod",
    )

    decision = first.get("decision")
    if decision == "allow":
        print("Action allowed without approval")
        return
    if decision == "deny":
        print("Action denied by policy")
        return

    approval = first.get("approval") or {}
    approval_id = approval.get("id")
    if not approval_id:
        raise RuntimeError("Approval required but approval id missing")

    print(f"Approval required: {approval_id}")

    if os.getenv("AUTO_APPROVE") == "1":
        client.resolve_approval(
            approval_id=approval_id,
            tenant_id=tenant_id,
            approver_id=approver_id,
            decision="approved",
        )
        replay = client.replay_approved_action(
            connector="slack",
            action="post_message",
            payload={"channel": "#ops", "text": "deploy complete (approved replay)"},
            approval_id=approval_id,
            environment="prod",
        )
        print(f"Replay decision: {replay.get('decision')}")
    else:
        print("Resolve approval in Slack/API, then replay with approvalId")


if __name__ == "__main__":
    main()
