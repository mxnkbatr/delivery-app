import { useState, useEffect, useRef } from 'react';
import * as Ably from 'ably';
import { ChatMessage } from '@/types/chat-message';

export function useRoomChat(roomId: string, conversationId?: string, currentUserId?: string, currentUserName?: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const ablyRef = useRef<Ably.Realtime | null>(null);
    const channelRef = useRef<Ably.RealtimeChannel | null>(null);

    // Fetch message history on mount/conversationId change
    useEffect(() => {
        if (!conversationId) return;

        async function fetchHistory() {
            try {
                const res = await fetch(`/api/messages/conversations/${conversationId}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data);
                }
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
            }
        }

        fetchHistory();
    }, [conversationId]);

    // Setup Ably client-side connection
    useEffect(() => {
        if (!roomId) return;

        let isMounted = true;
        let realtime: Ably.Realtime | null = null;

        try {
            // Setup client auth via token endpoint
            realtime = new Ably.Realtime({
                authUrl: '/api/messages/ably/token',
                authMethod: 'GET'
            });
            ablyRef.current = realtime;

            const channel = realtime.channels.get(`room:${roomId}`);
            channelRef.current = channel;

            channel.subscribe('message', (message) => {
                if (!isMounted) return;
                const newMsg = message.data as ChatMessage;
                
                // Avoid duplicating messages sent by the user themselves
                setMessages((prev) => {
                    if (prev.some((m) => m.id === newMsg.id)) {
                        return prev;
                    }
                    return [...prev, newMsg];
                });

                if (newMsg.senderId !== currentUserId) {
                    setUnreadCount((prev) => prev + 1);
                }
            });
        } catch (error) {
            console.error('Ably initialization failed in useRoomChat:', error);
        }

        return () => {
            isMounted = false;
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
            if (realtime) {
                realtime.close();
            }
        };
    }, [roomId, currentUserId]);

    const sendMessage = async (body: string) => {
        if (!body.trim()) return;

        const tempId = `temp-${Date.now()}`;
        const newMsg: ChatMessage = {
            id: tempId,
            senderId: currentUserId || 'guest',
            senderName: currentUserName || 'Guest',
            body: body.trim(),
            createdAt: new Date().toISOString(),
            status: 'sent'
        };

        // Update local state immediately for snappy UI response
        setMessages((prev) => [...prev, newMsg]);

        // Publish to Ably channel in real-time
        if (channelRef.current) {
            try {
                await channelRef.current.publish('message', newMsg);
            } catch (error) {
                console.error('Failed to publish message to Ably channel:', error);
            }
        }

        // Persist message to database via API route if conversationId is available
        if (conversationId) {
            try {
                const res = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        body: body.trim(),
                        senderName: currentUserName || 'Guest'
                    })
                });

                if (res.ok) {
                    const persistedMsg = await res.json();
                    // Replace temporary ID message with the persisted one from database
                    setMessages((prev) =>
                        prev.map((msg) => (msg.id === tempId ? persistedMsg : msg))
                    );
                }
            } catch (error) {
                console.error('Failed to persist room chat message:', error);
            }
        }
    };

    const resetUnread = () => {
        setUnreadCount(0);
    };

    return {
        messages,
        sendMessage,
        unreadCount,
        resetUnread
    };
}
