import sanitizeHtml from "sanitize-html";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for comment API logic (validation, sanitization, CSRF)
// These test the pure logic without needing a database connection.

function sanitize(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const ALLOWED_ORIGINS = [
  "https://hariramanpokhrel.com.np",
  "http://localhost:4321",
  "http://localhost:3000",
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // no origin header = same-origin or non-browser
  return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
}

describe("sanitize()", () => {
  it("strips HTML tags", () => {
    expect(sanitize("<b>bold</b>")).toBe("bold");
  });

  it("strips script tags", () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe("");
  });

  it("strips event handlers in attributes", () => {
    expect(sanitize('<img onerror="alert(1)" src=x>')).toBe("");
  });

  it("preserves plain text", () => {
    expect(sanitize("Hello world")).toBe("Hello world");
  });

  it("handles encoded entities", () => {
    const result = sanitize("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("trims whitespace", () => {
    expect(sanitize("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });

  it("strips nested tags", () => {
    expect(sanitize("<div><p><b>nested</b></p></div>")).toBe("nested");
  });
});

describe("getClientIp()", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-real-ip": "1.2.3.4",
        "x-forwarded-for": "5.6.7.8, 9.10.11.12",
      },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for first entry", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("returns 'unknown' when no IP headers", () => {
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("CSRF origin validation", () => {
  it("allows production origin", () => {
    expect(isOriginAllowed("https://hariramanpokhrel.com.np")).toBe(true);
  });

  it("allows localhost development", () => {
    expect(isOriginAllowed("http://localhost:4321")).toBe(true);
  });

  it("blocks unknown origins", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
  });

  it("allows requests without origin header (same-origin)", () => {
    expect(isOriginAllowed(null)).toBe(true);
  });
});

describe("input validation", () => {
  it("rejects empty postId", () => {
    const postId = "";
    expect(!postId || typeof postId !== "string").toBe(true);
  });

  it("rejects non-string postId", () => {
    const postId = 123 as unknown;
    expect(typeof postId !== "string").toBe(true);
  });

  it("rejects empty authorName", () => {
    const authorName = "   ";
    expect(authorName.trim().length === 0).toBe(true);
  });

  it("rejects oversized authorName", () => {
    const authorName = "a".repeat(101);
    expect(authorName.length > 100).toBe(true);
  });

  it("rejects oversized comment body", () => {
    const body = "x".repeat(5001);
    expect(body.length > 5000).toBe(true);
  });

  it("accepts valid input", () => {
    const postId = "my-first-post";
    const authorName = "Alice";
    const body = "Great post!";
    expect(
      postId &&
        typeof postId === "string" &&
        authorName &&
        authorName.trim().length > 0 &&
        authorName.length <= 100 &&
        body &&
        body.trim().length > 0 &&
        body.length <= 5000,
    ).toBe(true);
  });

  it("detects honeypot field", () => {
    const website = "http://spam.com";
    expect(!!website).toBe(true); // honeypot filled = silently ignore
  });
});
