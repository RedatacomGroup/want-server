const test=require("node:test");
const assert=require("node:assert/strict");
const {request}=require("../helpers/http");

test("unknown route uses stable error contract",async()=>{
  const result=await request("/api/definitely-not-a-route",{expectedStatus:404});
  assert.equal(result.json.success,false);
  assert.equal(result.json.error.code,"ROUTE_NOT_FOUND");
  assert.ok(result.json.requestId);
});

test("malformed JSON is normalized",async()=>{
  const base=(process.env.TEST_API_BASE_URL||"http://localhost:4000").replace(/\/+$/,"");
  const response=await fetch(`${base}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:'{"identifier":'});
  const json=await response.json();
  assert.equal(response.status,400);
  assert.equal(json.error.code,"INVALID_JSON");
});
