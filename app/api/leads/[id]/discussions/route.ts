import { NextResponse } from "next/server";
import { addDiscussion } from "@/lib/db";
import { errorResponse, parseBody, validId } from "@/lib/api";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!(await isAuthorized())) return errorResponse("Sign in required.", 401);
  const id = validId((await context.params).id);
  if (!id) return errorResponse("Invalid lead ID.", 400);
  const body = await parseBody(request);
  if (!body) return errorResponse("A JSON object is required.", 400);
  if (typeof body.note !== "string" || !body.note.trim()) return errorResponse("Discussion note is required.", 422);
  if (body.note.trim().length > 5000) return errorResponse("Note must be 5,000 characters or fewer.", 422);
  let followUpAt: string | null = null;
  if (body.followUpAt != null && body.followUpAt !== "") {
    if (typeof body.followUpAt !== "string" || !Number.isFinite(Date.parse(body.followUpAt))) return errorResponse("Follow-up must be a valid date and time.", 422);
    followUpAt = new Date(body.followUpAt).toISOString();
  }
  try {
    const lead = addDiscussion(id, body.note.trim(), followUpAt);
    return lead ? NextResponse.json({ lead }, { status: 201 }) : errorResponse("Lead not found.", 404);
  } catch {
    return errorResponse("Could not save discussion.", 500);
  }
}
