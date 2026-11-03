BEGIN;

CREATE INDEX IF NOT EXISTS ix_user_sessions_active_user
  ON wants.user_sessions(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_users_status_created
  ON wants.users(status, created_at DESC);

INSERT INTO wants.schema_migrations(version)
VALUES ('017_harden_user_moderation')
ON CONFLICT (version) DO NOTHING;

COMMIT;
