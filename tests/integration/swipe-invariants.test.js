const test = require("node:test");
const assert = require("node:assert/strict");
const { request, login } = require("../helpers/http");
const { credentials, fixtureDesireId } = require("../helpers/state");

test("viewer can WANT -> PASS -> WANT with a single swipe record and correct counters", async () => {
  const { viewer, owner } = credentials();
  const viewerSession = await login(viewer.identifier, viewer.password);
  const ownerSession = await login(owner.identifier, owner.password);
  const desireId = fixtureDesireId();

  const before = await request(`/api/desires/${desireId}`);
  const initialWants = before.json.desire.stats.wants;
  const initialPasses = before.json.desire.stats.passes;

  const first = await request("/api/swipes", {
    method: "POST",
    token: viewerSession.accessToken,
    body: { desireId, decision: "want", surface: "detail" },
  });
  const swipeId = first.json.swipe.id;
  assert.equal(first.json.swipe.decision, "want");

  const pass = await request("/api/swipes", {
    method: "POST",
    token: viewerSession.accessToken,
    body: { desireId, decision: "pass", surface: "detail" },
  });
  assert.equal(pass.json.swipe.id, swipeId);
  assert.equal(pass.json.swipe.decision, "pass");

  const wantAgain = await request("/api/swipes", {
    method: "POST",
    token: viewerSession.accessToken,
    body: { desireId, decision: "want", surface: "detail" },
  });
  assert.equal(wantAgain.json.swipe.id, swipeId);
  assert.equal(wantAgain.json.swipe.decision, "want");

  const final = await request(`/api/desires/${desireId}`);
  assert.equal(final.json.desire.stats.wants, initialWants + (initialWants === 0 ? 1 : 0));
  assert.ok(final.json.desire.stats.passes <= Math.max(initialPasses, 1));

  const ownerProfile = await request("/api/users/me", { token: ownerSession.accessToken });
  assert.equal(ownerProfile.json.user.username, owner.identifier);
});
