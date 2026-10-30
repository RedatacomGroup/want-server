require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  spawnSync,
} = require("node:child_process");

const root = path.resolve(
  __dirname,
  ".."
);

const integrationDirectory =
  path.join(
    root,
    "tests",
    "integration"
  );

if (
  !fs.existsSync(
    integrationDirectory
  )
) {
  console.error(
    "[test] Integration test directory was not found."
  );

  process.exit(1);
}

const testFiles = fs
  .readdirSync(
    integrationDirectory,
    {
      withFileTypes: true,
    }
  )
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(
        ".test.js"
      )
  )
  .map(
    (entry) =>
      path.join(
        integrationDirectory,
        entry.name
      )
  )
  .sort();

if (!testFiles.length) {
  console.error(
    "[test] No integration test files were found."
  );

  process.exit(1);
}

console.log(
  `[test] Running ${testFiles.length} integration test files...`
);

const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-concurrency=1",
    ...testFiles,
  ],
  {
    cwd: root,

    stdio: "inherit",

    shell: false,

    env: process.env,

    windowsHide: true,
  }
);

if (result.error) {
  console.error(
    "[test] Could not start the Node test runner:",
    result.error
  );

  process.exit(1);
}

process.exit(
  result.status ?? 1
);