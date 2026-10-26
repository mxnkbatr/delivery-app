import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { notifyCouriersReadyOrder } from '@/lib/courierNotifications';
import { isDeliveryVehicle } from '@/lib/delivery/vehicles';

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

/**
 * POST — admin releases selected confirmed orders to courier queue.
 * Body: { orderIds: string[], vehicleType: 'motorbike'|'car'|'foot', courierPayout: number }
 */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const body = await request.json().catch(() => ({}));
    const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds : [];
    const vehicleType = body.vehicleType;
    const courierPayout = Number(body.courierPayout);
    const courierTip = Math.max(0, Math.round(Number(body.courierTip) || 0));
    const courierBonus = Math.max(0, Math.round(Number(body.courierBonus) || 0));

    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'Захиалга сонгоно уу' }, { status: 400 });
    }
    if (!isDeliveryVehicle(vehicleType)) {
      return NextResponse.json(
        { error: 'Тээврийн хэрэгсэл сонгоно уу (мотоцикл / машин / явган)' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(courierPayout) || courierPayout < 0) {
      return NextResponse.json({ error: 'Хүргэгчийн орлого буруу байна' }, { status: 400 });
    }
    if (courierPayout === 0) {
      return NextResponse.json(
        { error: 'Хүргэгчид өгөх дүнг оруулна уу (₮)' },
        { status: 400 }
      );
    }

    const objectIds: ObjectId[] = [];
    for (const id of orderIds) {
      if (!ObjectId.isValid(id)) {
        return NextResponse.json({ error: `Буруу id: ${id}` }, { status: 400 });
      }
      objectIds.push(new ObjectId(id));
    }

    const orders = await getCollection('orders');
    const now = new Date();
    const docs = await orders
      .find({
        _id: { $in: objectIds },
        deliveryMethod: { $ne: 'pickup' },
        status: { $in: ['confirmed', 'processing'] },
        readyForDelivery: { $ne: true },
        $or: [{ courierId: { $exists: false } }, { courierId: null }, { courierId: '' }],
      })
      .toArray();

    if (docs.length === 0) {
      return NextResponse.json(
        { error: 'Хүргэлтэд гаргах боломжтой захиалга олдсонгүй (аль хэдийн гаргасан/авсан байж болно)' },
        { status: 400 }
      );
    }

    const ids = docs.map((d) => d._id);
    const result = await orders.updateMany(
      {
        _id: { $in: ids },
        status: { $in: ['confirmed', 'processing'] },
        $or: [{ courierId: { $exists: false } }, { courierId: null }, { courierId: '' }],
      },
      {
        $set: {
          readyForDelivery: true,
          readyForDeliveryAt: now,
          readyForDeliveryBy: gate.userId,
          deliveryVehicleType: vehicleType,
          courierPayout: Math.round(courierPayout),
          courierTip,
          courierBonus,
          status: 'processing',
          awaitingDeliveryRelease: false,
          updatedAt: now,
        },
      }
    );

    for (const o of docs) {
      const id = o._id.toString();
      const dropoff = [
        o.shipping?.city,
        o.shipping?.district,
        o.shipping?.khoroo,
        o.shipping?.address || o.shipping?.street,
      ]
        .filter(Boolean)
        .join(', ');
      notifyCouriersReadyOrder({
        orderId: id,
        code: `SD-${id.slice(-5).toUpperCase()}`,
        dropoffText: dropoff,
        courierPayout: Math.round(courierPayout),
        vehicleType,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      released: result.modifiedCount,
      vehicleType,
      courierPayout: Math.round(courierPayout),
      message: `${result.modifiedCount} захиалгыг хүргэлтэд гаргалаа`,
    });
  } catch (error) {
    console.error('[admin/release]', error);
    return NextResponse.json({ error: 'Хүргэлтэд гаргаж чадсангүй' }, { status: 500 });
  }
}

/**
 * DELETE body — unrelease (pull back from courier queue if not accepted)
 */
export async function DELETE(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const body = await request.json().catch(() => ({}));
    const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds : [];
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'Захиалга сонгоно уу' }, { status: 400 });
    }

    const objectIds = orderIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    const orders = await getCollection('orders');

    const result = await orders.updateMany(
      {
        _id: { $in: objectIds },
        readyForDelivery: true,
        $or: [{ courierId: { $exists: false } }, { courierId: null }, { courierId: '' }],
      },
      {
        $set: {
          readyForDelivery: false,
          updatedAt: new Date(),
          status: 'confirmed',
        },
        $unset: {
          readyForDeliveryAt: '',
          readyForDeliveryBy: '',
          deliveryVehicleType: '',
          courierPayout: '',
        },
      }
    );

    return NextResponse.json({
      success: true,
      pulled: result.modifiedCount,
      message: `${result.modifiedCount} захиалгыг буцаалаа`,
    });
  } catch (error) {
    console.error('[admin/release DELETE]', error);
    return NextResponse.json({ error: 'Буцааж чадсангүй' }, { status: 500 });
  }
}
