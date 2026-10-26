import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { formatPackageTag } from '@/lib/delivery/format';
import { resolveDropoffCoords } from '@/lib/delivery/geo';

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

const ACTIVE_STATUSES = ['confirmed', 'processing', 'shipped'];

/**
 * Admin live snapshot — couriers with GPS + active deliveries with
 * customer / package / dropoff for map monitoring.
 */
export async function GET() {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const users = await getCollection('users');
    const couriersCol = await getCollection('couriers');
    const ordersCol = await getCollection('orders');

    const [courierUsers, courierDocs, activeOrders, readyCount] = await Promise.all([
      users
        .find({ role: 'courier' }, { projection: { name: 1, phone: 1 } })
        .toArray(),
      couriersCol.find({}).toArray(),
      ordersCol
        .find({
          deliveryMethod: { $ne: 'pickup' },
          status: { $in: ACTIVE_STATUSES },
        })
        .sort({ updatedAt: -1 })
        .limit(120)
        .toArray(),
      ordersCol.countDocuments({
        deliveryMethod: { $ne: 'pickup' },
        readyForDelivery: true,
        status: { $in: ['confirmed', 'processing'] },
        $or: [{ courierId: null }, { courierId: { $exists: false } }],
      }),
    ]);

    const userById = new Map(courierUsers.map((u) => [u._id.toString(), u]));
    const courierByUser = new Map(
      courierDocs.map((c) => [c.userId?.toString?.() || String(c.userId), c])
    );

    const courierIdsNeeded = new Set<string>();
    for (const o of activeOrders) {
      if (o.courierId) courierIdsNeeded.add(String(o.courierId));
    }
    for (const doc of courierDocs) {
      const uid = doc.userId?.toString?.() || String(doc.userId);
      courierIdsNeeded.add(uid);
    }

    // Extra user docs for couriers referenced on orders but maybe not role=courier
    const missingUserIds = [...courierIdsNeeded].filter((id) => !userById.has(id) && ObjectId.isValid(id));
    if (missingUserIds.length) {
      const extra = await users
        .find(
          { _id: { $in: missingUserIds.map((id) => new ObjectId(id)) } },
          { projection: { name: 1, phone: 1 } }
        )
        .toArray();
      for (const u of extra) userById.set(u._id.toString(), u);
    }

    const deliveries = activeOrders.map((o) => {
      const id = o._id.toString();
      const shipping = (o.shipping || {}) as Record<string, unknown>;
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      const dropoff = resolveDropoffCoords(shipping);
      const courierId = o.courierId ? String(o.courierId) : null;
      const courierUser = courierId ? userById.get(courierId) : null;
      const courierDoc = courierId ? courierByUser.get(courierId) : null;

      let courierLocation: { lat: number; lng: number; updatedAt: string | null } | null = null;
      const live = o.courierLiveLocation as { lat?: number; lng?: number; updatedAt?: Date } | null;
      if (live?.lat != null && live?.lng != null) {
        courierLocation = {
          lat: Number(live.lat),
          lng: Number(live.lng),
          updatedAt: live.updatedAt ? new Date(live.updatedAt).toISOString() : null,
        };
      } else if (courierDoc?.lastLocation?.lat != null) {
        courierLocation = {
          lat: Number(courierDoc.lastLocation.lat),
          lng: Number(courierDoc.lastLocation.lng),
          updatedAt: courierDoc.lastLocation.updatedAt
            ? new Date(courierDoc.lastLocation.updatedAt).toISOString()
            : null,
        };
      }

      return {
        id,
        code: `SD-${id.slice(-5).toUpperCase()}`,
        status: o.status as string,
        total: o.total || 0,
        customerName: String(shipping.fullName || shipping.name || 'Захиалагч'),
        customerPhone: String(shipping.phone || o.phone || ''),
        dropoffText: [shipping.city, shipping.district, shipping.khoroo, shipping.address || shipping.street]
          .filter(Boolean)
          .join(', '),
        dropoff,
        courierId,
        courierName: courierUser?.name || (courierId ? 'Хүргэгч' : null),
        courierPhone: courierUser?.phone || null,
        courierStatus: courierDoc?.status || null,
        courierLocation,
        courierFlowStep: o.courierFlowStep || null,
        readyForDelivery: !!o.readyForDelivery,
        deliveryVehicleType: o.deliveryVehicleType || null,
        courierPayout: o.courierPayout ?? null,
        packageLabel: formatPackageTag(o as Record<string, unknown>),
        items: items.slice(0, 12).map((it) => ({
          name: it.name || 'Бараа',
          qty: Number(it.quantity || it.qty || 1),
          image: it.image || it.images?.[0] || null,
        })),
        itemsCount: items.length,
        adminNote: o.adminNote || null,
        updatedAt: o.updatedAt || o.createdAt || null,
      };
    });

    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
    const deliveryByCourier = new Map<string, (typeof deliveries)[0]>();
    for (const d of deliveries) {
      if (d.courierId && !deliveryByCourier.has(d.courierId)) {
        deliveryByCourier.set(d.courierId, d);
      }
    }

    const courierIds = new Set<string>([
      ...courierUsers.map((u) => u._id.toString()),
      ...courierDocs.map((c) => c.userId?.toString?.() || String(c.userId)),
    ]);

    const couriers = [...courierIds].map((uid) => {
      const user = userById.get(uid);
      const doc = courierByUser.get(uid);
      const activeOrderId = doc?.activeOrderId ? String(doc.activeOrderId) : null;
      const active =
        (activeOrderId && deliveryById.get(activeOrderId)) ||
        deliveryByCourier.get(uid) ||
        null;

      let lastLocation: { lat: number; lng: number; updatedAt: string | null } | null = null;
      if (doc?.lastLocation?.lat != null && doc?.lastLocation?.lng != null) {
        lastLocation = {
          lat: Number(doc.lastLocation.lat),
          lng: Number(doc.lastLocation.lng),
          updatedAt: doc.lastLocation.updatedAt
            ? new Date(doc.lastLocation.updatedAt).toISOString()
            : null,
        };
      }

      return {
        id: uid,
        name: user?.name || 'Хүргэгч',
        phone: user?.phone || '—',
        status: doc?.status || 'OFFLINE',
        vehicleType: doc?.vehicleType || 'motorbike',
        zone: doc?.zone || 'Улаанбаатар',
        rating: doc?.rating ?? 5,
        totalDeliveries: doc?.totalDeliveries ?? 0,
        activeOrderId: active?.id || activeOrderId,
        lastLocation,
        activeDelivery: active
          ? {
              id: active.id,
              code: active.code,
              status: active.status,
              customerName: active.customerName,
              customerPhone: active.customerPhone,
              dropoffText: active.dropoffText,
              packageLabel: active.packageLabel,
              itemsCount: active.itemsCount,
            }
          : null,
      };
    });

    const online = couriers.filter((c) => c.status !== 'OFFLINE').length;
    const onDelivery = couriers.filter((c) => c.status === 'ON_DELIVERY').length;

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      stats: {
        online,
        onDelivery,
        activeOrders: deliveries.length,
        readyQueue: readyCount,
        couriersTotal: couriers.length,
      },
      deliveries,
      couriers,
    });
  } catch (error) {
    console.error('[admin/live GET]', error);
    return NextResponse.json({ error: 'Failed to load live snapshot' }, { status: 500 });
  }
}
