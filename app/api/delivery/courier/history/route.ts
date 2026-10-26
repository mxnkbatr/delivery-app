import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { formatCustomerName, formatDropoffText } from '@/lib/delivery/format';
import { orderCourierPayout } from '@/lib/delivery/payout';

/**
 * GET — courier delivery history (delivered + cancelled)
 */
export async function GET(request: Request) {
  try {
    const { userId, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 40), 100);

    const orders = await getCollection('orders');
    const filter: Record<string, unknown> = {
      deliveryMethod: { $ne: 'pickup' },
      status: { $in: ['delivered', 'cancelled'] },
    };
    if (role === 'courier') {
      filter.courierId = userId;
    }

    const results = await orders
      .find(filter)
      .sort({ deliveredAt: -1, updatedAt: -1 })
      .limit(limit)
      .toArray();

    const mapped = results.map((o) => {
      const id = o._id.toString();
      const shipping = o.shipping || {};
      const payout = orderCourierPayout(o);
      return {
        id,
        code: `SD-${id.slice(-5).toUpperCase()}`,
        status: o.status,
        customerName: formatCustomerName(shipping, o.phone),
        dropoffText: formatDropoffText(shipping),
        courierPayout: payout > 0 ? payout : null,
        deliveredAt: o.deliveredAt || null,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    const earnings = mapped
      .filter((o) => o.status === 'delivered')
      .reduce((s, o) => s + (Number(o.courierPayout) || 0), 0);

    return NextResponse.json({
      orders: mapped,
      summary: {
        count: mapped.filter((o) => o.status === 'delivered').length,
        earnings,
      },
    });
  } catch (error) {
    console.error('[courier/history]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
