import assert from "node:assert/strict";
import test from "node:test";
import { OktaForAgentsClient } from "./client";

function withMockedFetch(handler: typeof fetch): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

test("sdk mints token and executes action", async () => {
  let currentToken: string | undefined;

  const restore = withMockedFetch(async (input, init) => {
    const url = String(input);

    if (url.endsWith("/tokens/mint")) {
      return new Response(JSON.stringify({ token: "tkn-1", expiresInSeconds: 600 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.endsWith("/proxy/slack/post_message")) {
      const auth = typeof init?.headers === "object" ? (init.headers as Record<string, string>).authorization : undefined;
      assert.equal(auth, "Bearer tkn-1");

      return new Response(JSON.stringify({ decision: "allow", providerResponse: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("{}", { status: 404 });
  });

  try {
    const client = new OktaForAgentsClient({
      baseUrl: "http://localhost:8080/v1",
      getToken: () => currentToken
    });

    const minted = await client.mintToken({ tenantId: "acme", agentId: "agent-1" });
    currentToken = minted.token;

    const result = await client.runAction({
      connector: "slack",
      action: "post_message",
      payload: { channel: "C1", text: "hello" },
      environment: "prod"
    });

    assert.equal(result.decision, "allow");
  } finally {
    restore();
  }
});

test("sdk throws clear error on failed request", async () => {
  const restore = withMockedFetch(async () => {
    return new Response(JSON.stringify({ code: "INVALID_TOKEN", error: "Invalid or expired token" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  });

  try {
    const client = new OktaForAgentsClient({ baseUrl: "http://localhost:8080/v1" });

    await assert.rejects(
      async () => {
        await client.mintToken({ tenantId: "acme", agentId: "agent-1" });
      },
      (error) => {
        assert.match(String(error), /INVALID_TOKEN/);
        return true;
      }
    );
  } finally {
    restore();
  }
});
