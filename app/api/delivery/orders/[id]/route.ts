import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import {
  COMPLETE_GEOFENCE_M,
  mapsLinks,
  resolveDropoffCoords,
  hasPreciseDropoffCoords,
} from '@/lib/delivery/geo';
import {
  formatCustomerName,
  formatCustomerPhone,
  formatDropoffText,
  formatPackageTag,
  buildPackageSafeInfo,
} from '@/lib/delivery/format';
import { orderCourierPayout } from '@/lib/delivery/payout';

/**
 * GET — single order detail for courier (or admin).
 * Couriers never receive product names, images, or shop line items.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role: tokenRole } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let role = tokenRole;
    if (role !== 'courier' && role !== 'admin') {
      try {
        const users = await getCollection('users');
        const u =
          (await users.findOne({ _id: new ObjectId(userId) })) ||
          (await users.findOne({ _id: userId as any }));
        role = (u?.role as string) || null;
      } catch {
        role = null;
      }
    }
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Буруу захиалгын ID' }, { status: 400 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Буруу захиалгын ID' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const o = await orders.findOne({ _id: orderId });
    if (!o) {
      return NextResponse.json({ error: 'Захиалга олдсонгүй' }, { status: 404 });
    }

    const shipping = o.shipping || {};
    const dropoff = resolveDropoffCoords(shipping);
    const dropoffText = formatDropoffText(shipping);
    const payout = orderCourierPayout(o);

    let isAvailable =
      !!o.readyForDelivery &&
      !o.courierId &&
      ['confirmed', 'processing'].includes(o.status);

    if (isAvailable && o.exclusiveCourierId && String(o.exclusiveCourierId) !== String(userId)) {
      isAvailable = false;
    }

    if (isAvailable && role === 'courier' && o.deliveryVehicleType) {
      const { getCourierVehicleType } = await import('@/lib/courierNotifications');
      const myVehicle = await getCourierVehicleType(userId);
      if (myVehicle !== o.deliveryVehicleType) {
        isAvailable = false;
      }
    }

    if (isAvailable && role === 'courier') {
      const rej = Array.isArray(o.courierRejections) ? o.courierRejections : [];
      if (rej.some((r: any) => String(r.courierId) === String(userId))) isAvailable = false;
    }

    const isMine = String(o.courierId || '') === String(userId);

    let packageInfo;
    let packageLabel: string;
    try {
      packageInfo = buildPackageSafeInfo(o);
      packageLabel = formatPackageTag(o);
    } catch {
      packageInfo = undefined;
      packageLabel = 'Хүргэх багц';
    }

    const base = {
      id: o._id.toString(),
      code: `SD-${o._id.toString().slice(-5).toUpperCase()}`,
      status: o.status,
      courierId: o.courierId ? String(o.courierId) : null,
      isMine,
      isAvailable,
      customerName: formatCustomerName(shipping, o.phone),
      customerPhone: formatCustomerPhone(shipping, o.phone),
      dropoffText,
      dropoff,
      maps: mapsLinks(dropoff, dropoffText),
      geofenceM: COMPLETE_GEOFENCE_M,
      preciseDropoff: hasPreciseDropoffCoords(shipping),
      packageLabel,
      packageTag: packageLabel,
      packageInfo,
      courierPayout: payout > 0 ? payout : null,
      courierTip: o.courierTip ?? 0,
      courierBonus: o.courierBonus ?? 0,
      deliveryVehicleType: o.deliveryVehicleType || null,
      courierAcceptedAt: o.courierAcceptedAt || null,
      courierPickedUpAt: o.courierPickedUpAt || null,
      courierEnRouteAt: o.courierEnRouteAt || null,
      courierArrivedAt: o.courierArrivedAt || null,
      courierFlowStep: o.courierFlowStep || (o.courierId ? 'accepted' : null),
      batchOrderIds: Array.isArray(o.batchOrderIds) ? o.batchOrderIds : [],
      deliveryOtpRequestedAt: o.deliveryOtpRequestedAt || null,
      hasOtp: !!(o.deliveryOtp && /^\d{4}$/.test(String(o.deliveryOtp))),
      hasPod: !!(o.deliveryProof?.photoUrl),
      createdAt: o.createdAt,
      readyForDeliveryAt: o.readyForDeliveryAt || null,
      manualDelivery: !!o.manualDelivery,
    };

    if (role === 'admin') {
      return NextResponse.json({
        order: {
          ...base,
          total: o.total,
          adminNote: o.adminNote || null,
          items: (o.items || []).map((it: any) => ({
            name: it.name || 'Бараа',
            qty: it.quantity || it.qty || 1,
            image: it.image || it.images?.[0] || null,
            price: it.price ?? it.finalPrice ?? null,
          })),
        },
      });
    }

    return NextResponse.json({ order: base });
  } catch (error) {
    console.error('[delivery order GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
