import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';

function getSecret(): string {
  return process.env.ADMIN_SECRET_KEY ?? 'admin123';
}

function signToken(token: string): string {
  return crypto.createHmac('sha256', getSecret()).update(token).digest('hex');
}

/** Creates a signed session value to store in the httpOnly cookie */
export function createSessionValue(): string {
  const token = crypto.randomUUID();
  const sig   = signToken(token);
  return `${token}.${sig}`;
}

/**
 * Validates the admin_session cookie using HMAC verification.
 * Works across serverless instances (no server-side state required).
 */
export function validateAdminSession(request: NextRequest): boolean {
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const dotIdx = value.lastIndexOf('.');
  if (dotIdx === -1) return false;

  const token = value.slice(0, dotIdx);
  const sig   = value.slice(dotIdx + 1);
  if (!token || !sig) return false;

  const expected = signToken(token);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig,      'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export const SESSION_COOKIE_OPTIONS = {
  name:     COOKIE_NAME,
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   60 * 60 * 24, // 24 horas
  path:     '/',
};
