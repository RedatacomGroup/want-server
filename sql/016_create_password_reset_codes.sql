BEGIN;
CREATE TABLE IF NOT EXISTS wants.password_reset_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,code_hash text NOT NULL,expires_at timestamptz NOT NULL,attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 20),verified_at timestamptz,reset_token_hash text,reset_token_expires_at timestamptz,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS password_reset_codes_user_recent_idx ON wants.password_reset_codes(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_codes_active_idx ON wants.password_reset_codes(user_id,expires_at DESC) WHERE used_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_codes_token_hash_uq ON wants.password_reset_codes(reset_token_hash) WHERE reset_token_hash IS NOT NULL;
INSERT INTO wants.schema_migrations(version) VALUES('016_create_password_reset_codes') ON CONFLICT(version) DO NOTHING;
COMMIT;
