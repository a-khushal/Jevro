import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";

const authorizeService = require("./authorize") as typeof import("./authorize");

test("policy decision prefers deny over others", () => {
  const decision = authorizeService.evaluatePolicyDecision([
    { effect: "allow" },
    { effect: "require_approval" },
    { effect: "deny" }
  ]);

  assert.equal(decision, "deny");
});

test("policy decision returns require_approval when no deny", () => {
  const decision = authorizeService.evaluatePolicyDecision([{ effect: "allow" }, { effect: "require_approval" }]);
  assert.equal(decision, "require_approval");
});

test("policy decision returns allow when allow is only match", () => {
  const decision = authorizeService.evaluatePolicyDecision([{ effect: "allow" }]);
  assert.equal(decision, "allow");
});

test("policy decision defaults to deny when no policies", () => {
  const decision = authorizeService.evaluatePolicyDecision([]);
  assert.equal(decision, "deny");
});

test("policy decision uses highest-priority policy before effect precedence", () => {
  const decision = authorizeService.evaluatePolicyDecision([
    { effect: "deny", priority: 100 },
    { effect: "allow", priority: 10 }
  ]);
  assert.equal(decision, "allow");
});

test("dry-run policies are excluded from enforced decision", () => {
  const decision = authorizeService.evaluatePolicyDecision([
    { effect: "deny", priority: 1, dryRun: true },
    { effect: "allow", priority: 100, dryRun: false }
  ]);
  assert.equal(decision, "allow");
});
