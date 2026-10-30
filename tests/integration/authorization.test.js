const test = require("node:test");
const assert = require("node:assert/strict");
const { request, login } = require("../helpers/http");
const { credentials, fixtureDesireId } = require("../helpers/state");

test("owner cannot swipe own desire", async () => {
  const { owner } = credentials();
  const session = await login(owner.identifier, owner.password);
  const result = await request("/api/swipes", {
    method: "POST",
    token: session.accessToken,
    body: { desireId: fixtureDesireId(), decision: "want", surface: "detail" },
    expectedStatus: 409,
  });
  assert.equal(result.json.error.code, "OWN_DESIRE_SWIPE_NOT_ALLOWED");
});

test("viewer cannot edit owner's desire", async () => {
  const { viewer } = credentials();
  const session = await login(viewer.identifier, viewer.password);
  const result = await request(`/api/desires/${fixtureDesireId()}`, {
    method: "PATCH",
    token: session.accessToken,
    body: { title: "Unauthorized edit" },
    expectedStatus: 404,
  });
  assert.equal(result.json.success, false);
});
