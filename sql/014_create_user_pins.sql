BEGIN;

CREATE TABLE IF NOT EXISTS wants.user_pins (
  user_id uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
  pinned_user_id uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pinned_user_id),
  CHECK (user_id <> pinned_user_id)
);

CREATE INDEX IF NOT EXISTS user_pins_pinned_user_idx
  ON wants.user_pins (pinned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_pins_user_recent_idx
  ON wants.user_pins (user_id, created_at DESC);

INSERT INTO wants.schema_migrations(version)
VALUES ('014_create_user_pins')
ON CONFLICT (version) DO NOTHING;

COMMIT;
