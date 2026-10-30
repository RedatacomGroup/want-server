BEGIN;

CREATE TYPE wants.user_status AS ENUM ('pending', 'active', 'suspended', 'deleted');
CREATE TYPE wants.visibility_level AS ENUM ('public', 'private');

CREATE TABLE wants.users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               text NOT NULL,
    username            varchar(30) NOT NULL,
    password_hash       text NOT NULL,
    status              wants.user_status NOT NULL DEFAULT 'active',
    email_verified_at   timestamptz,
    last_login_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email))),
    CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_]{3,30}$')
);

CREATE UNIQUE INDEX users_email_unique_active
    ON wants.users (lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_username_unique_active
    ON wants.users (lower(username)) WHERE deleted_at IS NULL;

CREATE TABLE wants.user_profiles (
    user_id                 uuid PRIMARY KEY REFERENCES wants.users(id) ON DELETE CASCADE,
    display_name            varchar(60),
    bio                     varchar(240),
    profile_image_url       text,
    country_code            char(2),
    region                  varchar(100),
    city                    varchar(100),
    age_band                varchar(20),
    gender                  varchar(30),
    favorite_colors         text[] NOT NULL DEFAULT '{}',
    profile_visibility      wants.visibility_level NOT NULL DEFAULT 'public',
    show_country            boolean NOT NULL DEFAULT true,
    onboarding_completed_at timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_profiles_country_upper CHECK (country_code IS NULL OR country_code = upper(country_code)),
    CONSTRAINT user_profiles_age_band CHECK (age_band IS NULL OR age_band IN ('18-24','25-34','35-44','45-54','55-64','65+'))
);

CREATE TABLE wants.user_settings (
    user_id                    uuid PRIMARY KEY REFERENCES wants.users(id) ON DELETE CASCADE,
    allow_personalization      boolean NOT NULL DEFAULT true,
    allow_aggregated_insights  boolean NOT NULL DEFAULT true,
    email_notifications        boolean NOT NULL DEFAULT true,
    push_notifications         boolean NOT NULL DEFAULT true,
    content_language           varchar(10) NOT NULL DEFAULT 'en',
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.user_stats (
    user_id                 uuid PRIMARY KEY REFERENCES wants.users(id) ON DELETE CASCADE,
    desires_posted          bigint NOT NULL DEFAULT 0 CHECK (desires_posted >= 0),
    total_wants_generated   bigint NOT NULL DEFAULT 0 CHECK (total_wants_generated >= 0),
    total_passes_generated  bigint NOT NULL DEFAULT 0 CHECK (total_passes_generated >= 0),
    wants_given             bigint NOT NULL DEFAULT 0 CHECK (wants_given >= 0),
    passes_given            bigint NOT NULL DEFAULT 0 CHECK (passes_given >= 0),
    profile_views           bigint NOT NULL DEFAULT 0 CHECK (profile_views >= 0),
    current_streak_days     integer NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
    longest_streak_days     integer NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
    last_active_date        date,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.user_sessions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    refresh_token_hash text NOT NULL,
    device_name        varchar(120),
    ip_hash            text,
    user_agent         text,
    expires_at         timestamptz NOT NULL,
    revoked_at         timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wants.schema_migrations(version) VALUES ('002_create_users')
ON CONFLICT (version) DO NOTHING;
COMMIT;
