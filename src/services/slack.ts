import { createHmac, timingSafeEqual } from "crypto";
import { SLACK_API_BASE_URL, SLACK_APPROVAL_CHANNEL, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET } from "../config";
import { AppError } from "../errors";

type SlackInteractivityAction = {
  action_id: string;
  value: string;
};

type SlackInteractivityPayload = {
  user: {
    id: string;
  };
  actions: SlackInteractivityAction[];
};

function assertSlackOutboundConfigured(): void {
  if (!SLACK_BOT_TOKEN || !SLACK_APPROVAL_CHANNEL) {
    throw new AppError(
      500,
      "SLACK_NOT_CONFIGURED",
      "Slack outbound configuration missing. Set SLACK_BOT_TOKEN and SLACK_APPROVAL_CHANNEL."
    );
  }
}

function assertSlackSigningConfigured(): void {
  if (!SLACK_SIGNING_SECRET) {
    throw new AppError(500, "SLACK_NOT_CONFIGURED", "Slack signing secret missing. Set SLACK_SIGNING_SECRET.");
  }
}

export async function sendSlackApprovalRequest(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  approvalId: string;
}): Promise<{ channel: string; ts: string }> {
  assertSlackOutboundConfigured();

  const response = await fetch(`${SLACK_API_BASE_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SLACK_BOT_TOKEN}`
    },
    body: JSON.stringify({
      channel: SLACK_APPROVAL_CHANNEL,
      text: `Approval required for ${input.connector}:${input.action}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Approval required*\n" +
              `Tenant: \`${input.tenantId}\`\n` +
              `Agent: \`${input.agentId}\`\n` +
              `Action: \`${input.connector}:${input.action}\`\n` +
              `Approval ID: \`${input.approvalId}\``
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              action_id: "approve",
              style: "primary",
              text: {
                type: "plain_text",
                text: "Approve"
              },
              value: input.approvalId
            },
            {
              type: "button",
              action_id: "reject",
              style: "danger",
              text: {
                type: "plain_text",
                text: "Reject"
              },
              value: input.approvalId
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new AppError(502, "SLACK_API_ERROR", `Slack API request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { ok: boolean; error?: string; channel?: string; ts?: string };
  if (!body.ok || !body.channel || !body.ts) {
    throw new AppError(502, "SLACK_API_ERROR", body.error ?? "Slack API returned an unexpected response");
  }

  return {
    channel: body.channel,
    ts: body.ts
  };
}

export async function sendSlackOperationalAlert(text: string): Promise<void> {
  if (!SLACK_BOT_TOKEN || !SLACK_APPROVAL_CHANNEL) {
    return;
  }

  try {
    const response = await fetch(`${SLACK_API_BASE_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: SLACK_APPROVAL_CHANNEL,
        text
      })
    });

    if (!response.ok) {
      return;
    }

    await response.arrayBuffer();
  } catch (_error) {
    // Suppress alert delivery failures to avoid request path disruption.
  }
}

export function verifySlackSignature(input: {
  rawBody: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
}): void {
  assertSlackSigningConfigured();
  const signingSecret = SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    throw new AppError(500, "SLACK_NOT_CONFIGURED", "Slack signing secret missing. Set SLACK_SIGNING_SECRET.");
  }

  const timestamp = input.timestampHeader;
  const signature = input.signatureHeader;

  if (!timestamp || !signature) {
    throw new AppError(401, "SLACK_SIGNATURE_MISSING", "Slack signature headers are missing");
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const slackTimestamp = Number(timestamp);
  if (!Number.isFinite(slackTimestamp) || Math.abs(currentTimestamp - slackTimestamp) > 60 * 5) {
    throw new AppError(401, "SLACK_SIGNATURE_STALE", "Slack signature timestamp is stale");
  }

  const baseString = `v0:${timestamp}:${input.rawBody}`;
  const digest = createHmac("sha256", signingSecret).update(baseString).digest("hex");
  const expectedSignature = `v0=${digest}`;

  const left = Buffer.from(expectedSignature);
  const right = Buffer.from(signature);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError(401, "SLACK_SIGNATURE_INVALID", "Slack signature verification failed");
  }
}

export function parseSlackInteractivityPayload(rawBody: string): SlackInteractivityPayload {
  const payloadValue = new URLSearchParams(rawBody).get("payload");
  if (!payloadValue) {
    throw new AppError(400, "SLACK_PAYLOAD_INVALID", "Missing payload in Slack interactivity body");
  }

  const parsed = JSON.parse(payloadValue) as SlackInteractivityPayload;
  if (!parsed.user?.id || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
    throw new AppError(400, "SLACK_PAYLOAD_INVALID", "Malformed Slack interactivity payload");
  }

  return parsed;
}
