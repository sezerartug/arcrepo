import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_ROLE_COOKIE, handleDemo, isDemoMode, parseRole } from '@/lib/demo/mock-api';

// Demo kipinde `/api/*` istekleri buraya yönlenir (next.config.ts); gerçek API çağrılmaz.
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isDemoMode)
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Yok' } }, { status: 404 });
  const { path } = await ctx.params;
  const body =
    req.method === 'GET' ? undefined : ((await req.json().catch(() => undefined)) as unknown);
  const role = parseRole(req.cookies.get(DEMO_ROLE_COOKIE)?.value);
  const r = handleDemo(req.method, `/${path.join('/')}${req.nextUrl.search}`, role, body);
  const res =
    r.status === 204
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(r.body, { status: r.status });
  if (r.setRole)
    res.cookies.set(DEMO_ROLE_COOKIE, r.setRole, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
    });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
