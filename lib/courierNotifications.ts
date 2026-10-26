import { getCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPushToUser } from '@/lib/fcm';
import { VEHICLE_MN, type DeliveryVehicleType } from '@/lib/delivery/vehicles';

/**
 * Notify couriers (optionally filtered by vehicle) that an order is ready.
 */
export async function notifyCouriersReadyOrder({
  orderId,
  code,
  dropoffText,
  total,
  courierPayout,
  vehicleType,
}: {
  orderId: string;
  code?: string;
  dropoffText?: string;
  total?: number;
  courierPayout?: number;
  vehicleType?: DeliveryVehicleType;
}) {
  try {
    const users = await getCollection('users');
    const couriersCol = await getCollection('couriers');
    const notifications = await getCollection('notifications');

    const courierUsers = await users.find({ role: 'courier' }).toArray();
    if (courierUsers.length === 0) return;

    let targetIds = courierUsers.map((c) => c._id.toString());

    if (vehicleType) {
      const courierDocs = await couriersCol.find({ vehicleType }).toArray();
      const allowed = new Set(
        courierDocs.map((d) => d.userId?.toString?.() || String(d.userId)).filter(Boolean)
      );
      targetIds = targetIds.filter((id) => allowed.has(id));
    }

    if (targetIds.length === 0) return;

    const short = code || `SD-${orderId.slice(-5).toUpperCase()}`;
    const vehicleLabel = vehicleType ? VEHICLE_MN[vehicleType] : null;
    const title = '📦 Хүргэхэд бэлэн бараа';
    const message = [
      short,
      vehicleLabel,
      courierPayout != null ? `Орлого ₮${Number(courierPayout).toLocaleString()}` : null,
      dropoffText ? dropoffText.slice(0, 80) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const now = new Date();
    await notifications.insertMany(
      targetIds.map((userId) => ({
        userId,
        title,
        message,
        type: 'delivery_ready',
        isRead: false,
        link: `/work`,
        orderId,
        createdAt: now,
      }))
    );

    for (const userId of targetIds) {
      sendPushToUser({
        userId,
        title,
        body: message,
        data: {
          url: `/work`,
          type: 'delivery_ready',
          orderId,
        },
      }).catch(() => {});
    }
  } catch (error) {
    console.error('[notifyCouriersReadyOrder]', error);
  }
}

/** Resolve courier vehicle type for a user id */
export async function getCourierVehicleType(userId: string): Promise<string> {
  try {
    const couriers = await getCollection('couriers');
    let doc = null;
    try {
      doc = await couriers.findOne({ userId: new ObjectId(userId) });
    } catch {
      /* ignore */
    }
    if (!doc) {
      doc = await couriers.findOne({ userId });
    }
    return (doc?.vehicleType as string) || 'motorbike';
  } catch {
    return 'motorbike';
  }
}
