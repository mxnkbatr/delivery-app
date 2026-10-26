import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { broadcastAdminConversationUpdate } from '@/lib/messageBroadcast';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId: authUserId, role: authRole } = await auth();
        const guestId = req.headers.get('x-guest-id');
        const userId = authUserId || guestId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
        }

        const conversationsCollection = await getCollection('support_conversations');
        const messagesCollection = await getCollection('support_messages');

        const updateDoc: any = {};
        if (authRole === 'admin') {
            updateDoc.adminUnreadCount = 0;
            // Mark all messages from customer as read
            await messagesCollection.updateMany(
                { conversationId: new ObjectId(id), senderId: { $ne: 'support_admin' }, status: { $ne: 'read' } },
                { $set: { status: 'read' } }
            );
        } else {
            updateDoc.userUnreadCount = 0;
            // Mark all messages from support_admin as read
            await messagesCollection.updateMany(
                { conversationId: new ObjectId(id), senderId: 'support_admin', status: { $ne: 'read' } },
                { $set: { status: 'read' } }
            );
        }

        await conversationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateDoc }
        );

        const updatedConversation = await conversationsCollection.findOne({ _id: new ObjectId(id) });
        if (updatedConversation) {
            await broadcastAdminConversationUpdate(updatedConversation);
        }

        return NextResponse.json({ success: true, conversation: updatedConversation });
    } catch (error) {
        console.error('Error marking conversation as read:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
