import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { UB_DISTRICT_COORDS, DEFAULT_UB } from '@/lib/delivery/geo';

/**
 * GET — heat / peak zones from recent ready + shipped order density
 */
export async function GET() {
  try {
    const { userId, role } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await getCollection('orders');
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const recent = await orders
      .find({
        deliveryMethod: { $ne: 'pickup' },
        createdAt: { $gte: since },
        status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
      })
      .project({ shipping: 1, courierPayout: 1, readyForDelivery: 1 })
      .limit(200)
      .toArray();

    const buckets = new Map<
      string,
      { name: string; count: number; payoutSum: number; lat: number; lng: number; ready: number }
    >();

    for (const o of recent) {
      const district = String(o.shipping?.district || o.shipping?.city || 'Улаанбаатар').trim();
      const key = district.toLowerCase() || 'улаанбаатар';
      let coords = DEFAULT_UB;
      for (const [k, c] of Object.entries(UB_DISTRICT_COORDS)) {
        if (key.includes(k)) {
          coords = c;
          break;
        }
      }
      const cur = buckets.get(key) || {
        name: district || 'Улаанбаатар',
        count: 0,
        payoutSum: 0,
        lat: coords.lat,
        lng: coords.lng,
        ready: 0,
      };
      cur.count += 1;
      cur.payoutSum += Number(o.courierPayout) || 0;
      if (o.readyForDelivery) cur.ready += 1;
      buckets.set(key, cur);
    }

    const zones = [...buckets.values()]
      .map((z) => {
        const intensity = Math.min(1, z.count / 12);
        const peak = intensity >= 0.55 || z.ready >= 2;
        const bonusHint = peak ? Math.round(800 + intensity * 2200) : 0;
        return {
          ...z,
          intensity,
          peak,
          bonusHint,
          avgPayout: z.count ? Math.round(z.payoutSum / z.count) : 0,
          label: peak ? 'Peak' : intensity >= 0.3 ? 'Дунд' : 'Тайван',
        };
      })
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 8);

    return NextResponse.json({
      zones,
      center: DEFAULT_UB,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[courier/heat]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
