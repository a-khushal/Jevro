import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";

const connectorsService = require("./connectors") as typeof import("./connectors");

test("supported connectors include slack and github", () => {
  assert.equal(connectorsService.isSupportedConnector("slack"), true);
  assert.equal(connectorsService.isSupportedConnector("github"), true);
});

test("unsupported connector returns false", () => {
  assert.equal(connectorsService.isSupportedConnector("not-a-connector"), false);
});
