BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS wants;

COMMENT ON SCHEMA wants IS 'Isolated schema for the WANT consumer desire platform.';

CREATE TABLE IF NOT EXISTS wants.schema_migrations (
    version         text PRIMARY KEY,
    applied_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wants.schema_migrations(version)
VALUES ('001_create_extensions')
ON CONFLICT (version) DO NOTHING;

COMMIT;
