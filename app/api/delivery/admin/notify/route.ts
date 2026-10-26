import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
import { broadcastNotificationToAll } from '@/lib/broadcastNotification';
import { sendPushToUser } from '@/lib/fcm';

async function requireAdmin() {
  const { userId, role } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { userId };
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if ('error' in gate && gate.error) return gate.error;

    const body = await request.json();
    const {
      title,
      message,
      link = '/customer',
      audience = 'all', // all | customers | user
      userId,
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Гарчиг, мессеж заавал' }, { status: 400 });
    }

    const notifications = await getCollection('notifications');
    const users = await getCollection('users');

    if (audience === 'user') {
      if (!userId || !ObjectId.isValid(userId)) {
        return NextResponse.json({ error: 'userId буруу' }, { status: 400 });
      }
      await notifications.insertOne({
        userId: String(userId),
        title: String(title),
        message: String(message),
        type: 'admin_broadcast',
        isRead: false,
        link: String(link),
        createdAt: new Date(),
      });
      const fcm = await sendPushToUser({
        userId: String(userId),
        title: String(title),
        body: String(message),
        data: { url: String(link), type: 'admin_broadcast' },
      });
      return NextResponse.json({ success: true, audience: 'user', fcm });
    }

    if (audience === 'customers') {
      const customers = await users
        .find(
          { role: { $in: ['user', 'customer'] }, pushTokens: { $exists: true, $ne: [] } },
          { projection: { _id: 1 } }
        )
        .toArray();

      await notifications.insertOne({
        userId: 'customers',
        title: String(title),
        message: String(message),
        type: 'admin_broadcast',
        isRead: false,
        link: String(link),
        createdAt: new Date(),
      });

      let sent = 0;
      for (const u of customers) {
        try {
          await sendPushToUser({
            userId: u._id.toString(),
            title: String(title),
            body: String(message),
            data: { url: String(link), type: 'admin_broadcast' },
          });
          sent += 1;
        } catch {
          /* continue */
        }
      }
      return NextResponse.json({
        success: true,
        audience: 'customers',
        targeted: customers.length,
        sent,
      });
    }

    const fcmResult = await broadcastNotificationToAll({
      title: String(title),
      message: String(message),
      link: String(link),
      type: 'admin_broadcast',
    });

    return NextResponse.json({ success: true, audience: 'all', fcm: fcmResult });
  } catch (error) {
    console.error('[admin/notify]', error);
    return NextResponse.json({ error: 'Мэдэгдэл илгээж чадсангүй' }, { status: 500 });
  }
}
