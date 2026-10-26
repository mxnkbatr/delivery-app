import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

function mapOrder(o: Record<string, unknown>) {
  const id = (o._id as { toString: () => string }).toString();
  const shipping = (o.shipping || {}) as Record<string, string>;
  const items = Array.isArray(o.items) ? (o.items as any[]) : [];
  return {
    id,
    code: `SD-${id.slice(-5).toUpperCase()}`,
    status: o.status,
    total: o.total || 0,
    customerName: shipping.fullName || shipping.name || 'Захиалагч',
    customerPhone: shipping.phone || o.phone || '',
    dropoffText: [shipping.city, shipping.district, shipping.khoroo, shipping.address || shipping.street]
      .filter(Boolean)
      .join(', '),
    itemsCount: items.length,
    items: items.slice(0, 8).map((it) => ({
      name: it.name || 'Бараа',
      qty: it.quantity || it.qty || 1,
      image: it.image || it.images?.[0] || null,
    })),
    paidAt: o.paidAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    deliveryOtp: o.deliveryOtp || null,
    readyForDelivery: !!o.readyForDelivery,
    courierId: o.courierId || null,
    deliveryVehicleType: o.deliveryVehicleType || null,
    courierPayout: o.courierPayout ?? null,
    shippingCost: o.shippingCost ?? null,
    manualDelivery: !!o.manualDelivery,
    adminNote: o.adminNote || null,
    awaitingDeliveryRelease: !!o.awaitingDeliveryRelease,
    orderSource: o.orderSource || (o.manualDelivery ? 'manual' : 'shop'),
  };
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Number(searchParams.get('limit') || 80), 200);

    const orders = await getCollection('orders');
    const filter: Record<string, unknown> = {
      deliveryMethod: { $ne: 'pickup' },
    };
    if (status && status !== 'all') {
      filter.status = status;
    } else {
      filter.status = {
        $in: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'pending'],
      };
    }

    const results = await orders.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();

    return NextResponse.json({ orders: results.map(mapOrder) });
  } catch (error) {
    console.error('[admin/orders]', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
