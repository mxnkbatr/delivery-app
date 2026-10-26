import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { REJECT_REASONS } from '@/lib/delivery/geo';

/**
 * POST — courier rejects a ready offer.
 * Body: { reason: string }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || 'other');
    const valid = REJECT_REASONS.some((r) => r.id === reason);
    if (!valid) {
      return NextResponse.json({ error: 'Шалтгаан буруу' }, { status: 400 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const order = await orders.findOne({ _id: orderId });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (order.courierId && order.courierId !== userId) {
      return NextResponse.json({ error: 'Өөр хүргэгч авсан' }, { status: 409 });
    }

    const now = new Date();
    await orders.updateOne(
      { _id: orderId },
      {
        $push: {
          courierRejections: {
            courierId: userId,
            reason,
            at: now,
          },
        } as any,
        $set: { updatedAt: now },
      }
    );

    const couriers = await getCollection('couriers');
    const filterOid = { userId: new ObjectId(userId) };
    const filterStr = { userId };
    const update = {
      $inc: { rejectedCount: 1 },
      $set: { updatedAt: now },
    };
    let r = await couriers.updateOne(filterOid, update);
    if (r.matchedCount === 0) await couriers.updateOne(filterStr, update);

    // Recalc acceptance rate
    const doc =
      (await couriers.findOne(filterOid)) || (await couriers.findOne(filterStr));
    if (doc) {
      const accepted = Number(doc.acceptedCount) || 0;
      const rejected = Number(doc.rejectedCount) || 0;
      const total = accepted + rejected;
      const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 100;
      await couriers.updateOne(
        { _id: doc._id },
        { $set: { acceptanceRate, updatedAt: now } }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Татгалзлаа',
      reason,
    });
  } catch (error) {
    console.error('[reject]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
