import { createPool } from "@vercel/postgres";

const connectionString = process.env.blogpost_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error(
    "Database connection string not configured. Set blogpost_POSTGRES_URL or POSTGRES_URL.",
  );
}

const pool = createPool({ connectionString });

let initPromise: Promise<void> | null = null;

export async function ensureTable() {
  if (!initPromise) {
    initPromise = (async () => {
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
    })();
  }
  return initPromise;
}

export async function getComments(postId: string) {
  const { rows } = await pool.query(
    `SELECT id, post_id, author_name, body, created_at
     FROM comments WHERE post_id = $1 ORDER BY created_at DESC`,
    [postId],
  );
  return rows;
}

export async function addComment(postId: string, authorName: string, body: string) {
  await pool.query(`INSERT INTO comments (post_id, author_name, body) VALUES ($1, $2, $3)`, [
    postId,
    authorName,
    body,
  ]);
}

export async function checkRateLimit(ip: string, windowMs: number): Promise<boolean> {
  const { rows } = await pool.query(`SELECT last_post FROM rate_limits WHERE ip = $1`, [ip]);
  if (rows.length > 0) {
    const lastPost = new Date(rows[0].last_post).getTime();
    if (Date.now() - lastPost < windowMs) {
      return true; // rate limited
    }
  }
  return false;
}

export async function recordRateLimit(ip: string): Promise<void> {
  await pool.query(
    `INSERT INTO rate_limits (ip, last_post) VALUES ($1, NOW())
     ON CONFLICT (ip) DO UPDATE SET last_post = NOW()`,
    [ip],
  );
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
