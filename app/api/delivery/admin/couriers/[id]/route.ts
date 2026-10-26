import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { orderCourierTotal, orderCourierPayout } from '@/lib/delivery/payout';
import { formatDropoffText, formatCustomerName } from '@/lib/delivery/format';
import { VEHICLE_MN, type DeliveryVehicleType } from '@/lib/delivery/vehicles';
import { STEP_MN, type CourierFlowStep } from '@/lib/delivery/geo';

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? 6 : day - 1; // Monday start
  x.setDate(x.getDate() - diff);
  return x;
}

/**
 * GET — admin courier profile + earnings + delivery history
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const { id } = await context.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
    }

    const users = await getCollection('users');
    const couriers = await getCollection('couriers');
    const orders = await getCollection('orders');

    const userOid = new ObjectId(id);
    const user =
      (await users.findOne({ _id: userOid })) ||
      (await users.findOne({ _id: id as any }));

    const courierDoc =
      (await couriers.findOne({ userId: userOid })) ||
      (await couriers.findOne({ userId: id }));

    if (!user && !courierDoc) {
      return NextResponse.json({ error: 'Хүргэгч олдсонгүй' }, { status: 404 });
    }

    const courierUserId = user?._id?.toString?.() || id;

    // Match courierId stored as string or ObjectId
    const deliveredOrders = await orders
      .find({
        status: 'delivered',
        $or: [
          { courierId: courierUserId },
          ...(ObjectId.isValid(courierUserId)
            ? [{ courierId: new ObjectId(courierUserId) }]
            : []),
        ],
      })
      .sort({ deliveredAt: -1 })
      .limit(200)
      .toArray();

    const activeOrders = await orders
      .find({
        status: { $in: ['confirmed', 'processing', 'shipped'] },
        $or: [
          { courierId: courierUserId },
          ...(ObjectId.isValid(courierUserId)
            ? [{ courierId: new ObjectId(courierUserId) }]
            : []),
        ],
      })
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray();

    const day0 = startOfDay();
    const week0 = startOfWeek();

    let totalEarned = 0;
    let totalTips = 0;
    let totalBonus = 0;
    let totalBase = 0;
    let earnedToday = 0;
    let earnedWeek = 0;
    let deliveredToday = 0;
    let deliveredWeek = 0;

    for (const o of deliveredOrders) {
      const base = orderCourierPayout(o as any);
      const tip = Math.max(0, Math.round(Number(o.courierTip) || 0));
      const bonus = Math.max(0, Math.round(Number(o.courierBonus) || 0));
      const total = base + tip + bonus;
      totalBase += base;
      totalTips += tip;
      totalBonus += bonus;
      totalEarned += total;

      const at = o.deliveredAt ? new Date(o.deliveredAt) : null;
      if (at && at >= day0) {
        deliveredToday += 1;
        earnedToday += total;
      }
      if (at && at >= week0) {
        deliveredWeek += 1;
        earnedWeek += total;
      }
    }

    // Prefer live order sums; fall back to courier counters if no order history
    const docEarnings = Number(courierDoc?.totalEarnings) || 0;
    if (deliveredOrders.length === 0 && docEarnings > 0) {
      totalEarned = docEarnings;
      totalTips = Number(courierDoc?.totalTips) || 0;
      totalBonus = Number(courierDoc?.totalBonus) || 0;
      totalBase = Math.max(0, totalEarned - totalTips - totalBonus);
    }

    const vehicleType = (courierDoc?.vehicleType || 'motorbike') as DeliveryVehicleType;

    const recent = deliveredOrders.slice(0, 30).map((o) => ({
      id: o._id.toString(),
      code: `SD-${o._id.toString().slice(-5).toUpperCase()}`,
      status: o.status,
      total: Number(o.total) || 0,
      payout: orderCourierTotal(o as any),
      basePayout: orderCourierPayout(o as any),
      tip: Math.max(0, Math.round(Number(o.courierTip) || 0)),
      bonus: Math.max(0, Math.round(Number(o.courierBonus) || 0)),
      customerName: formatCustomerName(o.shipping || {}, o.phone),
      dropoffText: formatDropoffText(o.shipping || {}),
      deliveredAt: o.deliveredAt || null,
      adminForceComplete: !!o.deliveryProof?.adminForceComplete,
    }));

    const active = activeOrders.map((o) => ({
      id: o._id.toString(),
      code: `SD-${o._id.toString().slice(-5).toUpperCase()}`,
      status: o.status,
      payout: orderCourierTotal(o as any),
      customerName: formatCustomerName(o.shipping || {}, o.phone),
      dropoffText: formatDropoffText(o.shipping || {}),
      flowStep: o.courierFlowStep
        ? STEP_MN[o.courierFlowStep as CourierFlowStep] || o.courierFlowStep
        : null,
    }));

    return NextResponse.json({
      courier: {
        id: courierUserId,
        name: user?.name || 'Хүргэгч',
        phone: user?.phone || '—',
        role: user?.role || 'courier',
        status: courierDoc?.status || 'OFFLINE',
        vehicleType,
        vehicleLabel: VEHICLE_MN[vehicleType] || vehicleType,
        zone: courierDoc?.zone || 'Улаанбаатар',
        rating: courierDoc?.rating ?? 5,
        createdAt: user?.createdAt || courierDoc?.createdAt || null,
        lastLocation:
          courierDoc?.lastLocation?.lat != null
            ? {
                lat: Number(courierDoc.lastLocation.lat),
                lng: Number(courierDoc.lastLocation.lng),
                updatedAt: courierDoc.lastLocation.updatedAt || null,
              }
            : null,
      },
      stats: {
        totalDeliveries:
          deliveredOrders.length || Number(courierDoc?.totalDeliveries) || 0,
        deliveredToday,
        deliveredWeek,
        activeCount: activeOrders.length,
        rating: courierDoc?.rating ?? 5,
      },
      earnings: {
        totalEarned,
        totalBase,
        totalTips,
        totalBonus,
        earnedToday,
        earnedWeek,
        /** Still on the road — expected if completed */
        pendingOnRoad: activeOrders.reduce(
          (sum, o) => sum + orderCourierTotal(o as any),
          0
        ),
      },
      active,
      recent,
    });
  } catch (error) {
    console.error('[admin/couriers/:id GET]', error);
    return NextResponse.json({ error: 'Failed to load courier' }, { status: 500 });
  }
}
