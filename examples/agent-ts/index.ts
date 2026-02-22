import { OktaForAgentsClient } from "../../src/sdk/typescript";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8080/v1";
const tenantId = process.env.TENANT_ID ?? "acme";
const agentId = process.env.AGENT_ID;
const approverId = process.env.APPROVER_ID ?? "sec-lead-1";

if (!agentId) {
  throw new Error("Set AGENT_ID before running example agent.");
}

const resolvedAgentId = agentId;

let bearerToken: string | undefined;

const client = new OktaForAgentsClient({
  baseUrl,
  getToken: () => bearerToken
});

async function run(): Promise<void> {
  const minted = await client.mintToken({ tenantId, agentId: resolvedAgentId });
  bearerToken = minted.token;

  const firstAttempt = await client.runAction({
    connector: "slack",
    action: "post_message",
    payload: {
      channel: "#ops",
      text: "deploy complete"
    },
    environment: "prod"
  });

  if (firstAttempt.decision === "allow") {
    console.log("Action allowed without approval.");
    return;
  }

  if (firstAttempt.decision === "deny") {
    console.log("Action denied by policy.");
    return;
  }

  if (!firstAttempt.approval?.id) {
    throw new Error("Approval was required but no approval id was returned.");
  }

  console.log(`Approval required. approvalId=${firstAttempt.approval.id}`);

  if (process.env.AUTO_APPROVE === "1") {
    await client.resolveApproval({
      approvalId: firstAttempt.approval.id,
      tenantId,
      approverId,
      decision: "approved"
    });

    const replay = await client.replayApprovedAction({
      connector: "slack",
      action: "post_message",
      payload: {
        channel: "#ops",
        text: "deploy complete (approved replay)"
      },
      approvalId: firstAttempt.approval.id,
      environment: "prod"
    });

    console.log(`Replay decision: ${replay.decision}`);
    return;
  }

  console.log("Resolve the approval in Slack or via API, then replay with approvalId.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
