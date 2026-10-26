import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { haversineM, resolveDropoffCoords } from '@/lib/delivery/geo';

/** Alert when parties are within this many meters */
export const PROXIMITY_ALERT_M = 200;

function parseLoc(body: any) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, updatedAt: new Date() };
}

async function loadOrder(id: string) {
  let orderId: ObjectId;
  try {
    orderId = new ObjectId(id);
  } catch {
    return null;
  }
  const orders = await getCollection('orders');
  return { orders, order: await orders.findOne({ _id: orderId }), orderId };
}

function canAccess(order: any, userId: string, role: string | null | undefined, phone?: string | null) {
  if (!order) return false;
  if (role === 'admin') return true;
  if (order.courierId && String(order.courierId) === String(userId)) return true;
  if (order.userId && String(order.userId) === String(userId)) return true;
  if (phone && (order.phone === phone || order.shipping?.phone === phone)) return true;
  return false;
}

/**
 * POST — share live location for this order (customer or assigned courier).
 * Body: { lat, lng, sharing?: boolean }  sharing=false stops customer share
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, phone } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const loaded = await loadOrder(id);
    if (!loaded?.order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { orders, order, orderId } = loaded;

    if (!canAccess(order, userId, role, phone)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const now = new Date();

    const isCourier =
      role === 'courier' ||
      (order.courierId && String(order.courierId) === String(userId));
    const isCustomer =
      !isCourier &&
      (String(order.userId) === String(userId) ||
        (!!phone && (order.phone === phone || order.shipping?.phone === phone)));

    if (body.sharing === false && isCustomer) {
      await orders.updateOne(
        { _id: orderId },
        { $unset: { customerLiveLocation: '' }, $set: { updatedAt: now } }
      );
      return NextResponse.json({ success: true, sharing: false });
    }

    const loc = parseLoc(body);
    if (!loc) return NextResponse.json({ error: 'Буруу координат' }, { status: 400 });

    if (isCourier) {
      await orders.updateOne(
        { _id: orderId },
        { $set: { courierLiveLocation: loc, updatedAt: now } }
      );
      // also heartbeat on courier profile
      const couriers = await getCollection('couriers');
      await couriers.updateOne(
        { $or: [{ userId: new ObjectId(userId) }, { userId }] },
        { $set: { lastLocation: loc, updatedAt: now } }
      );
      return NextResponse.json({ success: true, role: 'courier', location: loc });
    }

    if (isCustomer || role === 'admin') {
      await orders.updateOne(
        { _id: orderId },
        {
          $set: {
            customerLiveLocation: { ...loc, sharing: true },
            updatedAt: now,
          },
        }
      );
      return NextResponse.json({ success: true, role: 'customer', location: loc, sharing: true });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('[order location POST]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * GET — mutual live locations + distances for an order.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, phone } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const loaded = await loadOrder(id);
    if (!loaded?.order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { order } = loaded;

    if (!canAccess(order, userId, role, phone)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dropoff = resolveDropoffCoords(order.shipping);
    let courier = order.courierLiveLocation || null;

    // Fallback to courier profile lastLocation
    if ((!courier || !courier.lat) && order.courierId) {
      const couriers = await getCollection('couriers');
      const cid = String(order.courierId);
      const doc =
        (ObjectId.isValid(cid) &&
          (await couriers.findOne({ userId: new ObjectId(cid) }))) ||
        (await couriers.findOne({ userId: cid }));
      if (doc?.lastLocation?.lat != null) {
        courier = {
          lat: doc.lastLocation.lat,
          lng: doc.lastLocation.lng,
          updatedAt: doc.lastLocation.updatedAt || doc.updatedAt || null,
        };
      }
    }

    const customer =
      order.customerLiveLocation?.sharing !== false && order.customerLiveLocation?.lat != null
        ? {
            lat: order.customerLiveLocation.lat,
            lng: order.customerLiveLocation.lng,
            updatedAt: order.customerLiveLocation.updatedAt || null,
            sharing: true,
          }
        : null;

    const courierPos =
      courier?.lat != null ? { lat: Number(courier.lat), lng: Number(courier.lng) } : null;
    const customerPos =
      customer?.lat != null ? { lat: Number(customer.lat), lng: Number(customer.lng) } : null;

    const distanceBetween =
      courierPos && customerPos ? Math.round(haversineM(courierPos, customerPos)) : null;
    const courierToDropoff = courierPos
      ? Math.round(haversineM(courierPos, dropoff))
      : null;
    const customerToDropoff = customerPos
      ? Math.round(haversineM(customerPos, dropoff))
      : null;

    const proximity =
      distanceBetween != null && distanceBetween <= PROXIMITY_ALERT_M;

    return NextResponse.json({
      courier: courierPos
        ? { ...courierPos, updatedAt: courier?.updatedAt || null }
        : null,
      customer,
      dropoff,
      distanceM: distanceBetween,
      courierToDropoffM: courierToDropoff,
      customerToDropoffM: customerToDropoff,
      proximity,
      proximityM: PROXIMITY_ALERT_M,
      courierAssigned: !!order.courierId,
    });
  } catch (error) {
    console.error('[order location GET]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
