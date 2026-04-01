import type { APIRoute } from "astro";
import sanitizeHtml from "sanitize-html";
import { ensureTable, getComments, addComment, checkRateLimit, recordRateLimit } from "@lib/db";

export const prerender = false;

const RATE_LIMIT_MS = 30_000;
const ALLOWED_ORIGINS = [
  "https://hariramanpokhrel.com.np",
  "http://localhost:4321",
  "http://localhost:3000",
];

function sanitize(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

export const GET: APIRoute = async ({ url }) => {
  const postId = url.searchParams.get("postId");
  if (!postId) {
    return new Response(JSON.stringify({ error: "postId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await ensureTable();
    const rows = await getComments(postId);
    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Failed to fetch comments:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "Failed to fetch comments" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // CSRF: validate Origin header
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { postId, authorName, body: commentBody, website } = body as {
      postId?: string;
      authorName?: string;
      body?: string;
      website?: string;
    };

    // Determine client IP: prefer Astro's clientAddress (set by the adapter),
    // fall back to x-forwarded-for only when clientAddress is unavailable,
    // and reject the request if neither source provides an identity.
    const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = clientAddress || forwardedIp;

    if (!ip) {
      return new Response(
        JSON.stringify({ error: "Unable to determine client identity" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Honeypot: if filled, silently accept but don't store
    if (website) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validation
    if (!postId || typeof postId !== "string") {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!authorName || typeof authorName !== "string" || authorName.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (authorName.length > 100) {
      return new Response(JSON.stringify({ error: "Name is too long (max 100 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!commentBody || typeof commentBody !== "string" || commentBody.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Comment is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (commentBody.length > 5000) {
      return new Response(JSON.stringify({ error: "Comment is too long (max 5000 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Rate limiting (DB-backed, persists across serverless invocations)
    await ensureTable();
    const isLimited = await checkRateLimit(ip, RATE_LIMIT_MS);
    if (isLimited) {
      return new Response(JSON.stringify({ error: "Please wait before posting another comment" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanName = sanitize(authorName);
    const cleanBody = sanitize(commentBody);

    await addComment(postId, cleanName, cleanBody);
    await recordRateLimit(ip);

    console.log(
      JSON.stringify({
        event: "comment_created",
        postId,
        ip,
        timestamp: new Date().toISOString(),
      })
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Failed to post comment:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "Failed to post comment" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
