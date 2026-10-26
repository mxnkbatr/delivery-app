import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { isValidOtpFormat } from '@/lib/delivery/otp';
import { notifyOrderStatusUpdate } from '@/lib/orderNotifications';
import {
  COMPLETE_GEOFENCE_M,
  haversineM,
  hasPreciseDropoffCoords,
  resolveDropoffCoords,
} from '@/lib/delivery/geo';
import { orderCourierPayout } from '@/lib/delivery/payout';

/**
 * POST — complete delivery with OTP (+ optional geofence + POD).
 * Body: { otp, lat?, lng?, skipGeofence?: boolean }
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
    const otp = body?.otp;

    if (!isValidOtpFormat(otp)) {
      return NextResponse.json({ error: '4 оронтой код оруулна уу' }, { status: 400 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const order = await orders.findOne({ _id: orderId });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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

    if (role === 'courier' && order.courierId && order.courierId !== userId) {
      return NextResponse.json({ error: 'Энэ захиалга таных биш' }, { status: 403 });
    }

    if (!order.deliveryOtp) {
      return NextResponse.json(
        { error: 'Эхлээд «Хүргэлт дуусгах» дарж хэрэглэгчид код илгээнэ үү' },
        { status: 400 }
      );
    }

    if (String(order.deliveryOtp) !== otp) {
      return NextResponse.json(
        { error: 'Код буруу байна. Захиалагчаас дахин шалгана уу.' },
        { status: 403 }
      );
    }

    // Geofence only when order has real dropoff GPS (not district fallback)
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    let distanceM: number | null = null;
    const enforceGeo =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !body.skipGeofence &&
      hasPreciseDropoffCoords(order.shipping);
    if (enforceGeo) {
      const dropoff = resolveDropoffCoords(order.shipping);
      distanceM = Math.round(haversineM({ lat, lng }, dropoff));
      if (distanceM > COMPLETE_GEOFENCE_M) {
        return NextResponse.json(
          {
            error: `Хаягнаас ${distanceM}м хол. ${COMPLETE_GEOFENCE_M}м дотор ойртож дахин оролдоно уу.`,
            distanceM,
            geofenceM: COMPLETE_GEOFENCE_M,
            geofenceBlocked: true,
          },
          { status: 403 }
        );
      }
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const dropoff = resolveDropoffCoords(order.shipping);
      distanceM = Math.round(haversineM({ lat, lng }, dropoff));
    }

    if (order.courierFlowStep === 'accepted' || order.courierFlowStep === 'en_route') {
      // Soft requirement: prefer arrived first, but allow complete if OTP correct + near
    }

    const now = new Date();
    const existingProof = order.deliveryProof || {};
    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          status: 'delivered',
          deliveredAt: now,
          courierFlowStep: 'completing',
          deliveryProof: {
            ...existingProof,
            otpVerified: true,
            verifiedBy: userId,
            timestamp: now,
            distanceM,
          },
          updatedAt: now,
        },
        $unset: { deliveryOtp: '', deliveryOtpRequestedAt: '', deliveryOtpRequestedBy: '' },
      }
    );

    const payout = orderCourierPayout(order);
    const tip = Number(order.courierTip) || 0;
    const bonus = Number(order.courierBonus) || 0;
    const earn = payout + tip + bonus;

    // Always credit the assigned courier (not the admin who may complete)
    const courierUserId =
      order.courierId != null && String(order.courierId).length > 0
        ? String(order.courierId)
        : role === 'courier'
          ? String(userId)
          : null;

    if (courierUserId) {
      const couriers = await getCollection('couriers');

      // Keep ON_DELIVERY if batch siblings still active
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

    notifyOrderStatusUpdate(id, 'delivered').catch(() => {});

    return NextResponse.json({
      success: true,
      status: 'delivered',
      distanceM,
      earned: earn,
      message: 'Хүргэлт амжилттай баталгаажлаа',
    });
  } catch (error) {
    console.error('[delivery deliver]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
