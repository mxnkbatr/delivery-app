/**
 * Atomic claim of ready delivery orders by a courier.
 * Uses findOneAndUpdate so two couriers cannot both succeed.
 */
import { ObjectId, type Collection } from 'mongodb';

const EMPTY_COURIER = [
  { courierId: { $exists: false } },
  { courierId: null },
  { courierId: '' },
];

export async function claimOrdersAtomic(
  orders: Collection,
  claimIds: ObjectId[],
  userId: string,
  now: Date
): Promise<string[]> {
  const claimedStr: string[] = [];

  for (const oid of claimIds) {
    const filter = {
      _id: oid,
      readyForDelivery: true,
      $or: EMPTY_COURIER,
      status: { $in: ['confirmed', 'processing'] },
      deliveryMethod: { $ne: 'pickup' },
    };

    // Provisional claim one-by-one; final batchOrderIds set after all succeed
    const res = await orders.findOneAndUpdate(
      filter,
      {
        $set: {
          courierId: String(userId),
          courierAcceptedAt: now,
          courierFlowStep: 'accepted',
          status: 'shipped',
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (res) {
      claimedStr.push(oid.toString());
    }
  }

  if (claimedStr.length > 0) {
    await orders.updateMany(
      { _id: { $in: claimedStr.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } },
      { $set: { batchOrderIds: claimedStr, updatedAt: now } }
    );
  }

  return claimedStr;
}

/** Customer owns order by userId or matching phone (guest checkout). */
export function isOrderCustomer(
  order: Record<string, unknown> | null | undefined,
  userId: string,
  phone?: string | null
): boolean {
  if (!order) return false;
  if (order.userId && String(order.userId) === String(userId)) return true;
  if (!phone) return false;
  const p = String(phone).replace(/\D/g, '');
  if (p.length < 8) return false;
  const shipping = (order.shipping || {}) as Record<string, unknown>;
  const orderPhone = String(order.phone || '').replace(/\D/g, '');
  const shipPhone = String(shipping.phone || '').replace(/\D/g, '');
  return orderPhone === p || shipPhone === p;
}

/** Attach guest orders with this phone to the logged-in user. */
export async function claimGuestOrdersByPhone(phone: string, userId: string) {
  const { getCollection } = await import('@/lib/mongodb');
  const orders = await getCollection('orders');
  await orders.updateMany(
    {
      userId: 'guest',
      $or: [{ phone }, { 'shipping.phone': phone }],
    },
    { $set: { userId: String(userId), updatedAt: new Date() } }
  );
}
