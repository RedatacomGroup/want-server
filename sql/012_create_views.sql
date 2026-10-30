BEGIN;

CREATE OR REPLACE VIEW wants.v_public_profiles AS
SELECT
    u.id AS user_id,
    u.username,
    p.display_name,
    p.bio,
    p.profile_image_url,
    CASE WHEN p.show_country THEN p.country_code END AS country_code,
    s.desires_posted,
    s.total_wants_generated,
    s.profile_views,
    b.code AS equipped_badge_code,
    b.name AS equipped_badge_name,
    b.icon_key AS equipped_badge_icon_key
FROM wants.users u
JOIN wants.user_profiles p ON p.user_id=u.id
JOIN wants.user_stats s ON s.user_id=u.id
LEFT JOIN wants.user_equipped_badges eb ON eb.user_id=u.id
LEFT JOIN wants.user_badges ub ON ub.id=eb.user_badge_id AND ub.revoked_at IS NULL
LEFT JOIN wants.badges b ON b.id=ub.badge_id
WHERE u.status='active' AND u.deleted_at IS NULL AND p.profile_visibility='public';

CREATE OR REPLACE VIEW wants.v_published_desires AS
SELECT
    d.id,
    d.user_id,
    u.username,
    p.profile_image_url,
    d.category_id,
    c.slug AS category_slug,
    c.name AS category_name,
    d.title,
    d.caption,
    d.brand_name,
    d.product_name,
    d.source_url,
    d.country_code,
    d.published_at,
    ds.want_count,
    ds.pass_count,
    ds.impression_count,
    ds.share_count,
    ds.trending_score,
    ds.breakout_score,
    CASE WHEN (ds.want_count + ds.pass_count) = 0 THEN 0
         ELSE round(ds.want_count::numeric / (ds.want_count + ds.pass_count), 4) END AS want_rate
FROM wants.desires d
JOIN wants.users u ON u.id=d.user_id
JOIN wants.user_profiles p ON p.user_id=u.id
JOIN wants.categories c ON c.id=d.category_id
JOIN wants.desire_stats ds ON ds.desire_id=d.id
WHERE d.status='published' AND d.deleted_at IS NULL AND u.status='active';

CREATE OR REPLACE VIEW wants.v_global_tastemakers AS
SELECT
    p.user_id, p.username, p.display_name, p.profile_image_url,
    p.country_code, p.total_wants_generated, p.desires_posted,
    dense_rank() OVER (ORDER BY p.total_wants_generated DESC) AS global_rank
FROM wants.v_public_profiles p;

CREATE OR REPLACE VIEW wants.v_country_tastemakers AS
SELECT
    p.user_id, p.username, p.display_name, p.profile_image_url,
    p.country_code, p.total_wants_generated, p.desires_posted,
    dense_rank() OVER (PARTITION BY p.country_code ORDER BY p.total_wants_generated DESC) AS country_rank
FROM wants.v_public_profiles p
WHERE p.country_code IS NOT NULL;

CREATE OR REPLACE VIEW wants.v_category_tastemakers AS
SELECT
    d.user_id,
    d.username,
    d.category_id,
    d.category_slug,
    d.category_name,
    sum(d.want_count)::bigint AS category_wants_generated,
    count(*)::bigint AS category_desires,
    dense_rank() OVER (PARTITION BY d.category_id ORDER BY sum(d.want_count) DESC) AS category_rank
FROM wants.v_published_desires d
GROUP BY d.user_id,d.username,d.category_id,d.category_slug,d.category_name;

CREATE OR REPLACE VIEW wants.v_desire_dna_categories AS
SELECT
    s.user_id,
    d.category_id,
    c.slug AS category_slug,
    c.name AS category_name,
    count(*) FILTER (WHERE s.decision='want')::bigint AS wants,
    count(*)::bigint AS decisions,
    round(100.0 * count(*) FILTER (WHERE s.decision='want') / NULLIF(count(*),0), 2) AS want_percentage
FROM wants.swipes s
JOIN wants.desires d ON d.id=s.desire_id
JOIN wants.categories c ON c.id=d.category_id
GROUP BY s.user_id,d.category_id,c.slug,c.name;

INSERT INTO wants.schema_migrations(version) VALUES ('012_create_views')
ON CONFLICT (version) DO NOTHING;
COMMIT;
