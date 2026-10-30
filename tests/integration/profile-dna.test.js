const test = require("node:test");
const assert = require("node:assert/strict");
const { request, login } = require("../helpers/http");
const { credentials } = require("../helpers/state");

test("owner profile, badges, notifications and DNA load", async () => {
  const { owner } = credentials();
  const session = await login(owner.identifier, owner.password);
  const token = session.accessToken;

  const profile = await request("/api/users/me", { token });
  assert.equal(profile.json.user.username, owner.identifier);

  const badges = await request("/api/badges/me", { token });
  assert.equal(badges.json.success, true);
  assert.ok(Array.isArray(badges.json.badges.earned));

  const notifications = await request("/api/notifications", { token });
  assert.equal(notifications.json.success, true);
  assert.ok(Array.isArray(notifications.json.notifications.items));

  const dna = await request("/api/desire-dna/me", { token });
  assert.equal(dna.json.success, true);
  assert.equal(dna.json.dna.user.username, owner.identifier);
  assert.ok(Array.isArray(dna.json.dna.categories));
});
