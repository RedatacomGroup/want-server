BEGIN;

ALTER TYPE wants.feed_surface
  ADD VALUE IF NOT EXISTS 'people';

INSERT INTO wants.schema_migrations(version)
VALUES ('015_add_people_feed_surface')
ON CONFLICT (version) DO NOTHING;

COMMIT;
