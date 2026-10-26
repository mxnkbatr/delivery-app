import { getAblyClient } from './ably';
import { getAblyEnabled } from './ablyConfig';

export async function broadcastNewMessage(conversationId: string, message: any) {
    if (!getAblyEnabled()) return;
    try {
        const client = getAblyClient();
        const channel = client.channels.get(`conversation:${conversationId}`);
        await channel.publish('new-message', message);
    } catch (error) {
        console.error('Failed to broadcast new message via Ably:', error);
    }
}

export async function broadcastAdminConversationUpdate(conversation: any) {
    if (!getAblyEnabled()) return;
    try {
        const client = getAblyClient();
        const channel = client.channels.get('admin:conversations');
        await channel.publish('conversation-updated', conversation);
    } catch (error) {
        console.error('Failed to broadcast conversation update via Ably:', error);
    }
}
