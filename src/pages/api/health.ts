import type { APIRoute } from "astro";
import { healthCheck } from "@lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const dbOk = await healthCheck();

  const status = dbOk ? "ok" : "degraded";
  const httpStatus = dbOk ? 200 : 503;

  return new Response(
    JSON.stringify({ status, database: dbOk ? "connected" : "unreachable" }),
    { status: httpStatus, headers: { "Content-Type": "application/json" } }
  );
};
