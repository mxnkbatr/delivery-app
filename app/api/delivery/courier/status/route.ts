import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

const ALLOWED = new Set(['ONLINE', 'OFFLINE']);

/**
 * POST — courier sets own availability (ONLINE / OFFLINE).
 * Body: { status: 'ONLINE' | 'OFFLINE' }
 * Does not clear ON_DELIVERY mid-job.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, role } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body.status || '').toUpperCase();
    if (!ALLOWED.has(status)) {
      return NextResponse.json({ error: 'status ONLINE|OFFLINE байх ёстой' }, { status: 400 });
    }

    const couriers = await getCollection('couriers');
    const doc =
      (await couriers.findOne({ userId: new ObjectId(userId) })) ||
      (await couriers.findOne({ userId }));

    if (doc?.status === 'ON_DELIVERY' && status === 'OFFLINE') {
      return NextResponse.json(
        { error: 'Идэвхтэй хүргэлттэй үед offline болгох боломжгүй' },
        { status: 400 }
      );
    }
    if (doc?.status === 'ON_DELIVERY' && status === 'ONLINE') {
      // Stay on delivery — ignore
      return NextResponse.json({ success: true, status: 'ON_DELIVERY' });
    }

    const now = new Date();
    const $set = { status, updatedAt: now };
    let ur = await couriers.updateOne({ userId: new ObjectId(userId) }, { $set });
    if (ur.matchedCount === 0) {
      ur = await couriers.updateOne({ userId }, { $set }, { upsert: false });
    }
    if (ur.matchedCount === 0) {
      await couriers.insertOne({
        userId: new ObjectId(userId),
        courierType: 'internal',
        status,
        lastLocation: { lat: 47.918, lng: 106.917, updatedAt: now },
        zone: 'Улаанбаатар',
        activeOrderId: null,
        batchOrderIds: [],
        vehicleType: 'motorbike',
        rating: 5,
        totalDeliveries: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('[courier/status]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
