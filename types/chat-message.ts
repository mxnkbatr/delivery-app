export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: string; // or Date, using string for serialized API/Ably payload compatibility
    status?: 'sent' | 'delivered' | 'read';
}
