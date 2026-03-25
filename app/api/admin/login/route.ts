import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLogin } from "@/lib/admin-auth";

// In-memory rate limiter: max 5 failed attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const result = await verifyAdminLogin(email, password);

  if (!result.valid) {
    recordFailure(ip);
    // Return generic error — don't reveal which field was wrong
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Clear failure record on success
  attempts.delete(ip);

  return NextResponse.json({ token: result.token });
}
