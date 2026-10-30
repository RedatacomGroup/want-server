BEGIN;

INSERT INTO wants.categories (slug, name, description, icon_key, sort_order) VALUES
('fashion','Fashion','Clothing, styling and fashion objects','shirt',10),
('beauty','Beauty','Beauty, skincare, makeup and fragrance','sparkles',20),
('jewellery','Jewellery','Jewellery, gems and personal adornment','gem',30),
('sneakers','Sneakers','Sneakers and footwear','footprints',40),
('watches','Watches','Watches and timepieces','watch',50),
('automotive','Automotive','Cars, motorcycles and vehicle design','car',60),
('homes','Homes','Homes, interiors and architecture','house',70),
('travel','Travel','Destinations, hotels and experiences','plane',80),
('technology','Technology','Devices, gadgets and future technology','smartphone',90),
('gaming','Gaming','Games, setups and gaming hardware','gamepad-2',100),
('food','Food','Food, drinks and restaurants','utensils',110),
('art','Art','Artworks, photography and sculpture','palette',120),
('design','Design','Industrial, graphic and product design','pen-tool',130),
('sport','Sport','Sports equipment, teams and experiences','trophy',140),
('entertainment','Entertainment','Film, music and popular culture','clapperboard',150),
('pets','Pets','Pets, animals and pet products','paw-print',160),
('other','Other','Desires outside the main categories','shapes',999)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    icon_key=EXCLUDED.icon_key, sort_order=EXCLUDED.sort_order, is_active=true;

INSERT INTO wants.interests (slug, name, category_id)
SELECT c.slug, c.name, c.id FROM wants.categories c
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, category_id=EXCLUDED.category_id, is_active=true;

INSERT INTO wants.badges (code, name, description, icon_key, rarity, rule_type, rule_config, sort_order) VALUES
('FIRST_DESIRE','First Desire','Published your first desire.','spark','common','threshold','{"metric":"desires_posted","threshold":1}',10),
('IGNITION','Ignition','Generated 100 Wants across your desires.','flame','common','threshold','{"metric":"total_wants_generated","threshold":100}',20),
('SPARK','Spark','Generated 1,000 Wants across your desires.','zap','uncommon','threshold','{"metric":"total_wants_generated","threshold":1000}',30),
('TASTEMAKER','Tastemaker','Generated 10,000 Wants across your desires.','gem','rare','threshold','{"metric":"total_wants_generated","threshold":10000}',40),
('ICON','Icon','Generated 100,000 Wants across your desires.','crown','epic','threshold','{"metric":"total_wants_generated","threshold":100000}',50),
('BREAKOUT','Breakout','One of your desires entered the Breakout chart.','rocket','rare','computed','{"event":"desire_breakout"}',60),
('GLOBAL','Global','One of your desires entered the global trending chart.','globe-2','epic','computed','{"event":"global_trending"}',70),
('HOMEGROUND','Homeground','Reached number one in your country.','flag','epic','ranking','{"scope":"country","rank":1}',80),
('ORACLE','Oracle','Consistently wanted desires before they became trends.','crystal-ball','legendary','computed','{"event":"oracle_qualified"}',90),
('CURATOR','Curator','Published a sustained collection of high-quality desires.','moon-star','rare','computed','{"event":"curator_qualified"}',100)
ON CONFLICT (code) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description, icon_key=EXCLUDED.icon_key,
    rarity=EXCLUDED.rarity, rule_type=EXCLUDED.rule_type, rule_config=EXCLUDED.rule_config,
    sort_order=EXCLUDED.sort_order, is_active=true;

INSERT INTO wants.schema_migrations(version) VALUES ('010_seed_categories_and_badges')
ON CONFLICT (version) DO NOTHING;
COMMIT;
