import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { auth, currentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { broadcastAdminConversationUpdate } from '@/lib/messageBroadcast';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { userId: authUserId, role: authRole } = await auth();
        const guestId = req.headers.get('x-guest-id');
        const userId = authUserId || guestId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const conversationsCollection = await getCollection('support_conversations');

        let query = {};
        if (authRole === 'admin') {
            // Admins can see all support conversations
            query = {};
        } else {
            // Customers/guests only see their own support conversations
            query = { userId };
        }

        const conversations = await conversationsCollection
            .find(query)
            .sort({ lastMessageAt: -1 })
            .toArray();

        return NextResponse.json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { userId: authUserId, role: authRole } = await auth();
        const guestId = req.headers.get('x-guest-id');
        const userId = authUserId || guestId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { message, senderName } = body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({ error: 'First message body is required' }, { status: 400 });
        }

        const conversationsCollection = await getCollection('support_conversations');
        const messagesCollection = await getCollection('support_messages');

        // Check if a conversation already exists for this user (unless admin is creating it, or we allow multiple)
        let conversation = null;
        if (authRole !== 'admin') {
            conversation = await conversationsCollection.findOne({ userId });
        }

        const finalSenderName = senderName || (authRole === 'admin' ? 'Support Admin' : 'Guest');
        const finalSenderId = authRole === 'admin' ? 'support_admin' : userId;

        if (conversation) {
            // If conversation already exists for the customer, add the message to it instead of creating a new conversation
            const newMessage = {
                conversationId: conversation._id,
                senderId: finalSenderId,
                senderName: finalSenderName,
                body: message.trim(),
                createdAt: new Date(),
                status: 'sent' as const
            };

            const msgResult = await messagesCollection.insertOne(newMessage);
            
            // Update the conversation's last message, lastMessageAt, and unread counts
            const updateDoc: any = {
                $set: {
                    lastMessage: message.trim(),
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                }
            };
            if (authRole === 'admin') {
                updateDoc.$inc = { userUnreadCount: 1 };
            } else {
                updateDoc.$inc = { adminUnreadCount: 1 };
            }

            await conversationsCollection.updateOne(
                { _id: conversation._id },
                updateDoc
            );

            const updatedConv = await conversationsCollection.findOne({ _id: conversation._id });
            if (updatedConv) {
                await broadcastAdminConversationUpdate(updatedConv);
            }

            return NextResponse.json({
                conversation: updatedConv,
                message: { ...newMessage, _id: msgResult.insertedId }
            });
        }

        // Otherwise create a new conversation
        const conversationDoc = {
            userId: authRole === 'admin' ? body.targetUserId || 'support_admin' : userId,
            userName: finalSenderName,
            lastMessage: message.trim(),
            lastMessageAt: new Date(),
            adminUnreadCount: authRole === 'admin' ? 0 : 1,
            userUnreadCount: authRole === 'admin' ? 1 : 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const convResult = await conversationsCollection.insertOne(conversationDoc);
        const conversationId = convResult.insertedId;

        const newMessage = {
            conversationId,
            senderId: finalSenderId,
            senderName: finalSenderName,
            body: message.trim(),
            createdAt: new Date(),
            status: 'sent' as const
        };

        const msgResult = await messagesCollection.insertOne(newMessage);

        const createdConversation = { ...conversationDoc, _id: conversationId };
        await broadcastAdminConversationUpdate(createdConversation);

        return NextResponse.json({
            conversation: createdConversation,
            message: { ...newMessage, _id: msgResult.insertedId }
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
