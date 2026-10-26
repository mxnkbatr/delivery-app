import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { notifyOrderStatusUpdate } from '@/lib/orderNotifications';
import { orderCourierPayout } from '@/lib/delivery/payout';

/**
 * POST — admin force-completes a delivery without OTP / geofence.
 * Use when courier cannot get customer PIN (lost phone, offline, etc.).
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Зөвхөн админ дуусгаж болно' }, { status: 403 });
    }

    const { id } = await context.params;
    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const order = await orders.findOne({ _id: orderId });
    if (!order) {
      return NextResponse.json({ error: 'Захиалга олдсонгүй' }, { status: 404 });
    }

    if (order.status === 'delivered') {
      return NextResponse.json(
        { error: 'Хүргэлт аль хэдийн дууссан', alreadyDelivered: true },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Захиалга цуцлагдсан' }, { status: 400 });
    }

    if (order.deliveryMethod === 'pickup') {
      return NextResponse.json({ error: 'Pickup захиалгыг энд дуусгахгүй' }, { status: 400 });
    }

    const now = new Date();
    const existingProof = order.deliveryProof || {};
    const courierUserId = order.courierId ? String(order.courierId) : null;

    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          status: 'delivered',
          deliveredAt: now,
          courierFlowStep: 'completing',
          deliveryProof: {
            ...existingProof,
            otpVerified: false,
            adminForceComplete: true,
            verifiedBy: userId,
            completedByRole: 'admin',
            timestamp: now,
          },
          updatedAt: now,
        },
        $unset: {
          deliveryOtp: '',
          deliveryOtpRequestedAt: '',
          deliveryOtpRequestedBy: '',
        },
      }
    );

    if (courierUserId) {
      const payout = orderCourierPayout(order);
      const tip = Number(order.courierTip) || 0;
      const bonus = Number(order.courierBonus) || 0;
      const earn = payout + tip + bonus;

      const remaining = await orders.countDocuments({
        courierId: courierUserId,
        status: { $in: ['confirmed', 'processing', 'shipped'] },
        _id: { $ne: orderId },
      });

      const nextActive =
        remaining > 0
          ? await orders.findOne(
              {
                courierId: courierUserId,
                status: { $in: ['confirmed', 'processing', 'shipped'] },
                _id: { $ne: orderId },
              },
              { sort: { courierAcceptedAt: 1 } }
            )
          : null;

      const courierUpdate =
        remaining > 0
          ? {
              $set: {
                status: 'ON_DELIVERY',
                activeOrderId: nextActive?._id || null,
                updatedAt: now,
              },
              $inc: {
                totalDeliveries: 1,
                totalEarnings: earn,
                totalTips: tip,
                totalBonus: bonus,
              },
            }
          : {
              $set: {
                status: 'ONLINE',
                activeOrderId: null,
                batchOrderIds: [],
                updatedAt: now,
              },
              $inc: {
                totalDeliveries: 1,
                totalEarnings: earn,
                totalTips: tip,
                totalBonus: bonus,
              },
            };

      const couriers = await getCollection('couriers');
      let ur = { matchedCount: 0 };
      if (ObjectId.isValid(courierUserId)) {
        ur = await couriers.updateOne(
          { userId: new ObjectId(courierUserId) },
          courierUpdate
        );
      }
      if (ur.matchedCount === 0) {
        await couriers.updateOne({ userId: courierUserId }, courierUpdate);
      }
    }

    // Audit notification for ops trail
    try {
      const notifications = await getCollection('notifications');
      await notifications.insertOne({
        userId,
        title: 'Админ хүргэлт дуусгалаа',
        message: `${order.orderNumber || order.code || id} · PIN кодгүйгээр`,
        type: 'admin_force_complete',
        isRead: false,
        link: `/delivery/admin/live`,
        orderId: id,
        createdAt: now,
      });
    } catch {
      /* ignore */
    }

    notifyOrderStatusUpdate(id, 'delivered').catch(() => {});

    // Notify assigned courier so their active screen can leave
    if (courierUserId) {
      try {
        const { sendPushToUser } = await import('@/lib/fcm');
        void sendPushToUser({
          userId: courierUserId,
          title: 'Хүргэлт дууссан',
          body: `${order.orderNumber || order.code || 'Захиалга'} · админ PIN-гүйгээр баталгаажууллаа`,
          data: {
            url: '/work',
            type: 'admin_force_complete',
            orderId: id,
          },
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      success: true,
      status: 'delivered',
      adminForceComplete: true,
      message: 'Админ хүргэлтийг PIN кодгүйгээр дуусгалаа',
    });
  } catch (error) {
    console.error('[admin force-complete]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
