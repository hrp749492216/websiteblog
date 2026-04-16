import { createPool } from "@vercel/postgres";

const connectionString = process.env.blogpost_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing blogpost_POSTGRES_URL / POSTGRES_URL");
  process.exit(1);
}

const pool = createPool({ connectionString });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments (post_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT PRIMARY KEY,
      last_post TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
