import { authFetch } from '@/lib/clientAuth';

type AcceptedOrderLite = { id: string };

/**
 * Where a courier should land:
 * - has active delivery → /active/[id] (first / most recent)
 * - otherwise → /work (ready orders hub)
 */
export async function resolveCourierHomePath(): Promise<string> {
  try {
    const res = await authFetch('/api/delivery/my-accepted');
    if (!res.ok) return '/work';
    const data = await res.json();
    const orders = (data.orders || []) as AcceptedOrderLite[];
    if (orders.length > 0 && orders[0]?.id) {
      return `/active/${orders[0].id}`;
    }
  } catch {
    /* fall through */
  }
  return '/work';
}
