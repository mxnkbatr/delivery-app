import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { userId: authUserId } = await auth();
        const guestId = req.headers.get('x-guest-id');
        const userId = authUserId || guestId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const messagesCollection = await getCollection('messages');
        const count = await messagesCollection.countDocuments({
            receiverId: userId,
            read: false
        });

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error fetching unread messages count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
