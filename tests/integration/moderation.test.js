const test=require("node:test");
const assert=require("node:assert/strict");
const {request,login}=require("../helpers/http");
const {credentials}=require("../helpers/state");

test("regular user cannot access admin queue",async()=>{
  const {viewer}=credentials();
  const session=await login(viewer.identifier,viewer.password);
  const result=await request("/api/admin/reports",{token:session.accessToken,expectedStatus:403});
  assert.equal(result.json.error.code,"ADMIN_REQUIRED");
});

test("super admin can access moderation queues",async()=>{
  const {owner}=credentials();
  const session=await login(owner.identifier,owner.password);
  const reports=await request("/api/admin/reports?status=all",{token:session.accessToken});
  assert.equal(reports.json.success,true);
  assert.ok(Array.isArray(reports.json.items));
  const desires=await request("/api/admin/desires",{token:session.accessToken});
  assert.ok(Array.isArray(desires.json.items));
  const users=await request("/api/admin/users",{token:session.accessToken});
  assert.ok(Array.isArray(users.json.items));
});
