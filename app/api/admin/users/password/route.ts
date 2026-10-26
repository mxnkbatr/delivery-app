import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function PATCH(req: Request) {
    try {
        // 1. Check authentication and admin role
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const usersCollection = await getCollection('users');
        const currentUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse body
        const body = await req.json();
        const { userId: targetUserId, newPassword } = body;

        if (!targetUserId || !newPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // 3. Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // 4. Update user password
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(targetUserId) },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Нууц үг шинэчлэгдлээ' });

    } catch (error) {
        console.error('Error updating password:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
