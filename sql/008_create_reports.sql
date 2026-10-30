BEGIN;

CREATE TYPE wants.report_target_type AS ENUM ('desire', 'user');
CREATE TYPE wants.report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE wants.moderation_action_type AS ENUM ('approve', 'reject', 'remove', 'restore', 'warn', 'suspend', 'unsuspend');

CREATE TABLE wants.reports (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id uuid REFERENCES wants.users(id) ON DELETE SET NULL,
    target_type      wants.report_target_type NOT NULL,
    target_id        uuid NOT NULL,
    reason           varchar(40) NOT NULL CHECK (reason IN ('copyright','stolen_image','inappropriate','violence','spam','misleading','personal_information','other')),
    details          varchar(1000),
    status           wants.report_status NOT NULL DEFAULT 'open',
    assigned_to      uuid REFERENCES wants.users(id) ON DELETE SET NULL,
    resolution_note  text,
    resolved_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.moderation_actions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_user_id uuid REFERENCES wants.users(id) ON DELETE SET NULL,
    target_type      wants.report_target_type NOT NULL,
    target_id        uuid NOT NULL,
    action           wants.moderation_action_type NOT NULL,
    reason           text,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.blocked_users (
    blocker_user_id  uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    blocked_user_id  uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_user_id, blocked_user_id),
    CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE wants.audit_log (
    id               bigserial PRIMARY KEY,
    actor_user_id    uuid REFERENCES wants.users(id) ON DELETE SET NULL,
    action           varchar(100) NOT NULL,
    entity_type      varchar(60),
    entity_id        uuid,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wants.schema_migrations(version) VALUES ('008_create_reports')
ON CONFLICT (version) DO NOTHING;
COMMIT;
