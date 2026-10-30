WANT PostgreSQL schema package

Run the SQL files in numeric order against a fresh database.
All application objects live inside the isolated schema: wants.

PowerShell example using psql:
Get-ChildItem .\sql\*.sql | Sort-Object Name | ForEach-Object { psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName }

pgAdmin: open Query Tool and execute each numbered file in order.

Sanity checks after migration:
SELECT version, applied_at FROM wants.schema_migrations ORDER BY version;
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='wants' ORDER BY table_name;
SELECT * FROM wants.categories ORDER BY sort_order;
SELECT code, name, rarity FROM wants.badges ORDER BY sort_order;

Notes:
- Password hashing stays in Node.js (bcrypt/argon2); password_hash stores only the result.
- Images belong in object storage; desire_media stores URLs and metadata.
- Canonical object, brand claim, affiliate and ad tables are intentionally deferred until the consumer loop is validated.
