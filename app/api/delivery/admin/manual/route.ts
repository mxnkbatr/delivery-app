import { NextResponse } from 'next/server';
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
 * POST — admin manually creates a delivery job and puts it in courier queue.
 * Body: {
 *   customerName, customerPhone, address,
 *   city?, district?,
 *   vehicleType, courierPayout,
 *   adminNote?, packageCount?,
 *   notify?: boolean
 * }
 */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const body = await request.json().catch(() => ({}));
    const customerName = String(body.customerName || '').trim();
    const customerPhone = String(body.customerPhone || '').replace(/\D/g, '');
    const address = String(body.address || '').trim();
    const city = String(body.city || 'Улаанбаатар').trim();
    const district = String(body.district || '').trim();
    const adminNote = String(body.adminNote || '').trim();
    const packageCount = Math.max(1, Math.min(99, Number(body.packageCount) || 1));
    const vehicleType = body.vehicleType;
    const courierPayout = Number(body.courierPayout);
    const notify = body.notify !== false;

    if (!customerName) {
      return NextResponse.json({ error: 'Захиалагчийн нэр оруулна уу' }, { status: 400 });
    }
    if (customerPhone.length < 8) {
      return NextResponse.json({ error: 'Утасны дугаар буруу' }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: 'Хүргэх хаяг оруулна уу' }, { status: 400 });
    }
    if (!isDeliveryVehicle(vehicleType)) {
      return NextResponse.json({ error: 'Тээврийн хэрэгсэл сонгоно уу' }, { status: 400 });
    }
    if (!Number.isFinite(courierPayout) || courierPayout <= 0) {
      return NextResponse.json({ error: 'Хүргэгчийн орлого оруулна уу' }, { status: 400 });
    }

    const now = new Date();
    const orders = await getCollection('orders');

    const doc = {
      userId: null,
      status: 'processing',
      deliveryMethod: 'delivery',
      manualDelivery: true,
      readyForDelivery: true,
      readyForDeliveryAt: now,
      readyForDeliveryBy: gate.userId,
      deliveryVehicleType: vehicleType,
      courierPayout: Math.round(courierPayout),
      courierTip: Math.max(0, Math.round(Number(body.courierTip) || 0)),
      courierBonus: Math.max(0, Math.round(Number(body.courierBonus) || 0)),
      adminNote: adminNote || null,
      phone: customerPhone,
      shipping: {
        fullName: customerName,
        name: customerName,
        phone: customerPhone,
        city,
        district,
        address,
      },
      // Stored for admin ops only — never returned to couriers
      items: Array.from({ length: packageCount }, (_, i) => ({
        name: adminNote ? `Багц ${i + 1}` : `Хүргэх багц ${i + 1}`,
        quantity: 1,
        price: 0,
      })),
      total: 0,
      paymentMethod: 'manual',
      paidAt: now,
      createdAt: now,
      updatedAt: now,
      createdByAdmin: gate.userId,
    };

    const result = await orders.insertOne(doc);
    const id = result.insertedId.toString();
    const code = `SD-${id.slice(-5).toUpperCase()}`;
    const dropoffText = [city, district, address].filter(Boolean).join(', ');

    if (notify) {
      notifyCouriersReadyOrder({
        orderId: id,
        code,
        dropoffText,
        courierPayout: Math.round(courierPayout),
        vehicleType,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      order: {
        id,
        code,
        customerName,
        customerPhone,
        dropoffText,
        vehicleType,
        courierPayout: Math.round(courierPayout),
        adminNote: adminNote || null,
        packageCount,
      },
      message: 'Хүргэлтийн бараа queue-д нэмэгдлээ',
    });
  } catch (error) {
    console.error('[admin/manual-delivery]', error);
    return NextResponse.json({ error: 'Нэмж чадсангүй' }, { status: 500 });
  }
}
