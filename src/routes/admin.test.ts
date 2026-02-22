import assert from "node:assert/strict";
import test from "node:test";
import { request } from "../test/testUtils";

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

test("admin UI requires authentication", async () => {
  const response = await request.get("/admin");
  assert.equal(response.status, 401);
});

test("admin UI loads with valid credentials", async () => {
  const response = await request
    .get("/admin")
    .set("authorization", basicAuthHeader("admin", "change-me-admin"));

  assert.equal(response.status, 200);
  assert.match(response.text, /Agent Access Control Console/);
});
