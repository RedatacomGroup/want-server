BEGIN;

CREATE OR REPLACE FUNCTION wants.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION wants.initialize_user_rows()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO wants.user_profiles(user_id) VALUES (NEW.id);
    INSERT INTO wants.user_settings(user_id) VALUES (NEW.id);
    INSERT INTO wants.user_stats(user_id) VALUES (NEW.id);
    INSERT INTO wants.notification_preferences(user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION wants.initialize_desire_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO wants.desire_stats(desire_id) VALUES (NEW.id);
    UPDATE wants.user_stats
       SET desires_posted = desires_posted + 1, updated_at = now()
     WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION wants.apply_swipe_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_owner uuid;
    want_delta integer := 0;
    pass_delta integer := 0;
    user_want_delta integer := 0;
    user_pass_delta integer := 0;
BEGIN
    SELECT user_id INTO v_owner FROM wants.desires WHERE id = NEW.desire_id;

    IF TG_OP = 'INSERT' THEN
        IF NEW.decision = 'want' THEN want_delta := 1; user_want_delta := 1;
        ELSE pass_delta := 1; user_pass_delta := 1; END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.decision IS DISTINCT FROM NEW.decision THEN
        IF OLD.decision = 'want' THEN want_delta := want_delta - 1; user_want_delta := user_want_delta - 1;
        ELSE pass_delta := pass_delta - 1; user_pass_delta := user_pass_delta - 1; END IF;
        IF NEW.decision = 'want' THEN want_delta := want_delta + 1; user_want_delta := user_want_delta + 1;
        ELSE pass_delta := pass_delta + 1; user_pass_delta := user_pass_delta + 1; END IF;
    ELSE
        RETURN NEW;
    END IF;

    UPDATE wants.desire_stats
       SET want_count = GREATEST(0, want_count + want_delta),
           pass_count = GREATEST(0, pass_count + pass_delta),
           updated_at = now()
     WHERE desire_id = NEW.desire_id;

    UPDATE wants.user_stats
       SET wants_given = GREATEST(0, wants_given + user_want_delta),
           passes_given = GREATEST(0, passes_given + user_pass_delta),
           updated_at = now()
     WHERE user_id = NEW.user_id;

    UPDATE wants.user_stats
       SET total_wants_generated = GREATEST(0, total_wants_generated + want_delta),
           total_passes_generated = GREATEST(0, total_passes_generated + pass_delta),
           updated_at = now()
     WHERE user_id = v_owner;

    INSERT INTO wants.user_daily_metrics(metric_date, user_id, swipes_given, wants_given, passes_given)
    VALUES (CURRENT_DATE, NEW.user_id, CASE WHEN TG_OP='INSERT' THEN 1 ELSE 0 END,
            GREATEST(0,user_want_delta), GREATEST(0,user_pass_delta))
    ON CONFLICT (metric_date, user_id) DO UPDATE SET
        swipes_given = wants.user_daily_metrics.swipes_given + EXCLUDED.swipes_given,
        wants_given = GREATEST(0,wants.user_daily_metrics.wants_given + user_want_delta),
        passes_given = GREATEST(0,wants.user_daily_metrics.passes_given + user_pass_delta);

    INSERT INTO wants.desire_daily_metrics(metric_date, desire_id, wants, passes)
    VALUES (CURRENT_DATE, NEW.desire_id, GREATEST(0,want_delta), GREATEST(0,pass_delta))
    ON CONFLICT (metric_date, desire_id) DO UPDATE SET
        wants = GREATEST(0,wants.desire_daily_metrics.wants + want_delta),
        passes = GREATEST(0,wants.desire_daily_metrics.passes + pass_delta);

    IF v_owner IS NOT NULL THEN
      INSERT INTO wants.user_daily_metrics(metric_date, user_id, wants_generated)
      VALUES (CURRENT_DATE, v_owner, GREATEST(0,want_delta))
      ON CONFLICT (metric_date, user_id) DO UPDATE SET
          wants_generated = GREATEST(0,wants.user_daily_metrics.wants_generated + want_delta);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION wants.record_impression()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE wants.desire_stats
       SET impression_count = impression_count + 1, updated_at = now()
     WHERE desire_id = NEW.desire_id;
    INSERT INTO wants.desire_daily_metrics(metric_date, desire_id, impressions)
    VALUES (CURRENT_DATE, NEW.desire_id, 1)
    ON CONFLICT (metric_date, desire_id) DO UPDATE SET
        impressions = wants.desire_daily_metrics.impressions + 1;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION wants.record_share()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE wants.desire_stats SET share_count = share_count + 1, updated_at = now()
    WHERE desire_id = NEW.desire_id;
    INSERT INTO wants.desire_daily_metrics(metric_date, desire_id, shares)
    VALUES (CURRENT_DATE, NEW.desire_id, 1)
    ON CONFLICT (metric_date, desire_id) DO UPDATE SET shares = wants.desire_daily_metrics.shares + 1;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION wants.award_threshold_badges(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_awarded integer;
BEGIN
    WITH eligible AS (
        SELECT b.id
        FROM wants.badges b
        JOIN wants.user_stats s ON s.user_id = p_user_id
        WHERE b.is_active AND b.rule_type='threshold'
          AND CASE b.rule_config->>'metric'
              WHEN 'desires_posted' THEN s.desires_posted
              WHEN 'total_wants_generated' THEN s.total_wants_generated
              ELSE 0 END >= (b.rule_config->>'threshold')::numeric
    ), inserted AS (
        INSERT INTO wants.user_badges(user_id, badge_id, award_reason)
        SELECT p_user_id, e.id, 'Threshold reached' FROM eligible e
        ON CONFLICT (user_id, badge_id) DO NOTHING
        RETURNING id, badge_id
    )
    INSERT INTO wants.notifications(user_id, type, title, body, data)
    SELECT p_user_id, 'badge_unlocked', 'Badge unlocked', b.name,
           jsonb_build_object('badgeId', b.id, 'code', b.code)
    FROM inserted i JOIN wants.badges b ON b.id=i.badge_id;

    GET DIAGNOSTICS v_awarded = ROW_COUNT;
    RETURN v_awarded;
END;
$$;

CREATE TRIGGER users_initialize_rows
AFTER INSERT ON wants.users FOR EACH ROW EXECUTE FUNCTION wants.initialize_user_rows();
CREATE TRIGGER desires_initialize_stats
AFTER INSERT ON wants.desires FOR EACH ROW EXECUTE FUNCTION wants.initialize_desire_stats();
CREATE TRIGGER swipes_apply_change
AFTER INSERT OR UPDATE OF decision ON wants.swipes FOR EACH ROW EXECUTE FUNCTION wants.apply_swipe_change();
CREATE TRIGGER feed_impressions_record
AFTER INSERT ON wants.feed_impressions FOR EACH ROW EXECUTE FUNCTION wants.record_impression();
CREATE TRIGGER desire_shares_record
AFTER INSERT ON wants.desire_shares FOR EACH ROW EXECUTE FUNCTION wants.record_share();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','user_profiles','user_settings','categories','user_interests','desires','swipes','badges','badge_progress','notification_preferences','reports']
  LOOP
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON wants.%I FOR EACH ROW EXECUTE FUNCTION wants.set_updated_at()', t, t);
  END LOOP;
END $$;

INSERT INTO wants.schema_migrations(version) VALUES ('011_create_functions_and_triggers')
ON CONFLICT (version) DO NOTHING;
COMMIT;
