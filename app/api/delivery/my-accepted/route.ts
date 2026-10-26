import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import {
  estimateEtaMin,
  haversineM,
  mapsLinks,
  resolveDropoffCoords,
  DEFAULT_UB,
  type CourierFlowStep,
} from '@/lib/delivery/geo';
import {
  formatCustomerName,
  formatCustomerPhone,
  formatDropoffText,
  formatPackageTag,
} from '@/lib/delivery/format';
import { orderCourierPayout, orderCourierTotal } from '@/lib/delivery/payout';

/**
 * GET — orders this courier has accepted (not yet delivered).
 */
export async function GET() {
  try {
    const { userId, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await getCollection('orders');
    const couriers = await getCollection('couriers');

    let origin = DEFAULT_UB;
    let vehicle = 'motorbike';
    if (role === 'courier') {
      const doc =
        (await couriers.findOne({ userId: new ObjectId(userId) })) ||
        (await couriers.findOne({ userId }));
      if (doc?.lastLocation?.lat != null) {
        origin = { lat: doc.lastLocation.lat, lng: doc.lastLocation.lng };
      }
      if (doc?.vehicleType) vehicle = String(doc.vehicleType);
    }

    const results = await orders
      .find({
        $or: [
          { courierId: userId },
          ...(ObjectId.isValid(userId) ? [{ courierId: new ObjectId(userId) }] : []),
        ],
        status: { $in: ['confirmed', 'processing', 'shipped'] },
        deliveryMethod: { $ne: 'pickup' },
      })
      .sort({ courierAcceptedAt: -1, updatedAt: -1 })
      .limit(50)
      .toArray();

    const mapped = results.map((o) => {
      const id = o._id.toString();
      const shipping = (o.shipping || {}) as Record<string, unknown>;
      const dropoff = resolveDropoffCoords(shipping);
      const distanceM = Math.round(haversineM(origin, dropoff));
      const vt = (o.deliveryVehicleType as string) || vehicle;
      const etaMin = estimateEtaMin(distanceM, vt);
      const dropoffText = formatDropoffText(shipping);
      const payout = orderCourierPayout(o);
      const step = (o.courierFlowStep || 'accepted') as CourierFlowStep;

      return {
        id,
        code: `SD-${id.slice(-5).toUpperCase()}`,
        status: o.status,
        courierId: o.courierId || null,
        isMine: true,
        customerName: formatCustomerName(shipping, o.phone),
        customerPhone: formatCustomerPhone(shipping, o.phone),
        district: String(shipping.district || '').trim() || null,
        dropoffText,
        packageLabel: formatPackageTag(o),
        packageTag: formatPackageTag(o),
        courierPayout: payout > 0 ? payout : null,
        courierTip: o.courierTip ?? 0,
        courierBonus: o.courierBonus ?? 0,
        deliveryVehicleType: o.deliveryVehicleType || null,
        courierFlowStep: step,
        distanceM,
        etaMin,
        distanceLabel: 'Хүргэх хаяг хүртэл',
        maps: mapsLinks(dropoff, dropoffText),
        dropoff,
        courierAcceptedAt: o.courierAcceptedAt || null,
        deliveryOtpRequestedAt: o.deliveryOtpRequestedAt || null,
        hasOtp: !!(o.deliveryOtp && /^\d{4}$/.test(String(o.deliveryOtp))),
        createdAt: o.createdAt,
      };
    });

    const payoutSum = mapped.reduce((s, o) => s + orderCourierTotal(o), 0);

    return NextResponse.json({
      orders: mapped,
      summary: {
        count: mapped.length,
        payoutSum,
        nextEtaMin: mapped.length
          ? Math.min(...mapped.map((o) => o.etaMin || 999))
          : null,
      },
      origin,
    });
  } catch (error) {
    console.error('[my-accepted]', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
