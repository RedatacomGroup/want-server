BEGIN;

CREATE TABLE IF NOT EXISTS wants.admin_users (
  user_id uuid PRIMARY KEY REFERENCES wants.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'moderator' CHECK (role IN ('moderator','admin','super_admin')),
  granted_by uuid NULL REFERENCES wants.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS wants.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
  desire_id uuid NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
  reported_user_id uuid NULL REFERENCES wants.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','scam','harassment','hate','violence','illegal','copyright','impersonation','other')),
  details text NULL CHECK (details IS NULL OR char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  assigned_admin_id uuid NULL REFERENCES wants.users(id) ON DELETE SET NULL,
  resolution text NULL CHECK (resolution IS NULL OR char_length(resolution) <= 1000),
  resolved_by uuid NULL REFERENCES wants.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (desire_id IS NOT NULL OR reported_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_moderation_reports_open_desire
  ON wants.moderation_reports(reporter_user_id, desire_id, reason)
  WHERE desire_id IS NOT NULL AND status IN ('open','reviewing');

CREATE UNIQUE INDEX IF NOT EXISTS ux_moderation_reports_open_user
  ON wants.moderation_reports(reporter_user_id, reported_user_id, reason)
  WHERE reported_user_id IS NOT NULL AND status IN ('open','reviewing');

CREATE INDEX IF NOT EXISTS ix_moderation_reports_queue
  ON wants.moderation_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS wants.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES wants.users(id) ON DELETE RESTRICT,
  report_id uuid NULL REFERENCES wants.moderation_reports(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('report','desire','user')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('review','dismiss','resolve','remove_desire','restore_desire','suspend_user','activate_user')),
  reason text NULL CHECK (reason IS NULL OR char_length(reason) <= 1000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_moderation_actions_target
  ON wants.moderation_actions(target_type, target_id, created_at DESC);

COMMIT;
