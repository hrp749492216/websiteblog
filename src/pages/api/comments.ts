import type { APIRoute } from "astro";
import { ensureTable, getComments, addComment } from "@lib/db";

export const prerender = false;

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

// Simple in-memory rate limiting: one comment per IP per 30 seconds
const recentPosts = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

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
    console.error("Failed to fetch comments:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch comments" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
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

    const body = await request.json();
    const { postId, authorName, body: commentBody, website } = body;

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

    const lastPost = recentPosts.get(ip);
    if (lastPost && Date.now() - lastPost < RATE_LIMIT_MS) {
      return new Response(JSON.stringify({ error: "Please wait before posting another comment" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanName = stripHtml(authorName.trim());
    const cleanBody = stripHtml(commentBody.trim());

    await ensureTable();
    await addComment(postId, cleanName, cleanBody);

    recentPosts.set(ip, Date.now());

    // Clean up old rate limit entries periodically
    if (recentPosts.size > 1000) {
      const now = Date.now();
      for (const [key, time] of recentPosts) {
        if (now - time > RATE_LIMIT_MS) recentPosts.delete(key);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Failed to post comment:", e);
    return new Response(JSON.stringify({ error: "Failed to post comment" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
