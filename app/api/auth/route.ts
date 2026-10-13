import { NextResponse } from "next/server";
import { authEnabled, clearSession, setSession, validCredentials } from "@/lib/auth";
import { errorResponse, parseBody } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authEnabled()) return errorResponse("Login is not configured.", 503);
  const body = await parseBody(request);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") return errorResponse("Username and password are required.", 400);
  if (!validCredentials(body.username, body.password)) return errorResponse("Invalid username or password.", 401);
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  await setSession(body.username, secure);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
