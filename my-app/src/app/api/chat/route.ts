import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_URL = "https://alona-v2.vercel.app/api/v1/chat";

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function stripThinking(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  const lower = out.toLowerCase();
  const openIdx = lower.indexOf("<thinking");
  if (openIdx !== -1) {
    out = out.slice(0, openIdx);
  }
  return out;
}

function stripSourcesSection(text: string): string {
  if (!text) return text;
  const patterns: RegExp[] = [
    /(?:\n---\n|\n)\*\*Sources:\*\*[\s\S]*$/i,
    /(?:\n---\n|\n)Sources:\s*[\s\S]*$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m || m.index == null) continue;
    const idx = m.index;
    const tail = text.slice(idx);
    const looksLikeCitations =
      /(\brelevance\b|\.pdf\b|\.docx?\b|visibilityLabel|documentsReferenced|sourcesReferenced)/i.test(
        tail
      );
    if (!looksLikeCitations) continue;
    return text.slice(0, idx).trimEnd();
  }
  return text;
}

function sanitizeAssistantText(text: string): string {
  return stripSourcesSection(stripThinking(text));
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
  const userId = typeof record.userId === "string" ? record.userId.trim() : "anonymous";
  const walletAddress =
    typeof record.walletAddress === "string" ? record.walletAddress.trim() : undefined;
  const pagePath = typeof record.pagePath === "string" ? record.pagePath.trim() : undefined;
  const pageUrl = typeof record.pageUrl === "string" ? record.pageUrl.trim() : undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  if (!message) {
    return badRequest("Missing 'message'");
  }
  if (message.length > 4000) {
    return badRequest("Message too long (max 4000 chars)");
  }

  let interactionId: string | null = null;
  try {
    const created = await prisma.chatInteraction.create({
      data: {
        userId,
        walletAddress,
        pagePath,
        pageUrl,
        question: message,
        status: "Started",
        userAgent,
      },
      select: { id: true },
    });
    interactionId = created.id;
  } catch (e) {
    // Logging must never break chat.
    interactionId = null;
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
      body: JSON.stringify({ message, userId }),
    });
  } catch (error) {
    if (interactionId) {
      try {
        await prisma.chatInteraction.update({
          where: { id: interactionId },
          data: {
            status: "Error",
            errorMessage: error instanceof Error ? error.message : "unknown upstream error",
          },
        });
      } catch {}
    }
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
    if (interactionId) {
      try {
        await prisma.chatInteraction.update({
          where: { id: interactionId },
          data: {
            status: "Error",
            errorMessage: `Upstream ${upstream.status}: ${text.slice(0, 2000)}`,
          },
        });
      } catch {}
    }
    return Response.json(
      {
        error: "Upstream chat error",
        upstreamStatus: upstream.status,
        upstreamBody: text.slice(0, 2000),
      },
      { status: upstream.status }
    );
  }

  // Forward streaming body while parsing SSE for analytics.
  const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";

  const upstreamBody = upstream.body;
  if (!upstreamBody) {
    if (interactionId) {
      try {
        await prisma.chatInteraction.update({
          where: { id: interactionId },
          data: {
            status: "Error",
            errorMessage: "Upstream returned empty body",
          },
        });
      } catch {}
    }
    return Response.json({ error: "Upstream returned empty body" }, { status: 502 });
  }

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const reader = upstreamBody.getReader();
  const writer = stream.writable.getWriter();

  // Analytics extraction (best-effort; never blocks forwarding).
  const statusHistory = new Set<string>();
  let statusLatest: string | null = null;
  let rawAnswer = "";
  let model: string | null = null;
  let processingTimeMs: number | null = null;
  let finalAnswer: string | null = null;
  let sseBuffer = "";
  const decoder = new TextDecoder();

  const normalize = (chunkText: string) => chunkText.replace(/\r\n/g, "\n");

  const handlePayload = (payload: string) => {
    const trimmed = payload.trim();
    if (!trimmed) return;
    if (trimmed === "[DONE]") return;

    let obj: any = null;
    try {
      obj = JSON.parse(payload);
    } catch {
      obj = null;
    }

    if (obj && typeof obj === "object") {
      const t = typeof obj.type === "string" ? obj.type : "";
      if (t === "status") {
        const c = typeof obj.content === "string" ? obj.content.trim() : "";
        if (c) {
          statusLatest = c;
          statusHistory.add(c);
        }
        return;
      }
      if (t === "token") {
        const c = typeof obj.content === "string" ? obj.content : "";
        if (c) rawAnswer += c;
        return;
      }
      if (t === "complete") {
        const answer =
          (typeof obj.answer === "string" && obj.answer) ||
          (typeof obj.content === "string" && obj.content) ||
          rawAnswer;
        finalAnswer = answer;

        const meta = obj.metadata;
        if (meta && typeof meta === "object") {
          if (typeof meta.model === "string") model = meta.model;
          if (typeof meta.processingTimeMs === "number" && Number.isFinite(meta.processingTimeMs)) {
            processingTimeMs = Math.trunc(meta.processingTimeMs);
          }
        }
        return;
      }
      return;
    }

    rawAnswer += payload;
  };

  const handleSseBlock = (block: string) => {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));

    if (dataLines.length === 0) return;
    handlePayload(dataLines.join("\n"));
  };

  (async () => {
    let streamError: string | null = null;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          await writer.write(value);
          // Parse SSE in parallel (best-effort).
          try {
            sseBuffer += normalize(decoder.decode(value, { stream: true }));
            while (true) {
              const sep = sseBuffer.indexOf("\n\n");
              if (sep === -1) break;
              const block = sseBuffer.slice(0, sep);
              sseBuffer = sseBuffer.slice(sep + 2);
              handleSseBlock(block);
            }
          } catch {}
        }
      }

      // Flush decode buffer.
      try {
        sseBuffer += normalize(decoder.decode());
        if (sseBuffer.trim().length > 0) {
          handleSseBlock(sseBuffer);
        }
      } catch {}
    } catch (e) {
      streamError = e instanceof Error ? e.message : "stream error";
    } finally {
      try {
        await writer.close();
      } catch {}

      if (interactionId) {
        try {
          if (streamError) {
            await prisma.chatInteraction.update({
              where: { id: interactionId },
              data: {
                status: "Error",
                statusLatest: statusLatest || undefined,
                statusHistory: statusHistory.size > 0 ? Array.from(statusHistory) : undefined,
                errorMessage: streamError,
              },
            });
          } else {
            const answerToStore = sanitizeAssistantText(finalAnswer ?? rawAnswer);
            await prisma.chatInteraction.update({
              where: { id: interactionId },
              data: {
                status: "Completed",
                answer: answerToStore,
                statusLatest: statusLatest || undefined,
                statusHistory: statusHistory.size > 0 ? Array.from(statusHistory) : undefined,
                model: model || undefined,
                processingTimeMs: processingTimeMs ?? undefined,
              },
            });
          }
        } catch {}
      }
    }
  })();

  return new Response(stream.readable, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
