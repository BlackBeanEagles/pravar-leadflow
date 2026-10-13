import { NextResponse } from "next/server";
import { getLead, updateStatus } from "@/lib/db";
import { errorResponse, parseBody, validId } from "@/lib/api";
import { statuses, type LeadStatus } from "@/lib/types";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  if (!(await isAuthorized())) return errorResponse("Sign in required.", 401);
  const id = validId((await context.params).id);
  if (!id) return errorResponse("Invalid lead ID.", 400);
  try {
    const lead = getLead(id);
    return lead ? NextResponse.json({ lead }) : errorResponse("Lead not found.", 404);
  } catch {
    return errorResponse("Could not load lead.", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!(await isAuthorized())) return errorResponse("Sign in required.", 401);
  const id = validId((await context.params).id);
  if (!id) return errorResponse("Invalid lead ID.", 400);
  const body = await parseBody(request);
  if (!body) return errorResponse("A JSON object is required.", 400);
  if (!statuses.includes(body.status as LeadStatus)) return errorResponse("Invalid status.", 422);
  try {
    const lead = updateStatus(id, body.status as LeadStatus);
    return lead ? NextResponse.json({ lead }) : errorResponse("Lead not found.", 404);
  } catch {
    return errorResponse("Could not update status.", 500);
  }
}
