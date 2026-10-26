import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersCollection = await getCollection('users');
    const ordersCollection = await getCollection('orders');
    const reviewsCollection = await getCollection('reviews');
    const notificationsCollection = await getCollection('notifications');

    // Orders/reviews/notifications store userId as string (see app/api/orders, reviews).
    await Promise.all([
      ordersCollection.updateMany(
        { userId },
        { $set: { userId: null, deletedUser: true } }
      ),
      reviewsCollection.deleteMany({ userId }),
      notificationsCollection.deleteMany({ userId }),
      usersCollection.deleteOne({ _id: new ObjectId(userId) }),
    ]);

    const cookieStore = await cookies();
    cookieStore.delete('auth_token');

    return NextResponse.json({ success: true, message: 'Данс амжилттай устгагдлаа' });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
