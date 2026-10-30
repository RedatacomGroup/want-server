BEGIN;

CREATE TYPE wants.notification_type AS ENUM (
    'badge_unlocked', 'desire_milestone', 'desire_trending',
    'rank_changed', 'moderation', 'system'
);

CREATE TABLE wants.notifications (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    type             wants.notification_type NOT NULL,
    title            varchar(120) NOT NULL,
    body             varchar(500) NOT NULL,
    data             jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at          timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.notification_preferences (
    user_id              uuid PRIMARY KEY REFERENCES wants.users(id) ON DELETE CASCADE,
    badge_unlocked       boolean NOT NULL DEFAULT true,
    desire_milestone     boolean NOT NULL DEFAULT true,
    desire_trending      boolean NOT NULL DEFAULT true,
    rank_changed         boolean NOT NULL DEFAULT true,
    system               boolean NOT NULL DEFAULT true,
    updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wants.schema_migrations(version) VALUES ('007_create_notifications')
ON CONFLICT (version) DO NOTHING;
COMMIT;
