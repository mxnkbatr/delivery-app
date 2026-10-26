import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import {
  ARRIVAL_GEOFENCE_M,
  COMPLETE_GEOFENCE_M,
  COURIER_STEPS,
  haversineM,
  hasPreciseDropoffCoords,
  resolveDropoffCoords,
  type CourierFlowStep,
} from '@/lib/delivery/geo';

/**
 * POST — advance courier delivery step.
 * Body: { step: 'en_route' | 'arrived' | 'completing', lat?, lng? }
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
    const step = body.step as CourierFlowStep;
    if (!COURIER_STEPS.includes(step) || step === 'accepted') {
      return NextResponse.json({ error: 'Буруу алхам' }, { status: 400 });
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

    if (role === 'courier' && order.courierId !== userId) {
      return NextResponse.json({ error: 'Энэ захиалга таных биш' }, { status: 403 });
    }

    const dropoff = resolveDropoffCoords(order.shipping);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    let distanceM: number | null = null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      distanceM = Math.round(haversineM({ lat, lng }, dropoff));
    }

    if (
      (step === 'arrived' || step === 'completing') &&
      hasPreciseDropoffCoords(order.shipping)
    ) {
      const limit = step === 'arrived' ? ARRIVAL_GEOFENCE_M : COMPLETE_GEOFENCE_M;
      if (distanceM != null && distanceM > limit) {
        return NextResponse.json(
          {
            error: `Хаягнаас ${distanceM}м хол байна. ${limit}м дотор ойртоно уу.`,
            distanceM,
            geofenceM: limit,
            geofenceBlocked: true,
          },
          { status: 403 }
        );
      }
    }

    const now = new Date();
    const $set: Record<string, unknown> = {
      courierFlowStep: step,
      updatedAt: now,
    };
    if (step === 'en_route') {
      $set.courierEnRouteAt = now;
      // Going en_route means courier confirms package is in hand
      if (!order.courierPickedUpAt) {
        $set.courierPickedUpAt = now;
        $set.courierPickedUpConfirm = true;
      }
    }
    if (step === 'arrived') $set.courierArrivedAt = now;

    await orders.updateOne({ _id: orderId }, { $set });

    return NextResponse.json({
      success: true,
      step,
      distanceM,
      dropoff,
      pickedUp: step === 'en_route' || !!order.courierPickedUpAt,
      message:
        step === 'en_route'
          ? 'Бараа авсан · замд гарлаа'
          : step === 'arrived'
            ? 'Ирсэн гэж тэмдэглэлээ'
            : 'Дуусгах алхам',
    });
  } catch (error) {
    console.error('[step]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
