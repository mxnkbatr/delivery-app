import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

/**
 * GET — customer reads their 4-digit code (only after courier requests completion).
 * Does not generate — generation happens via courier request-otp.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, phone } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role === 'courier') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const orders = await getCollection('orders');
    const order = await orders.findOne({ _id: orderId });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const { isOrderCustomer } = await import('@/lib/delivery/claimOrder');
    if (role !== 'admin' && !isOrderCustomer(order, userId, phone)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.status === 'delivered') {
      return NextResponse.json({
        otp: null,
        status: 'delivered',
        message: 'Хүргэлт аль хэдийн дууссан',
      });
    }

    const otp =
      order.deliveryOtp && /^\d{4}$/.test(String(order.deliveryOtp))
        ? String(order.deliveryOtp)
        : null;

    return NextResponse.json({
      otp,
      status: order.status,
      orderId: id,
      pending: !otp,
      hint: otp
        ? 'Хүргэгчид энэ 4 оронтой кодыг хэлнэ үү'
        : 'Хүргэгч «Хүргэлт дуусгах» дармагц код энд гарна',
    });
  } catch (error) {
    console.error('[delivery otp GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
