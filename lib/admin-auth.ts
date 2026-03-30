import { NextRequest, NextResponse } from 'next/server';

import { SignJWT, jwtVerify } from 'jose';

const JWT_EXPIRY = '2h';

function getSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET not configured');
  return new TextEncoder().encode(secret);
}

/**
 * Verify admin authentication via Bearer JWT token.
 * Returns null if authenticated, or an error response if not.
 */
export async function verifyAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    await jwtVerify(token, getSecret());
    return null; // Valid
  } catch {
    // Fallback: accept raw ADMIN_SECRET for backward compatibility
    // (cron jobs, existing sessions before JWT migration)
    if (token === process.env.ADMIN_SECRET) return null;
    return NextResponse.json({ error: 'Token expired or invalid' }, { status: 401 });
  }
}

/**
 * Verify admin login credentials and issue a JWT.
 */
export async function verifyAdminLogin(
  email: string,
  password: string,
): Promise<{ valid: boolean; token?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (email === adminEmail && password === adminPassword) {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(getSecret());
    return { valid: true, token };
  }

  return { valid: false };
}
