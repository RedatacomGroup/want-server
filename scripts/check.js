const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

const directories = [
  "config",
  "controllers",
  "middleware",
  "routes",
  "services",
  "utils",
  "validators",
];

const files = [
  path.join(
    root,
    "app.js"
  ),

  path.join(
    root,
    "server.js"
  ),
];

for (const directory of directories) {
  const directoryPath = path.join(
    root,
    directory
  );

  if (!fs.existsSync(directoryPath)) {
    continue;
  }

  for (const entry of fs.readdirSync(
    directoryPath,
    {
      withFileTypes: true,
    }
  )) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".js")
    ) {
      files.push(
        path.join(
          directoryPath,
          entry.name
        )
      );
    }
  }
}

let failed = false;

for (const file of files) {
  const relative =
    path.relative(root, file);

  process.stdout.write(
    `[check] ${relative} ... `
  );

  const result = spawnSync(
    process.execPath,
    [
      "--check",
      file,
    ],
    {
      encoding: "utf8",
    }
  );

  if (result.status === 0) {
    console.log("OK");
    continue;
  }

  failed = true;

  console.log("FAILED");

  if (result.stderr) {
    console.error(
      result.stderr.trim()
    );
  }
}

if (failed) {
  console.error(
    "\\n[check] One or more files failed syntax validation."
  );

  process.exit(1);
}

console.log(
  `\\n[check] ${files.length} JavaScript files passed syntax validation.`
);