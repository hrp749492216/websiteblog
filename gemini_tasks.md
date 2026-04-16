# gemini_tasks.md — Remaining fixes for `websiteblog/` [COMPLETED]

**Completed on:** 2026-04-16
**Status:** All tasks finished and verified.

**For:** Gemini CLI, running autonomously against this Astro codebase.
**Working dir (this file's directory):** `/Users/hariramanpokhrel/Desktop/aivicepresident/websiteblog`
**Run all commands with this directory as cwd.** Node >= 22.12.0.

## Context

A security/quality audit on 2026-03-31 produced 22 findings in `.audit/latest/findings.jsonl` (1 HIGH, 9 MEDIUM, 12 LOW). **17 of 22 are already fixed** in the current code. Do not re-implement fixes that already exist — verify first. This file lists only the remaining actionable work.

**Already done (confirmed by reading current source — do not touch):**
F001 DB-backed rate limit, F002 CSRF origin allowlist, F003 `sanitize-html`, F004 CSP + security headers in `vercel.json`, F005 prefer `x-real-ip`, F006 explicit throw on missing DB URL, F008 `initPromise` memoization, F009 project README, F010 `.message`-only error logs, F011 typed remark plugin, F012 400 on invalid JSON, F013 `readingTime` in Zod schema, F014 async font loading, F018 CI in `.github/workflows/ci.yml`, F020 `/api/health` endpoint, F021 Biome + scripts, F022 structured `comment_created` log.

**F019 is a meta-finding** (re-audit recommendation). Skip.

## Pre-flight

Run these three commands first. If any fails, stop and surface the error before making changes.

```bash
npm install
npm run lint && npm run check && npm test
```

Baseline must pass before you start. If the baseline fails, the fix is to restore green before adding work, not to proceed on top of a broken tree.

---

## Task 1 — F015: Responsive image optimization (LOW, RELIABILITY)

**Problem:** Hero images in `BlogPostLayout.astro` and portrait in `about.astro` use raw `<img>` tags. They now have width/height/loading attributes (good — prevents CLS), but still lack `srcset`/AVIF/WebP. Astro's `<Image>` from `astro:assets` handles this automatically via the Vercel image service (already enabled in `astro.config.mjs`: `vercel({ imageService: true })`).

**Constraint:** `heroImage` in blog frontmatter is a **string path** (see `src/content.config.ts:11` — `heroImage: z.string().optional()`), not an imported `ImageMetadata`. Astro's `<Image>` accepts remote/string `src` when you pass explicit `width`/`height`. This works — do not change the content schema.

**Files:**
- `src/layouts/BlogPostLayout.astro`
- `src/pages/about.astro`

**Change 1 — `src/layouts/BlogPostLayout.astro`:**

Add to the frontmatter imports at the top (line ~5):
```astro
import { Image } from "astro:assets";
```

Replace the existing hero block (currently lines 46–50):
```astro
{heroImage && (
  <div class="hero-image">
    <img src={heroImage} alt={title} width="720" height="405" loading="eager" />
  </div>
)}
```
with:
```astro
{heroImage && (
  <div class="hero-image">
    <Image src={heroImage} alt={title} width={1440} height={810} loading="eager" widths={[480, 720, 1080, 1440]} sizes="(max-width: 768px) 100vw, 720px" />
  </div>
)}
```

**Change 2 — `src/pages/about.astro`:**

Move the portrait into `src/assets/hari-portrait.jpg` (copy from `public/images/hari-portrait.jpg`) so Astro can process it at build. Then:

Add to the frontmatter imports:
```astro
import { Image } from "astro:assets";
import portrait from "../assets/hari-portrait.jpg";
```

Replace the existing `<img>` on line 8:
```astro
<img src="/images/hari-portrait.jpg" alt="Hari Raman Pokhrel" width="280" height="280" loading="eager" />
```
with:
```astro
<Image src={portrait} alt="Hari Raman Pokhrel" width={280} height={280} loading="eager" />
```

Do not delete `public/images/hari-portrait.jpg` — other places (OG defaults, old external links) may reference it. Leave it in place.

**Verification:**
```bash
npm run check   # type check must pass
npm run build   # build must succeed; output should show image transforms
```
After build, inspect `dist/_astro/` — there should be optimized `.webp`/`.avif` variants of the portrait. Open `dist/blog/my-first-post/index.html` and confirm the hero `<picture>`/`<img>` has a `srcset` attribute.

---

## Task 2 — F016: Move `CREATE TABLE` out of the request path (LOW, RELIABILITY)

**Problem:** `ensureTable()` runs `CREATE TABLE IF NOT EXISTS` on every cold start (first request after a scale-to-zero). Adds ~50–100ms latency. The schema should be created once at deploy time, not per cold start.

**Approach:** Add a standalone migration script. Run it manually once against the production DB, then remove `ensureTable()` calls from request handlers. Keep the function exported but unused for now — don't delete it in this pass, because if the prod DB schema somehow drifts we still want a recovery path.

**Files:**
- Create `scripts/migrate.ts` (new file)
- Edit `src/lib/db.ts`
- Edit `src/pages/api/comments.ts`
- Edit `package.json`

**Change 1 — create `scripts/migrate.ts`:**

```typescript
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
```

**Change 2 — `package.json`:**

Add to `scripts`:
```json
"migrate": "tsx scripts/migrate.ts"
```
Add to `devDependencies`:
```json
"tsx": "^4.19.0"
```
Then: `npm install`.

**Change 3 — `src/pages/api/comments.ts`:**

Remove the two `await ensureTable();` calls (currently at lines ~36 and ~123). Keep the import intact — the function stays exported from `@lib/db` as a recovery hatch, just not called on the hot path.

**Change 4 — `src/pages/api/health.ts`:**

No change needed — it already uses `healthCheck()` which is a pure `SELECT 1` and doesn't call `ensureTable`.

**Deploy-time step for the user (document, don't run):**
Add this note to `README.md` under "Deployment":
```markdown
### One-time migration

Before first deploy (or after schema changes), run:
```bash
blogpost_POSTGRES_URL="postgres://..." npm run migrate
```
```

**Verification:**
```bash
npm run check
npm test
npm run build
```
Then grep to confirm the hot path no longer calls `ensureTable`:
```bash
grep -n "ensureTable" src/pages/api/
```
Expected: only the `import` line(s) remain, no call sites.

---

## Task 3 — F017: Add route-handler integration tests (HIGH, TESTING)

**Problem:** `src/__tests__/comments-api.test.ts` re-implements helper functions locally and tests them in isolation. The actual `GET`/`POST` exports from `src/pages/api/comments.ts` have never been exercised by a test. The finding's HIGH severity is because the critical-path handler is untested end-to-end.

**Approach:** Import the real handlers, inject a fake DB pool via module mocking, and drive them with crafted `Request` objects. Use Vitest's `vi.mock` on `@lib/db` so no real Postgres connection is needed (and so the module-level `throw` in `db.ts` doesn't fire during tests).

**File:** create `src/__tests__/comments-handler.test.ts`.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @lib/db BEFORE importing the route — the module-level DB pool
// construction in db.ts runs at import time and will throw without a
// connection string, so the mock must intercept it.
const getCommentsMock = vi.fn();
const addCommentMock = vi.fn();
const checkRateLimitMock = vi.fn();
const recordRateLimitMock = vi.fn();
const ensureTableMock = vi.fn().mockResolvedValue(undefined);
const healthCheckMock = vi.fn();

vi.mock("@lib/db", () => ({
  ensureTable: ensureTableMock,
  getComments: getCommentsMock,
  addComment: addCommentMock,
  checkRateLimit: checkRateLimitMock,
  recordRateLimit: recordRateLimitMock,
  healthCheck: healthCheckMock,
}));

const { GET, POST } = await import("../pages/api/comments");

function makePost(body: unknown, origin = "http://localhost:4321"): Request {
  return new Request("http://localhost:4321/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin, "x-real-ip": "1.2.3.4" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeGet(postId?: string): { url: URL } {
  const url = new URL("http://localhost:4321/api/comments");
  if (postId !== undefined) url.searchParams.set("postId", postId);
  return { url };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue(false);
  getCommentsMock.mockResolvedValue([]);
});

describe("GET /api/comments", () => {
  it("returns 400 when postId missing", async () => {
    const res = await GET({ url: makeGet().url } as any);
    expect(res.status).toBe(400);
  });

  it("returns rows for valid postId", async () => {
    getCommentsMock.mockResolvedValue([{ id: 1, post_id: "x", author_name: "A", body: "hi", created_at: new Date() }]);
    const res = await GET({ url: makeGet("x").url } as any);
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(getCommentsMock).toHaveBeenCalledWith("x");
  });

  it("returns 500 on DB failure", async () => {
    getCommentsMock.mockRejectedValue(new Error("db down"));
    const res = await GET({ url: makeGet("x").url } as any);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/comments", () => {
  it("rejects foreign origin with 403", async () => {
    const res = await POST({ request: makePost({ postId: "x", authorName: "A", body: "hi" }, "https://evil.com") } as any);
    expect(res.status).toBe(403);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST({ request: makePost("not json") } as any);
    expect(res.status).toBe(400);
  });

  it("silently drops honeypot-filled submissions", async () => {
    const res = await POST({ request: makePost({ postId: "x", authorName: "A", body: "hi", website: "spam" }) } as any);
    expect(res.status).toBe(200);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("rejects missing postId", async () => {
    const res = await POST({ request: makePost({ authorName: "A", body: "hi" }) } as any);
    expect(res.status).toBe(400);
  });

  it("rejects oversized body", async () => {
    const res = await POST({ request: makePost({ postId: "x", authorName: "A", body: "x".repeat(5001) }) } as any);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate-limited", async () => {
    checkRateLimitMock.mockResolvedValue(true);
    const res = await POST({ request: makePost({ postId: "x", authorName: "A", body: "hi" }) } as any);
    expect(res.status).toBe(429);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("sanitizes HTML in author name and body", async () => {
    const res = await POST({ request: makePost({ postId: "x", authorName: "<b>A</b>", body: "<script>x</script>hello" }) } as any);
    expect(res.status).toBe(201);
    expect(addCommentMock).toHaveBeenCalledWith("x", "A", "hello");
  });

  it("records rate limit on successful post", async () => {
    await POST({ request: makePost({ postId: "x", authorName: "A", body: "hi" }) } as any);
    expect(recordRateLimitMock).toHaveBeenCalledWith("1.2.3.4");
  });
});
```

**Verification:**
```bash
npm test
```
Expected: new file produces ~11 passing tests on top of the existing ~27. Total should be ~38+ tests passing, zero failures.

If tests fail because the route throws at import time (DB URL check in `db.ts`), the `vi.mock` call is working correctly — the mock factory must be defined before the dynamic `import(...)` of the route. The snippet above already handles this with `await import(...)`.

---

## Task 4 — F007 (documentation only): Annotate the hybrid SSG+SSR pattern

**Problem:** `astro.config.mjs` sets `output: "static"` but two routes opt out via `prerender = false`. This hybrid is valid in Astro 6 but fragile — easy to break by changing the output mode or forgetting to add `prerender = false` on a new API route.

**Change:** Add a one-line comment in `astro.config.mjs` above `output: "static"`:
```javascript
// Static-first; API routes opt out individually via `export const prerender = false`.
output: "static",
```

No other changes. Do not switch to `output: "server"` — that would force SSR on every route and hurt cold start times.

**Verification:** `npm run build`. No behavior change expected.

---

## Final verification

After all four tasks:

```bash
npm run lint
npm run check
npm test
npm run build
```

All four must succeed. If `npm run build` warns about images, that's expected during the first build with the Image component — confirm the `dist/_astro/` directory contains generated image variants.

Then report back with:
1. Task status: done / blocked / skipped (with reason).
2. `npm test` output summary (N passed / M failed).
3. Any finding IDs you decided not to address and why.

## Out of scope

Do not:
- Touch files outside `websiteblog/`. `PlanV1.md`, the resume, and `CLAUDE.md` at the parent level are unrelated.
- Refactor working code. Each task above is scoped — resist the urge to clean up adjacent code.
- Run `git push`, open PRs, or make destructive git operations. Commit locally only if explicitly told to.
- Delete `ensureTable()` from `db.ts` in Task 2 — leave it as a dormant recovery hatch.
- Modify `.audit/` — it is gitignored audit tooling output, not source of truth.
