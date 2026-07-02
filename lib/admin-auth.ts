import { NextRequest, NextResponse } from 'next/server';

import { SignJWT, jwtVerify } from 'jose';

import { safeEqualStr } from './safe-equal';

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
    // Admin API accepts only short-lived JWTs. The old raw-ADMIN_SECRET fallback
    // (a permanent, unrevocable master key) was removed; cron now calls
    // runProductSync() directly instead of hitting this route with the secret.
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

  if (
    adminEmail &&
    adminPassword &&
    safeEqualStr(email, adminEmail) &&
    safeEqualStr(password, adminPassword)
  ) {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(getSecret());
    return { valid: true, token };
  }

  return { valid: false };
}
