import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminAuthError } from "@/lib/supabase/server";
import { isTrustedRequestOrigin } from "@/lib/request-origin";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function checkRequestOrigin(request: Request) {
  if (!isTrustedRequestOrigin(request, process.env.NEXT_PUBLIC_SITE_URL)) throw new HttpError(403, "ORIGIN_DENIED");
}

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

/** Bound bodies even when Content-Length is absent or misleading. */
export async function readBoundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new HttpError(413, "PAYLOAD_TOO_LARGE");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, "PAYLOAD_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function readJson(request: Request) {
  checkRequestOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "JSON_REQUIRED");
  const body = await readBoundedBody(request, 32768);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown; } catch { throw new HttpError(400, "INVALID_JSON"); }
}

export function apiError(error: unknown) {
  if (error instanceof AdminAuthError) return json({ error: error.code }, error.status);
  if (error instanceof HttpError) return json({ error: error.code }, error.status);
  if (error instanceof ZodError) return json({ error: "VALIDATION_FAILED", fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, 400);
  // Never disclose database internals, tokens, stack traces, or credentials.
  return json({ error: "OPERATION_FAILED" }, 500);
}
