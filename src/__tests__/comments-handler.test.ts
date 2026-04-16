import { beforeEach, describe, expect, it, vi } from "vitest";

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
    headers: { "Content-Type": "application/json", origin, "x-forwarded-for": "1.2.3.4" },
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
    getCommentsMock.mockResolvedValue([
      { id: 1, post_id: "x", author_name: "A", body: "hi", created_at: new Date() },
    ]);
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
    const res = await POST({
      request: makePost({ postId: "x", authorName: "A", body: "hi" }, "https://evil.com"),
    } as any);
    expect(res.status).toBe(403);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST({ request: makePost("not json") } as any);
    expect(res.status).toBe(400);
  });

  it("silently drops honeypot-filled submissions", async () => {
    const res = await POST({
      request: makePost({ postId: "x", authorName: "A", body: "hi", website: "spam" }),
    } as any);
    expect(res.status).toBe(200);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("rejects missing postId", async () => {
    const res = await POST({ request: makePost({ authorName: "A", body: "hi" }) } as any);
    expect(res.status).toBe(400);
  });

  it("rejects oversized body", async () => {
    const res = await POST({
      request: makePost({ postId: "x", authorName: "A", body: "x".repeat(5001) }),
    } as any);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate-limited", async () => {
    checkRateLimitMock.mockResolvedValue(true);
    const res = await POST({
      request: makePost({ postId: "x", authorName: "A", body: "hi" }),
    } as any);
    expect(res.status).toBe(429);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("sanitizes HTML in author name and body", async () => {
    const res = await POST({
      request: makePost({ postId: "x", authorName: "<b>A</b>", body: "<script>x</script>hello" }),
    } as any);
    expect(res.status).toBe(201);
    expect(addCommentMock).toHaveBeenCalledWith("x", "A", "hello");
  });

  it("records rate limit on successful post", async () => {
    await POST({ request: makePost({ postId: "x", authorName: "A", body: "hi" }) } as any);
    expect(recordRateLimitMock).toHaveBeenCalledWith("1.2.3.4");
  });
});
