BEGIN;

CREATE TYPE wants.swipe_decision AS ENUM ('want', 'pass');
CREATE TYPE wants.feed_surface AS ENUM ('home', 'fresh', 'local', 'category', 'trending', 'profile', 'detail');

CREATE TABLE wants.swipes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    desire_id       uuid NOT NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
    decision        wants.swipe_decision NOT NULL,
    surface         wants.feed_surface NOT NULL DEFAULT 'home',
    session_key     uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, desire_id)
);

CREATE TABLE wants.feed_impressions (
    id              bigserial PRIMARY KEY,
    user_id         uuid REFERENCES wants.users(id) ON DELETE CASCADE,
    desire_id       uuid NOT NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
    surface         wants.feed_surface NOT NULL DEFAULT 'home',
    session_key     uuid,
    position        integer CHECK (position IS NULL OR position >= 0),
    viewed_ms       integer CHECK (viewed_ms IS NULL OR viewed_ms >= 0),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.desire_daily_metrics (
    metric_date       date NOT NULL,
    desire_id         uuid NOT NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
    impressions       bigint NOT NULL DEFAULT 0,
    wants             bigint NOT NULL DEFAULT 0,
    passes            bigint NOT NULL DEFAULT 0,
    shares            bigint NOT NULL DEFAULT 0,
    unique_viewers    bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (metric_date, desire_id)
);

CREATE TABLE wants.user_daily_metrics (
    metric_date       date NOT NULL,
    user_id           uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    swipes_given      bigint NOT NULL DEFAULT 0,
    wants_given       bigint NOT NULL DEFAULT 0,
    passes_given      bigint NOT NULL DEFAULT 0,
    desires_created   bigint NOT NULL DEFAULT 0,
    wants_generated   bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (metric_date, user_id)
);

CREATE TABLE wants.desire_shares (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    desire_id        uuid NOT NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
    user_id          uuid REFERENCES wants.users(id) ON DELETE SET NULL,
    destination      varchar(30) NOT NULL CHECK (destination IN ('copy','whatsapp','instagram','tiktok','x','facebook','other')),
    created_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wants.schema_migrations(version) VALUES ('005_create_swipes')
ON CONFLICT (version) DO NOTHING;
COMMIT;
