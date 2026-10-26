import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';

async function getOrderAccess(orderId: string, userId: string, role: string | null, phone?: string | null) {
  const orders = await getCollection('orders');
  let oid: ObjectId;
  try {
    oid = new ObjectId(orderId);
  } catch {
    return { error: NextResponse.json({ error: 'Invalid id' }, { status: 400 }) };
  }
  const order = await orders.findOne({ _id: oid });
  if (!order) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const { isOrderCustomer } = await import('@/lib/delivery/claimOrder');
  const isCustomer = isOrderCustomer(order, userId, phone);
  const isCourier = order.courierId && String(order.courierId) === String(userId);
  const isAdmin = role === 'admin';
  if (!isCustomer && !isCourier && !isAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { order, oid, isCustomer, isCourier, isAdmin };
}

/** GET — chat messages for this delivery order */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, phone } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const access = await getOrderAccess(id, userId, role, phone);
    if ('error' in access && access.error) return access.error;

    const chat = await getCollection('delivery_chats');
    const messages = await chat
      .find({ orderId: id })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();

    const order = access.order!;
    let peerPhone = '';
    let peerName = '';
    if (access.isCourier || access.isAdmin) {
      peerName = order.shipping?.fullName || order.shipping?.name || 'Захиалагч';
      peerPhone = order.shipping?.phone || order.phone || '';
    } else {
      // customer → courier
      if (order.courierId) {
        const users = await getCollection('users');
        const courier = await users.findOne({ _id: new ObjectId(String(order.courierId)) });
        peerName = courier?.name || 'Хүргэгч';
        peerPhone = courier?.phone || '';
      }
    }

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m._id.toString(),
        text: m.text,
        senderId: m.senderId,
        senderRole: m.senderRole,
        senderName: m.senderName,
        createdAt: m.createdAt,
        mine: m.senderId === userId,
      })),
      peer: { name: peerName, phone: peerPhone },
      courierId: order.courierId || null,
    });
  } catch (error) {
    console.error('[delivery chat GET]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/** POST — send message { text } */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, phone } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const access = await getOrderAccess(id, userId, role, phone);
    if ('error' in access && access.error) return access.error;

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || '').trim();
    if (!text || text.length > 1000) {
      return NextResponse.json({ error: 'Мессеж хоосон эсвэл хэт урт' }, { status: 400 });
    }

    const users = await getCollection('users');
    const me = await users.findOne({ _id: new ObjectId(userId) });
    const senderRole = access.isCourier ? 'courier' : access.isAdmin ? 'admin' : 'customer';
    const senderName = me?.name || (senderRole === 'courier' ? 'Хүргэгч' : 'Захиалагч');

    const chat = await getCollection('delivery_chats');
    const doc = {
      orderId: id,
      text,
      senderId: userId,
      senderRole,
      senderName,
      createdAt: new Date(),
    };
    const result = await chat.insertOne(doc);

    // In-app + push notification to peer — deep link opens chat sheet
    try {
      const order = access.order!;
      const peerId =
        senderRole === 'courier' || senderRole === 'admin'
          ? order.userId && order.userId !== 'guest'
            ? String(order.userId)
            : null
          : order.courierId
            ? String(order.courierId)
            : null;
      if (peerId) {
        const link =
          senderRole === 'courier' || senderRole === 'admin'
            ? `/customer/orders/${id}?chat=1`
            : `/active/${id}?chat=1`;

        const notifications = await getCollection('notifications');
        await notifications.insertOne({
          userId: peerId,
          title: '💬 Хүргэлтийн мессеж',
          message: text.slice(0, 120),
          type: 'delivery_chat',
          isRead: false,
          link,
          orderId: id,
          createdAt: new Date(),
        });

        const { sendPushToUser } = await import('@/lib/fcm');
        void sendPushToUser({
          userId: peerId,
          title: '💬 Хүргэлтийн мессеж',
          body: text.slice(0, 120),
          data: { url: link, type: 'delivery_chat', orderId: id },
        }).catch(() => {});
      }
    } catch {
      /* ignore notify errors */
    }

    return NextResponse.json({
      success: true,
      message: {
        id: result.insertedId.toString(),
        text,
        senderId: userId,
        senderRole,
        senderName,
        createdAt: doc.createdAt,
        mine: true,
      },
    });
  } catch (error) {
    console.error('[delivery chat POST]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
