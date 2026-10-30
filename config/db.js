const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: env.dbPoolMax,
  idleTimeoutMillis: env.dbIdleTimeoutMs,
  connectionTimeoutMillis: env.dbConnectionTimeoutMs,
  application_name: "want-server"
});

pool.on("error", (error) => {
  console.error("[database] Unexpected idle client error:", error);
});

const query = (text, params) => pool.query(text, params);

const withTransaction = async (work) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const checkDatabase = async () => {
  const result = await pool.query(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      current_setting('server_version') AS postgres_version,
      EXISTS (
        SELECT 1
        FROM information_schema.schemata
        WHERE schema_name = 'wants'
      ) AS wants_schema_exists,
      (
        SELECT count(*)::integer
        FROM wants.schema_migrations
      ) AS migration_count,
      (
        SELECT count(*)::integer
        FROM wants.categories
        WHERE is_active = true
      ) AS active_category_count,
      now() AS checked_at
  `);

  return result.rows[0];
};

const closePool = async () => {
  await pool.end();
};

module.exports = {
  pool,
  query,
  withTransaction,
  checkDatabase,
  closePool
};
