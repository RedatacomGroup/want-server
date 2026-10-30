BEGIN;

CREATE TYPE wants.desire_status AS ENUM ('draft', 'pending', 'published', 'rejected', 'removed', 'archived');
CREATE TYPE wants.media_kind AS ENUM ('image', 'video');

CREATE TABLE wants.desires (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES wants.users(id) ON DELETE CASCADE,
    category_id       uuid NOT NULL REFERENCES wants.categories(id) ON DELETE RESTRICT,
    title             varchar(120) NOT NULL,
    caption           varchar(500),
    brand_name        varchar(120),
    product_name      varchar(160),
    source_url        text,
    country_code      char(2),
    status            wants.desire_status NOT NULL DEFAULT 'pending',
    moderation_note   text,
    published_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz,
    CONSTRAINT desires_title_not_blank CHECK (length(btrim(title)) >= 2),
    CONSTRAINT desires_country_upper CHECK (country_code IS NULL OR country_code = upper(country_code))
);

CREATE TABLE wants.desire_media (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    desire_id        uuid NOT NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
    kind             wants.media_kind NOT NULL DEFAULT 'image',
    storage_key      text NOT NULL,
    url              text NOT NULL,
    thumbnail_url    text,
    mime_type        varchar(100) NOT NULL,
    width            integer CHECK (width IS NULL OR width > 0),
    height           integer CHECK (height IS NULL OR height > 0),
    bytes            bigint CHECK (bytes IS NULL OR bytes > 0),
    alt_text         varchar(240),
    blurhash         varchar(200),
    sort_order       integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (desire_id, sort_order)
);

CREATE TABLE wants.desire_tags (
    desire_id        uuid NOT NULL REFERENCES wants.desires(id) ON DELETE CASCADE,
    tag              varchar(60) NOT NULL,
    source           varchar(20) NOT NULL DEFAULT 'user' CHECK (source IN ('user','system','ai','admin')),
    confidence       numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (desire_id, tag)
);

CREATE TABLE wants.desire_stats (
    desire_id         uuid PRIMARY KEY REFERENCES wants.desires(id) ON DELETE CASCADE,
    want_count        bigint NOT NULL DEFAULT 0 CHECK (want_count >= 0),
    pass_count        bigint NOT NULL DEFAULT 0 CHECK (pass_count >= 0),
    impression_count  bigint NOT NULL DEFAULT 0 CHECK (impression_count >= 0),
    unique_viewers    bigint NOT NULL DEFAULT 0 CHECK (unique_viewers >= 0),
    share_count       bigint NOT NULL DEFAULT 0 CHECK (share_count >= 0),
    report_count      bigint NOT NULL DEFAULT 0 CHECK (report_count >= 0),
    trending_score    numeric(18,6) NOT NULL DEFAULT 0,
    breakout_score    numeric(18,6) NOT NULL DEFAULT 0,
    updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wants.schema_migrations(version) VALUES ('004_create_desires')
ON CONFLICT (version) DO NOTHING;
COMMIT;
