const path = require("path");
const dotenv = require("dotenv");

/*
|--------------------------------------------------------------------------
| Environment Loading
|--------------------------------------------------------------------------
*/

dotenv.config({
  path: path.resolve(
    process.cwd(),
    ".env"
  ),

  quiet: true,
});

/*
|--------------------------------------------------------------------------
| Parsing Helpers
|--------------------------------------------------------------------------
*/

const parseInteger = (
  name,
  fallback,
  {
    min = 0,
    max =
      Number.MAX_SAFE_INTEGER,
  } = {}
) => {
  const raw =
    process.env[name];

  if (
    raw === undefined ||
    raw === ""
  ) {
    return fallback;
  }

  const value =
    Number.parseInt(
      raw,
      10
    );

  if (
    !Number.isInteger(
      value
    ) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max}.`
    );
  }

  return value;
};

const parseBoolean = (
  name,
  fallback = false
) => {
  const raw =
    process.env[name];

  if (
    raw === undefined ||
    raw === ""
  ) {
    return fallback;
  }

  const normalized =
    raw
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
    ].includes(
      normalized
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
    ].includes(
      normalized
    )
  ) {
    return false;
  }

  throw new Error(
    `${name} must be true or false.`
  );
};

const required = (
  name
) => {
  const value =
    process.env[name];

  if (
    !value ||
    !value.trim()
  ) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value.trim();
};

const normalizeApiPrefix = (
  value
) => {
  const trimmed =
    (
      value ||
      "/api"
    ).trim();

  const prefixed =
    trimmed.startsWith("/")
      ? trimmed
      : `/${trimmed}`;

  return prefixed.length > 1
    ? prefixed.replace(
        /\/+$/,
        ""
      )
    : prefixed;
};

/*
|--------------------------------------------------------------------------
| Environment Mode
|--------------------------------------------------------------------------
*/

const nodeEnv =
  (
    process.env.NODE_ENV ||
    "development"
  ).trim();

if (
  ![
    "development",
    "test",
    "production",
  ].includes(
    nodeEnv
  )
) {
  throw new Error(
    "NODE_ENV must be development, test, or production."
  );
}

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const corsOrigins =
  (
    process.env
      .CORS_ORIGINS ||
    "http://localhost:3000"
  )
    .split(",")
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean);

/*
|--------------------------------------------------------------------------
| Application Environment
|--------------------------------------------------------------------------
*/

const env = {
  nodeEnv,

  isProduction:
    nodeEnv ===
    "production",

  isDevelopment:
    nodeEnv ===
    "development",

  isTest:
    nodeEnv ===
    "test",

  port:
    parseInteger(
      "PORT",
      4000,
      {
        min: 1,
        max: 65535,
      }
    ),

  apiPrefix:
    normalizeApiPrefix(
      process.env
        .API_PREFIX
    ),

  /*
  |--------------------------------------------------------------------------
  | Database
  |--------------------------------------------------------------------------
  */

  databaseUrl:
    required(
      "DATABASE_URL"
    ),

  databaseSsl:
    parseBoolean(
      "DATABASE_SSL",
      nodeEnv ===
        "production"
    ),

  dbPoolMax:
    parseInteger(
      "DB_POOL_MAX",
      10,
      {
        min: 1,
        max: 100,
      }
    ),

  dbIdleTimeoutMs:
    parseInteger(
      "DB_IDLE_TIMEOUT_MS",
      30000,
      {
        min: 1000,
      }
    ),

  dbConnectionTimeoutMs:
    parseInteger(
      "DB_CONNECTION_TIMEOUT_MS",
      5000,
      {
        min: 1000,
      }
    ),

  /*
  |--------------------------------------------------------------------------
  | HTTP
  |--------------------------------------------------------------------------
  */

  corsOrigins,

  jsonBodyLimit:
    (
      process.env
        .JSON_BODY_LIMIT ||
      "1mb"
    ).trim(),

  /*
  |--------------------------------------------------------------------------
  | Logging
  |--------------------------------------------------------------------------
  |
  | Retained for compatibility even though Morgan is no longer used.
  |
  */

  httpLogFormat:
    (
      process.env
        .HTTP_LOG_FORMAT ||
      (
        nodeEnv ===
        "production"
          ? "combined"
          : "dev"
      )
    ).trim(),

  /*
  |--------------------------------------------------------------------------
  | Shutdown
  |--------------------------------------------------------------------------
  */

  shutdownTimeoutMs:
    parseInteger(
      "SHUTDOWN_TIMEOUT_MS",
      10000,
      {
        min: 1000,
        max: 60000,
      }
    ),

  /*
  |--------------------------------------------------------------------------
  | Authentication
  |--------------------------------------------------------------------------
  */

  jwtAccessSecret:
    required(
      "JWT_ACCESS_SECRET"
    ),

  jwtRefreshSecret:
    required(
      "JWT_REFRESH_SECRET"
    ),

  jwtAccessExpiresIn:
    (
      process.env
        .JWT_ACCESS_EXPIRES_IN ||
      "15m"
    ).trim(),

  jwtRefreshExpiresIn:
    (
      process.env
        .JWT_REFRESH_EXPIRES_IN ||
      "30d"
    ).trim(),

  jwtIssuer:
    (
      process.env
        .JWT_ISSUER ||
      "want-server"
    ).trim(),

  jwtAudience:
    (
      process.env
        .JWT_AUDIENCE ||
      "want-web"
    ).trim(),
};

/*
|--------------------------------------------------------------------------
| Production Configuration Validation
|--------------------------------------------------------------------------
|
| Development and test environments remain flexible.
|
| Production must fail fast when security-critical configuration is missing
| or obviously unsafe.
|
*/

const validateProductionConfig =
  () => {
    if (
      !env.isProduction
    ) {
      return;
    }

    const problems = [];

    /*
    |--------------------------------------------------------------------------
    | Database
    |--------------------------------------------------------------------------
    */

    if (
      !process.env
        .DATABASE_URL
    ) {
      problems.push(
        "DATABASE_URL is required"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | JWT Secrets
    |--------------------------------------------------------------------------
    */

    if (
      !process.env
        .JWT_ACCESS_SECRET ||
      process.env
        .JWT_ACCESS_SECRET
        .length < 32
    ) {
      problems.push(
        "JWT_ACCESS_SECRET must be at least 32 characters"
      );
    }

    if (
      !process.env
        .JWT_REFRESH_SECRET ||
      process.env
        .JWT_REFRESH_SECRET
        .length < 32
    ) {
      problems.push(
        "JWT_REFRESH_SECRET must be at least 32 characters"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CORS
    |--------------------------------------------------------------------------
    */

    if (
      !env.corsOrigins
        .length
    ) {
      problems.push(
        "At least one CORS origin is required"
      );
    }

    if (
      env.corsOrigins.includes(
        "*"
      )
    ) {
      problems.push(
        "CORS wildcard is not allowed in production"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Storage
    |--------------------------------------------------------------------------
    */

    const storageProvider =
      (
        process.env
          .STORAGE_PROVIDER ||
        "local"
      )
        .trim()
        .toLowerCase();

    if (
      storageProvider !==
      "cloudinary"
    ) {
      problems.push(
        "STORAGE_PROVIDER must be cloudinary in production"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Cloudinary
    |--------------------------------------------------------------------------
    */

    const cloudinaryUrl =
      (
        process.env
          .CLOUDINARY_URL ||
        ""
      ).trim();

    if (
      !cloudinaryUrl
        .startsWith(
          "cloudinary://"
        )
    ) {
      problems.push(
        "CLOUDINARY_URL is required in production"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Result
    |--------------------------------------------------------------------------
    */

    if (
      problems.length
    ) {
      throw new Error(
        `Production configuration invalid: ${problems.join(
          "; "
        )}`
      );
    }
  };

validateProductionConfig();

/*
|--------------------------------------------------------------------------
| Freeze Configuration
|--------------------------------------------------------------------------
*/

Object.freeze(env);

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = env;