import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

/** POST — update courier GPS */
export async function POST(request: Request) {
  try {
    const { userId, role } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Буруу координат' }, { status: 400 });
    }

    const couriers = await getCollection('couriers');
    const now = new Date();
    const loc = { lat, lng, updatedAt: now };

    let result = await couriers.updateOne(
      { userId: new ObjectId(userId) },
      { $set: { lastLocation: loc, updatedAt: now } }
    );
    if (result.matchedCount === 0) {
      result = await couriers.updateOne(
        { userId },
        { $set: { lastLocation: loc, updatedAt: now } }
      );
    }

    return NextResponse.json({ success: true, location: loc });
  } catch (error) {
    console.error('[courier/location]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
