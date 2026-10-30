const test = require("node:test");
const assert = require("node:assert/strict");
const { request } = require("../helpers/http");
const { fixtureDesireId } = require("../helpers/state");

test("published Cloudinary desire is publicly retrievable", async () => {
  const result = await request(`/api/desires/${fixtureDesireId()}`);
  assert.equal(result.json.success, true);
  assert.equal(result.json.desire.status, "published");
  assert.match(result.json.desire.image.url, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(result.json.desire.image.thumbnailUrl, /^https:\/\/res\.cloudinary\.com\//);
});

test("trending and leaderboards are reachable", async () => {
  const trending = await request("/api/trending/global?hours=24&limit=20");
  assert.equal(trending.json.success, true);
  assert.ok(Array.isArray(trending.json.trending.items));

  const global = await request("/api/leaderboards/global?limit=20");
  assert.equal(global.json.success, true);
  assert.ok(Array.isArray(global.json.items));
});
