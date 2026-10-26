import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { orderCourierPayout } from '@/lib/delivery/payout';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}

/**
 * GET — courier earnings breakdown (today / 7d / tips / bonus)
 */
export async function GET() {
  try {
    const { userId, role } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await getCollection('orders');
    const couriers = await getCollection('couriers');
    const courierFilter = role === 'admin' ? {} : { courierId: userId };
    const today = startOfDay();
    const week = daysAgo(7);

    const delivered = await orders
      .find({
        ...courierFilter,
        status: 'delivered',
        deliveredAt: { $gte: week },
      })
      .project({
        courierPayout: 1,
        shippingCost: 1,
        courierTip: 1,
        courierBonus: 1,
        deliveredAt: 1,
      })
      .toArray();

    let todayPayout = 0;
    let todayTip = 0;
    let todayBonus = 0;
    let weekPayout = 0;
    let weekTip = 0;
    let weekBonus = 0;
    let todayCount = 0;
    let weekCount = 0;

    for (const o of delivered) {
      const payout = orderCourierPayout(o);
      const tip = Number(o.courierTip) || 0;
      const bonus = Number(o.courierBonus) || 0;
      const at = o.deliveredAt ? new Date(o.deliveredAt) : null;
      weekPayout += payout;
      weekTip += tip;
      weekBonus += bonus;
      weekCount += 1;
      if (at && at >= today) {
        todayPayout += payout;
        todayTip += tip;
        todayBonus += bonus;
        todayCount += 1;
      }
    }

    const courierDoc =
      (await couriers.findOne({ userId: new ObjectId(userId) })) ||
      (await couriers.findOne({ userId }));

    return NextResponse.json({
      today: {
        count: todayCount,
        payout: todayPayout,
        tip: todayTip,
        bonus: todayBonus,
        total: todayPayout + todayTip + todayBonus,
      },
      week: {
        count: weekCount,
        payout: weekPayout,
        tip: weekTip,
        bonus: weekBonus,
        total: weekPayout + weekTip + weekBonus,
      },
      stats: {
        acceptanceRate: courierDoc?.acceptanceRate ?? 100,
        acceptedCount: courierDoc?.acceptedCount ?? 0,
        rejectedCount: courierDoc?.rejectedCount ?? 0,
        totalDeliveries: courierDoc?.totalDeliveries ?? 0,
        rating: courierDoc?.rating ?? 5,
      },
    });
  } catch (error) {
    console.error('[courier/earnings]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
