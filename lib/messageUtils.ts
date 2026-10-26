import { ChatMessage } from '@/types/chat-message';

export interface TimelineGroup {
    date: string;
    messages: ChatMessage[];
}

export function buildTimeline(messages: ChatMessage[]): TimelineGroup[] {
    if (!Array.isArray(messages)) return [];
    
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach((msg) => {
        if (!msg.createdAt) return;
        const dateObj = new Date(msg.createdAt);
        // Format to a readable date
        const dateKey = dateObj.toLocaleDateString('mn-MN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(msg);
    });
    
    return Object.entries(groups).map(([date, msgs]) => ({
        date,
        messages: msgs
    }));
}
