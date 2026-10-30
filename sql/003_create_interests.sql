BEGIN;

CREATE TABLE wants.categories (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          varchar(60) NOT NULL UNIQUE,
    name          varchar(80) NOT NULL,
    description   varchar(240),
    icon_key      varchar(80),
    sort_order    integer NOT NULL DEFAULT 0,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.interests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          varchar(60) NOT NULL UNIQUE,
    name          varchar(80) NOT NULL,
    category_id   uuid REFERENCES wants.categories(id) ON DELETE SET NULL,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wants.user_interests (
    user_id       uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    interest_id   uuid NOT NULL REFERENCES wants.interests(id) ON DELETE CASCADE,
    weight        numeric(6,3) NOT NULL DEFAULT 1.000 CHECK (weight >= 0),
    source        varchar(20) NOT NULL DEFAULT 'declared' CHECK (source IN ('declared','inferred')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, interest_id)
);

CREATE TABLE wants.user_color_preferences (
    user_id       uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    color_key     varchar(40) NOT NULL,
    score         numeric(8,3) NOT NULL DEFAULT 0 CHECK (score >= 0),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, color_key)
);

INSERT INTO wants.schema_migrations(version) VALUES ('003_create_interests')
ON CONFLICT (version) DO NOTHING;
COMMIT;
