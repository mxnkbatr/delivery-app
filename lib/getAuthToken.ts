import { cookies, headers } from 'next/headers';
import { AUTH_COOKIE_NAME } from './authCookie';

/** Read JWT — prefer Authorization Bearer (Capacitor / authFetch), then cookie. */
export async function getAuthToken(): Promise<string | undefined> {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!raw) return undefined;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
