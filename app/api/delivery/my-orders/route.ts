import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { STEP_MN, type CourierFlowStep } from '@/lib/delivery/geo';
import { VEHICLE_MN } from '@/lib/delivery/vehicles';

/**
 * Customer's paid/confirmed shop orders for Delivery app.
 * Includes assigned courier (name, phone, vehicle, flow step) for tracking/chat.
 */
const CONFIRMED = ['confirmed', 'processing', 'shipped', 'delivered'];
const ACTIVE = ['confirmed', 'processing', 'shipped'];

function customerStatusLabel(o: Record<string, unknown>) {
  const status = String(o.status || '');
  if (status === 'delivered') return 'Хүргэгдсэн';
  if (status === 'cancelled') return 'Цуцлагдсан';
  if (!o.courierId) {
    if (status === 'processing' || status === 'confirmed') return 'Хүргэгч хүлээж байна';
    return 'Бэлтгэж байна';
  }
  const step = (o.courierFlowStep || 'accepted') as CourierFlowStep;
  if (step === 'en_route') return 'Хүргэгч замд';
  if (step === 'arrived' || step === 'completing') return 'Хүргэгч ойрхон';
  if (o.courierPickedUpAt) return 'Бараа авсан · гарах гэж';
  return 'Хүргэгч томилогдсон';
}

export async function GET() {
  try {
    const { userId, phone, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role === 'courier') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await getCollection('orders');
    const query = phone
      ? { $or: [{ userId }, { phone, userId: 'guest' }] }
      : { userId };

    const results = await orders.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    const courierIds = [
      ...new Set(
        results
          .map((o) => o.courierId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];

    const users = await getCollection('users');
    const couriersCol = await getCollection('couriers');
    const courierMap = new Map<
      string,
      { name: string; phone: string; vehicleType: string | null }
    >();

    if (courierIds.length > 0) {
      const oids = courierIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
      if (oids.length > 0) {
        const courierUsers = await users
          .find({ _id: { $in: oids } }, { projection: { name: 1, phone: 1 } })
          .toArray();
        for (const u of courierUsers) {
          courierMap.set(u._id.toString(), {
            name: u.name || 'Хүргэгч',
            phone: u.phone || '',
            vehicleType: null,
          });
        }
      }

      const courierDocs = await couriersCol
        .find({
          $or: [
            { userId: { $in: courierIds } },
            ...(oids.length
              ? [{ userId: { $in: oids } }]
              : []),
          ],
        })
        .project({ userId: 1, vehicleType: 1, name: 1, phone: 1 })
        .toArray();

      for (const c of courierDocs) {
        const id = String(c.userId?.toString?.() || c.userId || '');
        if (!id) continue;
        const prev = courierMap.get(id) || { name: 'Хүргэгч', phone: '', vehicleType: null };
        courierMap.set(id, {
          name: c.name || prev.name,
          phone: c.phone || prev.phone,
          vehicleType: c.vehicleType || prev.vehicleType,
        });
      }
    }

    const confirmed = [];
    for (const o of results) {
      const isConfirmed =
        CONFIRMED.includes(o.status) || !!o.paidAt || o.paymentStatus === 'paid';
      if (!isConfirmed || o.deliveryMethod === 'pickup') continue;

      let deliveryOtp: string | null = null;
      if (ACTIVE.includes(o.status) && o.deliveryOtp && /^\d{4}$/.test(String(o.deliveryOtp))) {
        deliveryOtp = String(o.deliveryOtp);
      }

      const courierDoc = o.courierId ? courierMap.get(String(o.courierId)) : null;
      const vehicle =
        (o.deliveryVehicleType as string) || courierDoc?.vehicleType || null;
      const step = (o.courierFlowStep || (o.courierId ? 'accepted' : null)) as
        | CourierFlowStep
        | null;

      const courier = courierDoc
        ? {
            id: String(o.courierId),
            name: courierDoc.name,
            phone: courierDoc.phone,
            vehicleType: vehicle,
            vehicleLabel: vehicle
              ? VEHICLE_MN[vehicle as keyof typeof VEHICLE_MN] || vehicle
              : null,
            flowStep: step,
            flowStepLabel: step ? STEP_MN[step] : null,
            pickedUp: !!o.courierPickedUpAt,
          }
        : null;

      confirmed.push({
        id: o._id.toString(),
        code: `SD-${o._id.toString().slice(-5).toUpperCase()}`,
        status: o.status,
        statusLabel: customerStatusLabel(o as Record<string, unknown>),
        paidAt: o.paidAt || null,
        paymentMethod: o.paymentMethod || null,
        total: o.total,
        createdAt: o.createdAt,
        deliveryOtp,
        courierId: o.courierId || null,
        courier,
        courierFlowStep: step,
        shipping: {
          fullName: o.shipping?.fullName || o.shipping?.name || null,
          phone: o.shipping?.phone || o.phone || null,
          text: [
            o.shipping?.city,
            o.shipping?.district,
            o.shipping?.khoroo,
            o.shipping?.address || o.shipping?.street,
          ]
            .filter(Boolean)
            .join(', '),
        },
        items: (o.items || []).map((it: any) => ({
          name: it.name || 'Бараа',
          qty: it.quantity || it.qty || 1,
          price: it.price ?? it.finalPrice ?? null,
          image: it.image || it.images?.[0] || null,
        })),
      });
    }

    const pendingPayment = results
      .filter((o) => o.status === 'pending' && o.deliveryMethod !== 'pickup')
      .map((o) => ({
        id: o._id.toString(),
        code: `SD-${o._id.toString().slice(-5).toUpperCase()}`,
        status: 'pending',
        total: o.total,
        paymentMethod: o.paymentMethod || null,
        itemsCount: Array.isArray(o.items) ? o.items.length : 0,
      }));

    return NextResponse.json({
      orders: confirmed,
      pendingPayment,
    });
  } catch (error) {
    console.error('[delivery/my-orders]', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
