import { NextResponse } from "next/server";
import { createLead, listLeads } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/api";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAuthorized())) return errorResponse("Sign in required.", 401);
  try {
    return NextResponse.json({ leads: listLeads() });
  } catch {
    return errorResponse("Could not load leads.", 500);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) return errorResponse("Sign in required.", 401);
  const body = await parseBody(request);
  if (!body) return errorResponse("A JSON object is required.", 400);
  if (typeof body.name !== "string" || !body.name.trim()) return errorResponse("Name is required.", 422);
  if (body.name.trim().length > 120) return errorResponse("Name must be 120 characters or fewer.", 422);
  if (body.company != null && (typeof body.company !== "string" || body.company.length > 120)) return errorResponse("Company must be 120 characters or fewer.", 422);
  if (body.phone != null && (typeof body.phone !== "string" || body.phone.length > 40)) return errorResponse("Phone must be 40 characters or fewer.", 422);
  try {
    const lead = createLead({ name: body.name.trim(), company: typeof body.company === "string" ? body.company.trim() : undefined, phone: typeof body.phone === "string" ? body.phone.trim() : undefined });
    return NextResponse.json({ lead }, { status: 201 });
  } catch {
    return errorResponse("Could not create lead.", 500);
  }
}
