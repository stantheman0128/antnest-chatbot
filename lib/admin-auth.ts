import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "./supabase";

/**
 * Verify admin authentication via Bearer token (Supabase session token).
 * Returns null if authenticated, or an error response if not.
 */
export function verifyAdmin(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For now, use a simple admin secret for API auth.
  // This keeps the admin UI simple without requiring full Supabase Auth setup.
  const token = authHeader.replace("Bearer ", "");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || token !== adminSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/**
 * Verify admin login credentials.
 * Returns true if email/password match the configured admin.
 */
export function verifyAdminLogin(
  email: string,
  password: string
): { valid: boolean; token?: string } {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_SECRET;

  if (
    email === adminEmail &&
    password === adminPassword &&
    adminSecret
  ) {
    return { valid: true, token: adminSecret };
  }

  return { valid: false };
}
