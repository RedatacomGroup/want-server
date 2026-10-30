const assert = require("node:assert/strict");

const apiBase = (process.env.TEST_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

const request = async (path, { method = "GET", token, body, expectedStatus = 200 } = {}) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}

  assert.equal(
    response.status,
    expectedStatus,
    `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${text}`
  );

  return { response, json, text };
};

const login = async (identifier, password) => {
  const { json } = await request("/api/auth/login", {
    method: "POST",
    body: { identifier, password },
    expectedStatus: 200,
  });
  assert.equal(json.success, true);
  assert.ok(json.accessToken);
  return json;
};

module.exports = { apiBase, request, login };
