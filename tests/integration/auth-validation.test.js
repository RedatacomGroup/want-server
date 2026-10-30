const test = require("node:test");
const assert = require("node:assert/strict");
const { request, login } = require("../helpers/http");
const { credentials } = require("../helpers/state");

test("login and protected /me work", async () => {
  const { owner } = credentials();
  const session = await login(owner.identifier, owner.password);
  const me = await request("/api/auth/me", { token: session.accessToken });
  assert.equal(me.json.success, true);
  assert.equal(me.json.user.username, owner.identifier);
});

test("invalid login payload is rejected at validation boundary", async () => {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { identifier: "", password: "", surpriseField: true },
    expectedStatus: 400,
  });
  assert.equal(result.json.success, false);
  assert.equal(result.json.error.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(result.json.error.details));
  assert.ok(result.json.error.details.some((item) => item.field === "request"));
});
