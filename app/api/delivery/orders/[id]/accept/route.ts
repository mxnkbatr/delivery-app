import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { claimOrdersAtomic } from '@/lib/delivery/claimOrder';
import { notifyOrderStatusUpdate } from '@/lib/orderNotifications';

/**
 * POST — courier accepts / claims a ready order (optionally with batch siblings).
 * Body: { batchIds?: string[] }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const batchIds: string[] = Array.isArray(body.batchIds) ? body.batchIds : [];

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const couriers = await getCollection('couriers');
    const order = await orders.findOne({ _id: orderId });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.deliveryMethod === 'pickup') {
      return NextResponse.json({ error: 'Pickup захиалга' }, { status: 400 });
    }

    if (!order.readyForDelivery) {
      return NextResponse.json(
        { error: 'Админ хүргэлтэд гаргаагүй захиалга' },
        { status: 400 }
      );
    }

    if (
      order.exclusiveCourierId &&
      String(order.exclusiveCourierId) !== String(userId) &&
      role === 'courier'
    ) {
      return NextResponse.json({ error: 'Энэ захиалга танд зориулагдаагүй' }, { status: 403 });
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      return NextResponse.json({ error: 'Энэ захиалгыг авах боломжгүй' }, { status: 400 });
    }

    if (order.courierId && String(order.courierId) !== String(userId)) {
      return NextResponse.json(
        { error: 'Өөр хүргэгч аль хэдийн авсан байна' },
        { status: 409 }
      );
    }

    if (String(order.courierId) === String(userId)) {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        orderId: id,
        status: order.status,
        step: order.courierFlowStep || 'accepted',
      });
    }

    const courierDoc =
      (await couriers.findOne({ userId: new ObjectId(userId) })) ||
      (await couriers.findOne({ userId }));

    if (role === 'courier' && order.deliveryVehicleType) {
      const myVehicle = courierDoc?.vehicleType || 'motorbike';
      if (myVehicle !== order.deliveryVehicleType) {
        return NextResponse.json(
          { error: 'Энэ захиалга таны тээврийн төрөлд хамаарахгүй' },
          { status: 403 }
        );
      }
    }

    const now = new Date();
    const claimIds = [orderId];
    for (const bid of batchIds.slice(0, 2)) {
      if (bid === id || !ObjectId.isValid(bid)) continue;
      claimIds.push(new ObjectId(bid));
    }

    const claimedStr = await claimOrdersAtomic(orders, claimIds, userId, now);

    if (claimedStr.length === 0) {
      return NextResponse.json(
        { error: 'Өөр хүргэгч аль хэдийн авсан эсвэл авах боломжгүй' },
        { status: 409 }
      );
    }

    const acceptedInc = claimedStr.length;
    const prevAccepted = Number(courierDoc?.acceptedCount) || 0;
    const prevRejected = Number(courierDoc?.rejectedCount) || 0;
    const newAccepted = prevAccepted + acceptedInc;
    const total = newAccepted + prevRejected;
    const acceptanceRate = total > 0 ? Math.round((newAccepted / total) * 100) : 100;

    const courierUpdate = {
      $set: {
        status: 'ON_DELIVERY',
        activeOrderId: orderId,
        batchOrderIds: claimedStr,
        acceptanceRate,
        updatedAt: now,
      },
      $inc: { acceptedCount: acceptedInc },
    };
    let ur = await couriers.updateOne({ userId: new ObjectId(userId) }, courierUpdate);
    if (ur.matchedCount === 0) {
      await couriers.updateOne({ userId }, courierUpdate);
    }

    for (const cid of claimedStr) {
      notifyOrderStatusUpdate(cid, 'shipped').catch(() => {});
    }

    return NextResponse.json({
      success: true,
      orderId: id,
      claimedIds: claimedStr,
      status: 'shipped',
      step: 'accepted',
      message:
        claimedStr.length > 1
          ? `${claimedStr.length} захиалга (batch) хүлээн авлаа`
          : 'Захиалга хүлээн авлаа',
    });
  } catch (error) {
    console.error('[delivery accept]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
