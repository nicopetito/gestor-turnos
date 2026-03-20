import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionValue,
  validateAdminSession,
  unauthorizedResponse,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/admin-auth';

/** POST /api/admin/auth — login con clave */
export async function POST(request: NextRequest) {
  let body: { key: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.key || body.key !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 });
  }

  const sessionValue = createSessionValue();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...SESSION_COOKIE_OPTIONS, value: sessionValue });
  return response;
}

/** GET /api/admin/auth — verifica si hay sesión activa */
export async function GET(request: NextRequest) {
  if (!validateAdminSession(request)) return unauthorizedResponse();
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/auth — logout (borra cookie) */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...SESSION_COOKIE_OPTIONS, value: '', maxAge: 0 });
  return response;
}
