const test = require("node:test");
const assert = require("node:assert/strict");
const { request } = require("../helpers/http");

test("health endpoints are healthy", async () => {
  const health = await request("/api/health");
  assert.equal(health.json.success, true);
  assert.equal(health.json.status, "ok");

  const database = await request("/api/health/database");
  assert.equal(database.json.success, true);
  assert.equal(database.json.status, "ok");
  assert.equal(database.json.database.wants_schema_exists, true);
});
