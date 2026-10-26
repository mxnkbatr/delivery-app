import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth } from '@/lib/auth';

export async function GET() {
    try {
        const { userId, role } = await auth();
        if (!userId || role !== 'admin') {
            return NextResponse.json({ error: 'Auth failed' }, { status: 403 });
        }
        const orders = await getCollection('orders');
        const recent = await orders.find().sort({ createdAt: -1 }).limit(3).toArray();
        return NextResponse.json({ recent });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
