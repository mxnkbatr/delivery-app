import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

/**
 * POST — attach proof-of-delivery photo (base64 data URL or https URL).
 * Body: { photo: string }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'courier' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const photo = String(body.photo || '');
    if (!photo || photo.length < 32) {
      return NextResponse.json({ error: 'Зураг оруулна уу' }, { status: 400 });
    }
    // Cap ~1.5MB base64
    if (photo.length > 2_000_000) {
      return NextResponse.json({ error: 'Зураг хэт том' }, { status: 400 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const order = await orders.findOne({ _id: orderId });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (role === 'courier' && order.courierId !== userId) {
      return NextResponse.json({ error: 'Энэ захиалга таных биш' }, { status: 403 });
    }

    const now = new Date();
    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          'deliveryProof.photoUrl': photo.slice(0, 2_000_000),
          'deliveryProof.photoAt': now,
          'deliveryProof.photoBy': userId,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({ success: true, message: 'POD зураг хадгаллаа' });
  } catch (error) {
    console.error('[pod]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
