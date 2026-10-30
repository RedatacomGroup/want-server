BEGIN;

CREATE INDEX user_sessions_user_active_idx ON wants.user_sessions (user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX user_profiles_country_idx ON wants.user_profiles (country_code) WHERE profile_visibility = 'public';
CREATE INDEX user_interests_interest_idx ON wants.user_interests (interest_id, weight DESC);

CREATE INDEX desires_feed_idx ON wants.desires (published_at DESC, id) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX desires_user_idx ON wants.desires (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX desires_category_idx ON wants.desires (category_id, published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX desires_country_idx ON wants.desires (country_code, published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX desires_brand_lower_idx ON wants.desires (lower(brand_name)) WHERE brand_name IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX desire_media_desire_idx ON wants.desire_media (desire_id, sort_order);
CREATE INDEX desire_tags_tag_idx ON wants.desire_tags (tag, desire_id);
CREATE INDEX desire_stats_trending_idx ON wants.desire_stats (trending_score DESC, desire_id);
CREATE INDEX desire_stats_breakout_idx ON wants.desire_stats (breakout_score DESC, desire_id);
CREATE INDEX desire_stats_wants_idx ON wants.desire_stats (want_count DESC, desire_id);

CREATE INDEX swipes_user_recent_idx ON wants.swipes (user_id, created_at DESC);
CREATE INDEX swipes_desire_decision_idx ON wants.swipes (desire_id, decision, created_at DESC);
CREATE INDEX impressions_user_recent_idx ON wants.feed_impressions (user_id, created_at DESC);
CREATE INDEX impressions_desire_recent_idx ON wants.feed_impressions (desire_id, created_at DESC);
CREATE INDEX desire_daily_metrics_desire_date_idx ON wants.desire_daily_metrics (desire_id, metric_date DESC);
CREATE INDEX user_daily_metrics_user_date_idx ON wants.user_daily_metrics (user_id, metric_date DESC);

CREATE INDEX user_stats_wants_generated_idx ON wants.user_stats (total_wants_generated DESC, user_id);
CREATE INDEX user_badges_user_active_idx ON wants.user_badges (user_id, awarded_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX notifications_unread_idx ON wants.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX reports_queue_idx ON wants.reports (status, created_at ASC) WHERE status IN ('open','reviewing');
CREATE INDEX moderation_actions_target_idx ON wants.moderation_actions (target_type, target_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON wants.audit_log (entity_type, entity_id, created_at DESC);

INSERT INTO wants.schema_migrations(version) VALUES ('009_create_indexes')
ON CONFLICT (version) DO NOTHING;
COMMIT;
