import { NextResponse } from 'next/server';
import { getAblyClient } from '@/lib/ably';
import { getAblyEnabled } from '@/lib/ablyConfig';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const { userId: authUserId, role: authRole } = await auth();
        const guestId = req.headers.get('x-guest-id');
        const userId = authUserId || guestId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { conversationId, isTyping } = body;

        if (!conversationId) {
            return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
        }

        if (!getAblyEnabled()) {
            // Log warning but return success to avoid client errors if Ably is temporarily disabled or not configured
            console.warn('Ably is not enabled, skipping typing broadcast');
            return NextResponse.json({ success: false, warning: 'Ably is not enabled' });
        }

        const client = getAblyClient();
        const channel = client.channels.get(`conversation:${conversationId}`);
        
        await channel.publish('typing', {
            userId: authRole === 'admin' ? 'support_admin' : userId,
            isTyping: !!isTyping
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error broadcasting typing indicator:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
