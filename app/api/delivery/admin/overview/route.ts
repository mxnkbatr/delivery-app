import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

export async function GET() {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const orders = await getCollection('orders');
    const couriers = await getCollection('couriers');
    const users = await getCollection('users');

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const deliveryFilter = { deliveryMethod: { $ne: 'pickup' } };

    const [
      activeCount,
      deliveredToday,
      deliveredWeek,
      revenueAgg,
      weekRevenueAgg,
      courierDocs,
      courierUsers,
      readyCount,
      awaitingReleaseCount,
      cancelledWeek,
    ] = await Promise.all([
      orders.countDocuments({
        ...deliveryFilter,
        status: { $in: ['confirmed', 'processing', 'shipped'] },
      }),
      orders.countDocuments({
        ...deliveryFilter,
        status: 'delivered',
        updatedAt: { $gte: startOfDay },
      }),
      orders.countDocuments({
        ...deliveryFilter,
        status: 'delivered',
        updatedAt: { $gte: weekAgo },
      }),
      orders
        .aggregate([
          { $match: { ...deliveryFilter, status: 'delivered' } },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ['$total', 0] } },
              count: { $sum: 1 },
              shippingFees: { $sum: { $ifNull: ['$shippingFee', { $ifNull: ['$deliveryFee', 0] }] } },
            },
          },
        ])
        .toArray(),
      orders
        .aggregate([
          {
            $match: {
              ...deliveryFilter,
              status: 'delivered',
              updatedAt: { $gte: weekAgo },
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ['$total', 0] } },
              count: { $sum: 1 },
              shippingFees: { $sum: { $ifNull: ['$shippingFee', { $ifNull: ['$deliveryFee', 0] }] } },
            },
          },
        ])
        .toArray(),
      couriers.find({}).toArray(),
      users.find({ role: 'courier' }, { projection: { name: 1, phone: 1, createdAt: 1 } }).toArray(),
      // Courier-visible queue
      orders.countDocuments({
        ...deliveryFilter,
        readyForDelivery: true,
        status: { $in: ['confirmed', 'processing'] },
        $or: [{ courierId: null }, { courierId: { $exists: false } }],
      }),
      // Shop orders waiting admin release (vehicle + payout)
      orders.countDocuments({
        ...deliveryFilter,
        status: { $in: ['confirmed', 'processing'] },
        readyForDelivery: { $ne: true },
        manualDelivery: { $ne: true },
        $or: [{ courierId: null }, { courierId: { $exists: false } }],
      }),
      orders.countDocuments({
        ...deliveryFilter,
        status: 'cancelled',
        updatedAt: { $gte: weekAgo },
      }),
    ]);

    const allRev = revenueAgg[0] || { revenue: 0, count: 0, shippingFees: 0 };
    const weekRev = weekRevenueAgg[0] || { revenue: 0, count: 0, shippingFees: 0 };

    // Estimated last-mile profit: shipping fees collected, fallback 8% of GMV if no fee field
    const weekShipping =
      Number(weekRev.shippingFees) || Math.round(Number(weekRev.revenue) * 0.08);
    const courierPayoutEst = Math.round(weekShipping * 0.65);
    const weekProfit = weekShipping - courierPayoutEst;

    const online = courierDocs.filter((c) => c.status && c.status !== 'OFFLINE').length;
    const onDelivery = courierDocs.filter((c) => c.status === 'ON_DELIVERY').length;

    // Volume by weekday (last 7 days)
    const volumeRaw = await orders
      .aggregate([
        {
          $match: {
            ...deliveryFilter,
            status: 'delivered',
            updatedAt: { $gte: weekAgo },
          },
        },
        {
          $group: {
            _id: { $dayOfWeek: '$updatedAt' },
            count: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$total', 0] } },
          },
        },
      ])
      .toArray();

    // Mongo dayOfWeek: 1=Sun … 7=Sat → map to Mon-first bars
    const byDow: Record<number, number> = {};
    volumeRaw.forEach((r) => {
      byDow[r._id] = r.count;
    });
    const volumeBars = [2, 3, 4, 5, 6, 7, 1].map((d) => byDow[d] || 0);

    return NextResponse.json({
      kpis: {
        activeDeliveries: activeCount,
        readyQueue: readyCount,
        awaitingRelease: awaitingReleaseCount,
        deliveredToday,
        deliveredWeek,
        cancelledWeek,
        couriersTotal: Math.max(courierDocs.length, courierUsers.length),
        couriersOnline: online,
        couriersOnDelivery: onDelivery,
      },
      profit: {
        weekRevenue: Number(weekRev.revenue) || 0,
        weekOrders: Number(weekRev.count) || 0,
        weekShippingFees: weekShipping,
        weekCourierPayout: courierPayoutEst,
        weekProfit,
        allTimeRevenue: Number(allRev.revenue) || 0,
        allTimeDelivered: Number(allRev.count) || 0,
        avgOrderValue:
          Number(allRev.count) > 0
            ? Math.round(Number(allRev.revenue) / Number(allRev.count))
            : 0,
      },
      volumeBars,
    });
  } catch (error) {
    console.error('[admin/overview]', error);
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
