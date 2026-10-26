'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Video, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import * as Ably from 'ably';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/context/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ChatMessage } from '@/types/chat-message';
import { buildTimeline } from '@/lib/messageUtils';

interface SupportChatWindowProps {
    conversationId: string;
    guestId?: string;
    onStartCall?: () => void;
    onStartVoiceCall?: () => void;
    onJoinCall?: (roomName: string) => void;
    onBack?: () => void;
}

const fetcher = ([url, guestId]: [string, string | undefined]) =>
    fetch(url, {
        headers: guestId ? { 'x-guest-id': guestId } : {}
    }).then((res) => res.json());

export default function SupportChatWindow({
    conversationId,
    guestId,
    onStartCall,
    onStartVoiceCall,
    onJoinCall,
    onBack
}: SupportChatWindowProps) {
    const { user } = useUser();
    const { t } = useTranslation();
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [otherPartyTyping, setOtherPartyTyping] = useState(false);
    const [otherPartyName, setOtherPartyName] = useState('Support');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const effectiveUserId = user?.id || guestId || '';
    const currentUserName = user?.name || (user?.role === 'admin' ? 'Support Admin' : 'Guest');

    // Fetch messages using SWR with 3s polling as a fallback
    const { data: messages, mutate } = useSWR<ChatMessage[]>(
        [`/api/messages/conversations/${conversationId}/messages`, guestId],
        fetcher,
        { refreshInterval: 3000 }
    );

    // Fetch conversation details to show the header info
    const { data: conversations } = useSWR<any[]>(
        ['/api/messages/conversations', guestId],
        fetcher
    );

    const currentConversation = conversations?.find(c => c._id === conversationId);

    useEffect(() => {
        if (currentConversation) {
            if (user?.role === 'admin') {
                setOtherPartyName(currentConversation.userName || 'Client');
            } else {
                setOtherPartyName('Support');
            }
        }
    }, [currentConversation, user?.role]);

    // Mark as read when messages load or window opens
    useEffect(() => {
        if (!conversationId) return;
        
        async function markAsRead() {
            try {
                await fetch(`/api/messages/conversations/${conversationId}/read`, {
                    method: 'PATCH',
                    headers: guestId ? { 'x-guest-id': guestId } : {}
                });
            } catch (error) {
                console.error('Failed to mark conversation as read:', error);
            }
        }
        markAsRead();
    }, [conversationId, messages, guestId]);

    // Connect to Ably for real-time messages and typing indicators
    useEffect(() => {
        if (!conversationId) return;

        let realtime: Ably.Realtime | null = null;
        let channel: Ably.RealtimeChannel | null = null;
        let isMounted = true;

        try {
            realtime = new Ably.Realtime({
                authUrl: '/api/messages/ably/token',
                authMethod: 'GET'
            });

            channel = realtime.channels.get(`conversation:${conversationId}`);

            // Listen for new messages
            channel.subscribe('new-message', (ablyMsg) => {
                if (!isMounted) return;
                const incomingMsg = ablyMsg.data as ChatMessage;

                // Mutate SWR messages cache immediately
                mutate((prev) => {
                    if (!prev) return [incomingMsg];
                    if (prev.some(m => m.id === incomingMsg.id)) return prev;
                    return [...prev, incomingMsg];
                }, false);
            });

            // Listen for typing events
            channel.subscribe('typing', (ablyMsg) => {
                if (!isMounted) return;
                const data = ablyMsg.data as { userId: string; isTyping: boolean };
                // Only show typing if it's the other user
                if (data.userId !== (user?.role === 'admin' ? 'support_admin' : effectiveUserId)) {
                    setOtherPartyTyping(data.isTyping);
                }
            });
        } catch (error) {
            console.error('Ably error in SupportChatWindow:', error);
        }

        return () => {
            isMounted = false;
            if (channel) {
                channel.unsubscribe();
            }
            if (realtime) {
                realtime.close();
            }
        };
    }, [conversationId, effectiveUserId, user?.role, mutate]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, otherPartyTyping]);

    // Typing indicator broadcast trigger
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);

        if (!isTyping) {
            setIsTyping(true);
            sendTypingStatus(true);
        }

        // Debounce typing end
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            sendTypingStatus(false);
        }, 1500);
    };

    const sendTypingStatus = async (typing: boolean) => {
        try {
            await fetch('/api/messages/typing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(guestId ? { 'x-guest-id': guestId } : {})
                },
                body: JSON.stringify({
                    conversationId,
                    isTyping: typing
                })
            });
        } catch (error) {
            console.error('Failed to send typing status:', error);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        const textToSend = newMessage.trim();
        setNewMessage('');

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        setIsTyping(false);
        sendTypingStatus(false);

        // Optimistic UI update
        const tempId = `temp-${Date.now()}`;
        const tempMsg: ChatMessage = {
            id: tempId,
            senderId: user?.role === 'admin' ? 'support_admin' : effectiveUserId,
            senderName: currentUserName,
            body: textToSend,
            createdAt: new Date().toISOString(),
            status: 'sent'
        };

        mutate((prev) => [...(prev || []), tempMsg], false);

        try {
            const res = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(guestId ? { 'x-guest-id': guestId } : {})
                },
                body: JSON.stringify({
                    body: textToSend,
                    senderName: currentUserName
                })
            });

            if (res.ok) {
                const persistedMsg = await res.json();
                mutate((prev) => 
                    (prev || []).map(m => m.id === tempId ? persistedMsg : m), 
                    false
                );
            } else {
                mutate(); // Fallback to full sync
            }
        } catch (error) {
            console.error('Failed to send support message:', error);
            mutate();
        } finally {
            setSending(false);
        }
    };

    const timeline = buildTimeline(messages || []);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-950/30 relative border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-white rounded-xl transition-colors">
                            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
                        </button>
                    )}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-600 ring-2 ring-white/10 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                        {otherPartyName[0].toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-white leading-tight tracking-wide">{otherPartyName}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Шууд тусламж
                        </p>
                    </div>
                </div>
                
                {(onStartCall || onStartVoiceCall) && (
                    <div className="flex items-center gap-2">
                        {onStartCall && (
                            <button
                                onClick={onStartCall}
                                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-amber-400 transition-all border border-white/5 active:scale-95 shadow-md"
                                title="Start Video Call"
                            >
                                <Video className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        )}
                        {onStartVoiceCall && (
                            <button
                                onClick={onStartVoiceCall}
                                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-400 transition-all border border-white/5 active:scale-95 shadow-md"
                                title="Start Voice Call"
                            >
                                <Phone className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                {timeline.map((group) => (
                    <div key={group.date} className="space-y-4">
                        <div className="flex justify-center">
                            <span className="bg-slate-900/60 backdrop-blur-md text-slate-400 text-[10px] px-3.5 py-1 rounded-full border border-white/5 font-semibold tracking-wider uppercase">
                                {group.date}
                            </span>
                        </div>

                        {group.messages.map((rawMsg) => {
                            // Cast the message safely to avoid TS Property 'type' / 'roomName' errors
                            const msg = rawMsg as ChatMessage & { type?: string; roomName?: string };
                            
                            const isMe = msg.senderId === (user?.role === 'admin' ? 'support_admin' : effectiveUserId);
                            const isInvite = msg.type === 'call_invite' || msg.body.includes('эхэллээ:') || msg.body.includes('started:');
                            const roomName = isInvite
                                ? (msg.roomName || msg.body.split(':').pop()?.trim() || null)
                                : null;

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-lg relative group transition-all duration-300 ${
                                        isMe
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-tr-none'
                                            : 'bg-slate-900/80 text-slate-100 rounded-tl-none border border-white/10 backdrop-blur-md'
                                    }`}>
                                        {isInvite && roomName && onJoinCall ? (
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-sm">📞 Дуудлага хийх хүсэлт</p>
                                                <p className="text-xs text-white/80">{msg.body.split(':')[0]}</p>
                                                <button
                                                    onClick={() => onJoinCall(roomName)}
                                                    className="mt-1 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-inner"
                                                >
                                                    <Video className="w-3.5 h-3.5 fill-white" />
                                                    Холбогдох
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                        )}
                                        <div className="flex items-center justify-end gap-1.5 mt-1">
                                            <span className={`text-[9px] block text-right font-medium ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isMe && (
                                                <span className="text-[9px] text-white/50">
                                                    {msg.status === 'read' ? '✓✓' : '✓'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* Other party typing animation */}
                <AnimatePresence>
                    {otherPartyTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex justify-start items-center gap-2 text-slate-400 text-xs py-1"
                        >
                            <div className="bg-slate-900/80 border border-white/5 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-1.5 shadow-md">
                                <span className="text-xs font-medium text-slate-400">{otherPartyName} бичиж байна</span>
                                <div className="flex gap-1 items-center justify-center h-2">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-md">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder={t('chat', 'typeMessage')}
                        className="flex-1 bg-slate-800/80 border border-white/5 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500/50 text-sm outline-none transition-all shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 active:scale-95"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" strokeWidth={1.5} />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}