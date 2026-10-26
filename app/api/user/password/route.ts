import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function PATCH(req: Request) {
    try {
        // 1. Check authentication
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse body
        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // 3. Fetch user
        const usersCollection = await getCollection('users');
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

        if (!user || !user.password) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 4. Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Одоогийн нууц үг буруу байна' }, { status: 400 });
        }

        // 5. Hash new password & update
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
        );

        return NextResponse.json({ success: true, message: 'Нууц үг амжилттай солигдлоо' });

    } catch (error) {
        console.error('Error changing password:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
