import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { getCourierVehicleType } from '@/lib/courierNotifications';
import {
  estimateEtaMin,
  haversineM,
  mapsLinks,
  resolveDropoffCoords,
  DEFAULT_UB,
} from '@/lib/delivery/geo';
import {
  formatCustomerName,
  formatCustomerPhone,
  formatDropoffText,
  formatPackageTag,
} from '@/lib/delivery/format';
import { orderCourierPayout } from '@/lib/delivery/payout';

const READY_STATUSES = ['confirmed', 'processing'];
const BATCH_RADIUS_M = 1800;

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
    const results = await orders
      .find({
        readyForDelivery: true,
        status: { $in: READY_STATUSES },
        deliveryMethod: { $ne: 'pickup' },
        $and: [
          {
            $or: [{ courierId: { $exists: false } }, { courierId: null }, { courierId: '' }],
          },
          // Private mock/demo offers: only the target courier sees them
          {
            $or: [
              { exclusiveCourierId: { $exists: false } },
              { exclusiveCourierId: null },
              { exclusiveCourierId: '' },
              ...(role === 'courier' || role === 'admin'
                ? [{ exclusiveCourierId: userId }]
                : []),
            ],
          },
        ],
      })
      .sort({ readyForDeliveryAt: -1, createdAt: -1 })
      .limit(80)
      .toArray();

    let vehicle = 'motorbike';
    let origin = DEFAULT_UB;
    if (role === 'courier') {
      vehicle = await getCourierVehicleType(userId);
      const doc =
        (await couriers.findOne({ userId: new ObjectId(userId) })) ||
        (await couriers.findOne({ userId }));
      if (doc?.lastLocation?.lat != null) {
        origin = { lat: doc.lastLocation.lat, lng: doc.lastLocation.lng };
      }
    }

    let filtered = results;
    if (role === 'courier') {
      // Hide exclusive offers belonging to someone else
      filtered = filtered.filter((o) => {
        const ex = o.exclusiveCourierId;
        if (!ex) return true;
        return String(ex) === String(userId);
      });
      filtered = filtered.filter((o) => {
        const vt = o.deliveryVehicleType;
        if (!vt) return true;
        return vt === vehicle;
      });
      filtered = filtered.filter((o) => {
        const rej = Array.isArray(o.courierRejections) ? o.courierRejections : [];
        return !rej.some((r: any) => String(r.courierId) === String(userId));
      });
    }

    const enriched = filtered.slice(0, 50).map((o) => {
      const dropoff = resolveDropoffCoords(o.shipping);
      const distanceM = Math.round(haversineM(origin, dropoff));
      const etaMin = estimateEtaMin(distanceM, o.deliveryVehicleType || vehicle);
      const dropoffText = formatDropoffText(o.shipping);
      const payout = orderCourierPayout(o);
      return {
        id: o._id.toString(),
        code: `SD-${o._id.toString().slice(-5).toUpperCase()}`,
        status: o.status,
        customerName: formatCustomerName(o.shipping, o.phone),
        customerPhone: formatCustomerPhone(o.shipping, o.phone),
        district: String(o.shipping?.district || '').trim() || null,
        dropoffText,
        packageLabel: formatPackageTag(o),
        packageTag: formatPackageTag(o),
        courierPayout: payout > 0 ? payout : null,
        courierTip: o.courierTip ?? 0,
        courierBonus: o.courierBonus ?? 0,
        deliveryVehicleType: o.deliveryVehicleType || null,
        distanceM,
        etaMin,
        distanceLabel: 'Таны байршлаас',
        maps: mapsLinks(dropoff, dropoffText),
        dropoff,
        batchId: o.batchId || null,
        createdAt: o.createdAt,
        readyForDeliveryAt: o.readyForDeliveryAt || null,
      };
    });

    for (let i = 0; i < enriched.length; i++) {
      const a = enriched[i];
      let best: { id: string; distanceM: number } | null = null;
      for (let j = 0; j < enriched.length; j++) {
        if (i === j) continue;
        const b = enriched[j];
        const d = Math.round(haversineM(a.dropoff, b.dropoff));
        if (d <= BATCH_RADIUS_M && (!best || d < best.distanceM)) {
          best = { id: b.id, distanceM: d };
        }
      }
      (a as any).batchSiblingId = best?.id || null;
      (a as any).batchSiblingDistanceM = best?.distanceM ?? null;
    }

    return NextResponse.json({
      orders: enriched,
      origin,
    });
  } catch (error) {
    console.error('[ready-orders]', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
