import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { generateDeliveryOtp } from '@/lib/delivery/otp';
import { sendPushToUser } from '@/lib/fcm';

/**
 * POST — courier starts completion: generate 4-digit OTP and push to customer phone.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'courier' && role !== 'admin') {
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
    const notifications = await getCollection('notifications');
    const order = await orders.findOne({ _id: orderId });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'delivered') {
      return NextResponse.json({ error: 'Хүргэлт аль хэдийн дууссан' }, { status: 400 });
    }

    if (role === 'courier' && order.courierId && order.courierId !== userId) {
      return NextResponse.json({ error: 'Энэ захиалга таных биш' }, { status: 403 });
    }

    if (role === 'courier' && !order.courierId) {
      return NextResponse.json(
        { error: 'Эхлээд захиалгыг хүлээн авна уу' },
        { status: 400 }
      );
    }

    const otp = generateDeliveryOtp();
    const now = new Date();
    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          deliveryOtp: otp,
          deliveryOtpCreatedAt: now,
          deliveryOtpRequestedAt: now,
          deliveryOtpRequestedBy: userId,
          updatedAt: now,
        },
      }
    );

    let customerId = order.userId && order.userId !== 'guest' ? String(order.userId) : null;
    if (!customerId) {
      const phone = order.shipping?.phone || order.phone;
      if (phone) {
        const users = await getCollection('users');
        const u = await users.findOne({ phone: String(phone) });
        if (u) {
          customerId = u._id.toString();
          // Heal guest order ownership for next time
          await orders.updateOne(
            { _id: orderId, userId: 'guest' },
            { $set: { userId: customerId, updatedAt: now } }
          );
        }
      }
    }
    const shortId = id.slice(-6);
    const title = '🔐 Хүлээн авах код';
    const message = `Таны #${shortId} захиалгын код: ${otp}. Хүргэгчид хэлнэ үү.`;

    if (customerId) {
      await notifications.insertOne({
        userId: customerId,
        title,
        message,
        type: 'delivery_otp',
        isRead: false,
        link: `/customer/orders/${id}`,
        createdAt: now,
      });

      sendPushToUser({
        userId: customerId,
        title,
        body: message,
        data: {
          url: `/customer/orders/${id}`,
          type: 'delivery_otp',
          orderId: id,
          otp,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      otpSent: !!customerId,
      message: customerId
        ? 'Хэрэглэгчийн утсанд 4 оронтой код илгээлээ'
        : 'Код үүслээ. Хэрэглэгч апп дээрээ харна.',
    });
  } catch (error) {
    console.error('[delivery request-otp]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
