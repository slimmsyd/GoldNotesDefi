import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_URL = "https://alona-v2.vercel.app/api/v1/chat";

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ALONA_API_KEY;
  if (!apiKey) {
    return badRequest("Missing server env var: ALONA_API_KEY", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const record = body as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const userId = typeof record.userId === "string" ? record.userId.trim() : undefined;

  if (!message) {
    return badRequest("Missing 'message'");
  }
  if (message.length > 4000) {
    return badRequest("Message too long (max 4000 chars)");
  }

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Always send both fields the upstream example shows; allow userId to be nullish.
      body: JSON.stringify({ message, userId: userId || "anonymous" }),
    });
  } catch (error) {
    return Response.json(
      {
        error: "Upstream chat request failed",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 502 }
    );
  }

  // If the upstream returns a non-2xx, surface details (don't stream opaque errors).
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return Response.json(
      {
        error: "Upstream chat error",
        upstreamStatus: upstream.status,
        upstreamBody: text.slice(0, 2000),
      },
      { status: upstream.status }
    );
  }

  // Forward streaming body if present.
  const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
