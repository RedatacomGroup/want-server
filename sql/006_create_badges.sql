BEGIN;

CREATE TYPE wants.badge_rule_type AS ENUM ('manual', 'threshold', 'ranking', 'computed');

CREATE TABLE wants.badges (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code             varchar(50) NOT NULL UNIQUE,
    name             varchar(80) NOT NULL,
    description      varchar(300) NOT NULL,
    icon_key         varchar(100) NOT NULL,
    icon_url         text,
    rarity           varchar(20) NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','epic','legendary','genesis')),
    rule_type        wants.badge_rule_type NOT NULL,
    rule_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
    sort_order       integer NOT NULL DEFAULT 0,
    is_active        boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.user_badges (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    badge_id         uuid NOT NULL REFERENCES wants.badges(id) ON DELETE CASCADE,
    awarded_at       timestamptz NOT NULL DEFAULT now(),
    award_reason     varchar(300),
    progress         numeric(12,4) NOT NULL DEFAULT 100,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
    revoked_at       timestamptz,
    UNIQUE (user_id, badge_id)
);

CREATE TABLE wants.user_equipped_badges (
    user_id          uuid PRIMARY KEY REFERENCES wants.users(id) ON DELETE CASCADE,
    user_badge_id    uuid NOT NULL UNIQUE REFERENCES wants.user_badges(id) ON DELETE CASCADE,
    equipped_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.badge_progress (
    user_id          uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    badge_id         uuid NOT NULL REFERENCES wants.badges(id) ON DELETE CASCADE,
    current_value    numeric(18,4) NOT NULL DEFAULT 0,
    target_value     numeric(18,4) NOT NULL DEFAULT 0,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

INSERT INTO wants.schema_migrations(version) VALUES ('006_create_badges')
ON CONFLICT (version) DO NOTHING;
COMMIT;
