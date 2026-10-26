import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Next.js 16 proxy — keep matcher NARROW.
 * Broad matchers can 404 valid app routes in `next dev` (Next.js #92921).
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      analytics: true,
    })
  : null;

const protectedRoutes = ['/admin', '/dashboard'];
const adminRoutes = ['/admin'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

  // Rate limit API (skip lightweight reads)
  const rateLimitExempt =
    pathname === '/api/auth/me' ||
    pathname.startsWith('/api/banners') ||
    pathname.startsWith('/api/health/');

  if (pathname.startsWith('/api/') && !rateLimitExempt && ratelimit) {
    try {
      const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }
    } catch (err) {
      console.error('Rate limiting error:', err);
    }
  }

  // Page auth only for protected areas (API uses its own auth())
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET missing');
    return NextResponse.next();
  }

  const token =
    req.cookies.get('auth_token')?.value ||
    (req.headers.get('authorization')?.startsWith('Bearer ')
      ? req.headers.get('authorization')!.slice(7).trim()
      : undefined);

  if (!token) {
    const url = new URL('/sign-in', req.url);
    url.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (isAdminRoute && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/work', req.url));
    }
    return NextResponse.next();
  } catch {
    const url = new URL('/sign-in', req.url);
    return NextResponse.redirect(url);
  }
}

/** Only run on admin/dashboard pages + API — avoids Next 16.2 broad-matcher 404 bug */
export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/api/:path*'],
};
