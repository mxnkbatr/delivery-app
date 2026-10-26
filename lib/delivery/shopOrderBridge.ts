import { getCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPushToUser } from '@/lib/fcm';

export type ShopOrderLike = {
  _id?: { toString: () => string } | string;
  deliveryMethod?: string | null;
  readyForDelivery?: boolean;
  manualDelivery?: boolean;
  awaitingDeliveryRelease?: boolean;
  shipping?: { fullName?: string; name?: string } | null;
  total?: number;
  totalPrice?: number;
  status?: string;
};

function orderIdOf(order: ShopOrderLike, fallbackId?: string): string | null {
  if (fallbackId) return fallbackId;
  if (!order._id) return null;
  return typeof order._id === 'string' ? order._id : order._id.toString();
}

/**
 * Is this a shop e-commerce order that should enter Delivery Ops
 * (admin release list) — never pickup, never manual courier jobs.
 *
 * Does NOT set readyForDelivery — couriers only see jobs after
 * Delivery Admin release (vehicle + payout). Shop checkout unchanged.
 */
export function isShopDeliveryOrder(order: ShopOrderLike | null | undefined): boolean {
  if (!order) return false;
  if (order.deliveryMethod === 'pickup') return false;
  if (order.manualDelivery) return false;
  return true;
}

/**
 * After payment/confirm: mark order for Delivery Admin «Shop захиалга»
 * and notify admins with link to /delivery/admin/orders.
 *
 * Safe for shop: does not change checkout fields, inventory, status,
 * shipping shape, or readyForDelivery / courierId.
 */
export async function routeShopOrderToDeliveryAdmin(
  order: ShopOrderLike,
  explicitOrderId?: string
): Promise<{ routed: boolean; reason?: string }> {
  try {
    if (!isShopDeliveryOrder(order)) {
      return { routed: false, reason: 'not_shop_delivery' };
    }

    const orderId = orderIdOf(order, explicitOrderId);
    if (!orderId || !ObjectId.isValid(orderId)) {
      return { routed: false, reason: 'bad_id' };
    }

    // Only route once payment/ops has moved past pending
    const status = order.status || 'confirmed';
    if (status === 'pending' || status === 'cancelled') {
      return { routed: false, reason: 'not_confirmed' };
    }

    if (order.readyForDelivery) {
      return { routed: false, reason: 'already_in_queue' };
    }

    // Idempotent — already handed to Delivery Ops
    if (order.awaitingDeliveryRelease) {
      return { routed: true, reason: 'already_flagged' };
    }

    const orders = await getCollection('orders');
    const now = new Date();

    await orders.updateOne(
      {
        _id: new ObjectId(orderId),
        deliveryMethod: { $ne: 'pickup' },
        manualDelivery: { $ne: true },
        readyForDelivery: { $ne: true },
      },
      {
        $set: {
          awaitingDeliveryRelease: true,
          orderSource: 'shop',
          updatedAt: now,
        },
      }
    );

    const customerName =
      order.shipping?.fullName || order.shipping?.name || 'Захиалагч';
    const total = Number(order.total ?? order.totalPrice ?? 0);
    const code = `SD-${orderId.slice(-5).toUpperCase()}`;

    await notifyDeliveryAdminsShopOrder({
      orderId,
      code,
      customerName,
      total,
    });

    return { routed: true };
  } catch (error) {
    console.error('[shopOrderBridge] routeShopOrderToDeliveryAdmin', error);
    return { routed: false, reason: 'error' };
  }
}

async function notifyDeliveryAdminsShopOrder(opts: {
  orderId: string;
  code: string;
  customerName: string;
  total: number;
}) {
  try {
    const users = await getCollection('users');
    const notifications = await getCollection('notifications');
    const admins = await users.find({ role: 'admin' }).toArray();
    if (!admins.length) return;

    const title = 'Дэлгүүрийн хүргэлт — хүлээгдэж буй';
    const message = `${opts.code} · ${opts.customerName} · ₮${opts.total.toLocaleString()} — хүргэлтэд гаргана уу`;
    const link = '/delivery/admin/orders';

    await notifications.insertMany(
      admins.map((admin) => ({
        userId: admin._id.toString(),
        title,
        message,
        type: 'delivery_release',
        isRead: false,
        link,
        orderId: opts.orderId,
        createdAt: new Date(),
      }))
    );

    for (const admin of admins) {
      sendPushToUser({
        userId: admin._id.toString(),
        title: '📦 Хүргэлт гаргах захиалга',
        body: message,
        data: { url: link, type: 'delivery_release', orderId: opts.orderId },
      }).catch(() => {});
    }
  } catch (error) {
    console.error('[shopOrderBridge] notifyDeliveryAdminsShopOrder', error);
  }
}
