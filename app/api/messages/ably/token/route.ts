import { NextResponse } from 'next/server';
import { getAblyClient } from '@/lib/ably';
import { getAblyEnabled } from '@/lib/ablyConfig';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { userId: authUserId } = await auth();
        const guestId = req.headers.get('x-guest-id');
        // If guestId is also missing, we can assign a temporary guest ID for Ably client connection
        const userId = authUserId || guestId || `guest-${Date.now()}`;

        if (!getAblyEnabled()) {
            return NextResponse.json({ error: 'Ably is not enabled' }, { status: 503 });
        }

        const client = getAblyClient();
        const tokenRequestData = await client.auth.createTokenRequest({ clientId: userId });
        return NextResponse.json(tokenRequestData);
    } catch (error) {
        console.error('Ably token request error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
