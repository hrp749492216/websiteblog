import { createPool } from "@vercel/postgres";

const pool = createPool({
  connectionString:
    process.env.blogpost_POSTGRES_URL || process.env.POSTGRES_URL,
});

let initialized = false;

export async function ensureTable() {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments (post_id)`
  );
  initialized = true;
}

export async function getComments(postId: string) {
  const { rows } = await pool.query(
    `SELECT id, post_id, author_name, body, created_at
     FROM comments WHERE post_id = $1 ORDER BY created_at DESC`,
    [postId]
  );
  return rows;
}

export async function addComment(postId: string, authorName: string, body: string) {
  await pool.query(
    `INSERT INTO comments (post_id, author_name, body) VALUES ($1, $2, $3)`,
    [postId, authorName, body]
  );
}
