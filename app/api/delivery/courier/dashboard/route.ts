import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { formatCustomerName, formatDropoffText, formatPackageTag } from '@/lib/delivery/format';
import { orderCourierPayout, orderCourierTotal } from '@/lib/delivery/payout';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function mapRecent(o: any) {
  const id = o._id.toString();
  const shipping = o.shipping || {};
  const payout = orderCourierPayout(o);
  return {
    id,
    code: `SD-${id.slice(-5).toUpperCase()}`,
    status: o.status,
    customerName: formatCustomerName(shipping, o.phone),
    dropoffText: formatDropoffText(shipping),
    packageTag: formatPackageTag(o),
    courierPayout: payout > 0 ? payout : null,
    deliveredAt: o.deliveredAt || null,
    courierAcceptedAt: o.courierAcceptedAt || null,
    createdAt: o.createdAt,
    readyForDeliveryAt: o.readyForDeliveryAt || null,
  };
}

/**
 * GET — courier dashboard KPIs + recent activity + hourly earnings bars
 */
export async function GET() {
  try {
    const { userId, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await getCollection('orders');
    const today = startOfToday();
    const courierFilter = role === 'admin' ? {} : { courierId: userId };

    const [
      readyQueue,
      onDelivery,
      deliveredToday,
      cancelledToday,
      deliveredTodayDocs,
      recent,
    ] = await Promise.all([
      orders.countDocuments({
        readyForDelivery: true,
        status: { $in: ['confirmed', 'processing'] },
        $and: [
          {
            $or: [{ courierId: { $exists: false } }, { courierId: null }, { courierId: '' }],
          },
          {
            $or: [
              { exclusiveCourierId: { $exists: false } },
              { exclusiveCourierId: null },
              { exclusiveCourierId: '' },
              { exclusiveCourierId: userId },
            ],
          },
        ],
        deliveryMethod: { $ne: 'pickup' },
      }),
      orders.countDocuments({
        ...courierFilter,
        status: 'shipped',
        deliveryMethod: { $ne: 'pickup' },
      }),
      orders.countDocuments({
        ...courierFilter,
        status: 'delivered',
        deliveredAt: { $gte: today },
      }),
      orders.countDocuments({
        ...courierFilter,
        status: 'cancelled',
        updatedAt: { $gte: today },
      }),
      orders
        .find({
          ...courierFilter,
          status: 'delivered',
          deliveredAt: { $gte: today },
        })
        .project({ courierPayout: 1, shippingCost: 1, courierTip: 1, courierBonus: 1, deliveredAt: 1 })
        .toArray(),
      orders
        .find({
          ...(role === 'admin' ? {} : { courierId: userId }),
          status: { $in: ['shipped', 'delivered', 'cancelled', 'processing'] },
          deliveryMethod: { $ne: 'pickup' },
        })
        .sort({ updatedAt: -1, deliveredAt: -1 })
        .limit(12)
        .toArray(),
    ]);

    const todayEarnings = deliveredTodayDocs.reduce((s, o) => s + orderCourierTotal(o), 0);

    // 12 buckets across the day (2h each) — real data only
    const hourBars = Array.from({ length: 12 }, () => 0);
    for (const o of deliveredTodayDocs) {
      if (!o.deliveredAt) continue;
      const h = new Date(o.deliveredAt).getHours();
      const bucket = Math.min(11, Math.floor(h / 2));
      hourBars[bucket] += orderCourierTotal(o);
    }
    const maxBar = Math.max(...hourBars, 0);

    return NextResponse.json({
      kpis: {
        readyQueue,
        onDelivery,
        deliveredToday,
        cancelledToday,
        todayEarnings,
      },
      earningsBars: hourBars,
      earningsBarsMax: maxBar,
      recent: recent.map(mapRecent),
    });
  } catch (error) {
    console.error('[courier/dashboard]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
