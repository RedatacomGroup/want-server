const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required test environment variable: ${name}`);
  return value;
};

const credentials = () => ({
  owner: {
    identifier: process.env.TEST_OWNER_IDENTIFIER || "suhail",
    password: required("TEST_OWNER_PASSWORD"),
  },
  viewer: {
    identifier: process.env.TEST_VIEWER_IDENTIFIER || "amira",
    password: required("TEST_VIEWER_PASSWORD"),
  },
});

const fixtureDesireId = () =>
  process.env.TEST_DESIRE_ID || "2562ffae-991f-46da-b098-857fa0213d27";

module.exports = { credentials, fixtureDesireId };
