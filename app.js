const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const env = require("./config/env");

const {
  checkDatabase,
} = require("./config/db");

const storageConfig =
  require("./config/storage");

/*
|--------------------------------------------------------------------------
| Utilities
|--------------------------------------------------------------------------
*/

const asyncHandler =
  require("./utils/asyncHandler");

/*
|--------------------------------------------------------------------------
| Request Logging
|--------------------------------------------------------------------------
*/

const {
  requestLoggerMiddleware,
} = require(
  "./middleware/requestLoggerMiddleware"
);

/*
|--------------------------------------------------------------------------
| Rate Limiting
|--------------------------------------------------------------------------
*/

const {
  generalApiLimiter,
} = require(
  "./middleware/rateLimitMiddleware"
);

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

const authRoutes =
  require("./routes/authRoutes");

const userRoutes =
  require("./routes/userRoutes");

const uploadRoutes =
  require("./routes/uploadRoutes");

const desireRoutes =
  require("./routes/desireRoutes");

const feedRoutes =
  require("./routes/feedRoutes");

const swipeRoutes =
  require("./routes/swipeRoutes");

const trendingRoutes =
  require("./routes/trendingRoutes");

const leaderboardRoutes =
  require("./routes/leaderboardRoutes");

const badgeRoutes =
  require("./routes/badgeRoutes");

const notificationRoutes =
  require("./routes/notificationRoutes");

const desireDnaRoutes =
  require("./routes/desireDnaRoutes");

/*
|--------------------------------------------------------------------------
| Error Middleware
|--------------------------------------------------------------------------
*/

const {
  AppError,
  notFoundMiddleware,
  errorMiddleware,
} = require(
  "./middleware/errorMiddleware"
);

/*
|--------------------------------------------------------------------------
| Express Application
|--------------------------------------------------------------------------
*/

const app = express();

app.disable(
  "x-powered-by"
);

/*
|--------------------------------------------------------------------------
| Proxy Configuration
|--------------------------------------------------------------------------
|
| Local development:
|   No proxy trust.
|
| Production:
|   Trust the first reverse proxy hop.
|
| This setting must continue to match the production hosting topology.
|
*/

app.set(
  "trust proxy",
  env.isProduction
    ? 1
    : false
);

/*
|--------------------------------------------------------------------------
| Request ID
|--------------------------------------------------------------------------
*/

app.use(
  (req, res, next) => {
    req.requestId =
      req.get(
        "x-request-id"
      ) ||
      crypto.randomUUID();

    res.setHeader(
      "x-request-id",
      req.requestId
    );

    next();
  }
);

/*
|--------------------------------------------------------------------------
| Structured Request Logging
|--------------------------------------------------------------------------
|
| Must run after request IDs have been assigned.
|
*/

app.use(
  requestLoggerMiddleware
);

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet()
);

app.use(
  compression()
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin(
      origin,
      callback
    ) {
      if (
        !origin ||
        env.corsOrigins.includes(
          "*"
        ) ||
        env.corsOrigins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      return callback(
        new AppError(
          "This origin is not permitted by CORS.",
          403,
          "CORS_ORIGIN_DENIED"
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "X-Device-Name",
    ],
  })
);

/*
|--------------------------------------------------------------------------
| Body Parsing
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit:
      env.jsonBodyLimit,
  })
);

app.use(
  express.urlencoded({
    extended: true,

    limit:
      env.jsonBodyLimit,
  })
);

/*
|--------------------------------------------------------------------------
| Local Media Storage
|--------------------------------------------------------------------------
|
| Only active when:
|
| STORAGE_PROVIDER=local
|
| Production requires Cloudinary.
|
*/

if (
  storageConfig.provider ===
  "local"
) {
  app.use(
    "/uploads",

    express.static(
      storageConfig.localRoot
    )
  );
}

/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get(
  "/",

  (req, res) => {
    res
      .status(200)
      .json({
        success: true,

        service:
          "want-server",

        message:
          "WANT API is running.",

        apiPrefix:
          env.apiPrefix,

        environment:
          env.nodeEnv,

        storageProvider:
          storageConfig.provider,

        requestId:
          req.requestId,
      });
  }
);

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  `${env.apiPrefix}/health`,

  (req, res) => {
    res
      .status(200)
      .json({
        success: true,

        status: "ok",

        service:
          "want-server",

        environment:
          env.nodeEnv,

        storageProvider:
          storageConfig.provider,

        uptimeSeconds:
          Math.floor(
            process.uptime()
          ),

        timestamp:
          new Date()
            .toISOString(),

        requestId:
          req.requestId,
      });
  }
);

/*
|--------------------------------------------------------------------------
| Database Health
|--------------------------------------------------------------------------
*/

app.get(
  `${env.apiPrefix}/health/database`,

  asyncHandler(
    async (
      req,
      res
    ) => {
      const database =
        await checkDatabase();

      if (
        !database
          .wants_schema_exists
      ) {
        throw new AppError(
          "The wants database schema was not found.",
          503,
          "WANTS_SCHEMA_MISSING"
        );
      }

      res
        .status(200)
        .json({
          success: true,

          status: "ok",

          database,

          requestId:
            req.requestId,
        });
    }
  )
);

/*
|--------------------------------------------------------------------------
| General API Rate Limiting
|--------------------------------------------------------------------------
|
| Health endpoints deliberately remain above this middleware.
|
*/

app.use(
  env.apiPrefix,
  generalApiLimiter
);

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/auth`,
  authRoutes
);

/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/users`,
  userRoutes
);

/*
|--------------------------------------------------------------------------
| Upload Configuration
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/uploads`,
  uploadRoutes
);

/*
|--------------------------------------------------------------------------
| Desires
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/desires`,
  desireRoutes
);

/*
|--------------------------------------------------------------------------
| Feed
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/feed`,
  feedRoutes
);

/*
|--------------------------------------------------------------------------
| WANT / PASS
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/swipes`,
  swipeRoutes
);

/*
|--------------------------------------------------------------------------
| Trending
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/trending`,
  trendingRoutes
);

/*
|--------------------------------------------------------------------------
| Leaderboards
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/leaderboards`,
  leaderboardRoutes
);

/*
|--------------------------------------------------------------------------
| Badges
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/badges`,
  badgeRoutes
);

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/notifications`,
  notificationRoutes
);

/*
|--------------------------------------------------------------------------
| Desire DNA
|--------------------------------------------------------------------------
*/

app.use(
  `${env.apiPrefix}/desire-dna`,
  desireDnaRoutes
);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
|
| MUST remain after every application route.
|
*/

app.use(
  notFoundMiddleware
);

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
|
| MUST remain the final Express middleware.
|
*/

app.use(
  errorMiddleware
);

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
|
| app.js configures and exports Express.
| It must NOT call app.listen().
|
*/

module.exports = app;