'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { useRoomChat } from '@/hooks/useRoomChat';
import { useUser } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatPanelProps {
    roomId: string;
    conversationId?: string;
    isOpen: boolean;
    onClose: () => void;
    layoutMode?: 'fixed' | 'inline';
}

export default function ChatPanel({ roomId, conversationId, isOpen, onClose, layoutMode = 'fixed' }: ChatPanelProps) {
    const { user } = useUser();
    const [text, setText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const { messages, sendMessage, resetUnread } = useRoomChat(
        roomId,
        conversationId,
        user?.id,
        user?.name || 'Guest'
    );

    // Reset unread count whenever the panel is opened
    useEffect(() => {
        if (isOpen) {
            resetUnread();
        }
    }, [isOpen, messages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        sendMessage(text);
        setText('');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={layoutMode === 'inline' ? { opacity: 0, width: 0 } : { x: 320, opacity: 0 }}
                    animate={layoutMode === 'inline' ? { opacity: 1, width: 'auto' } : { x: 0, opacity: 1 }}
                    exit={layoutMode === 'inline' ? { opacity: 0, width: 0 } : { x: 320, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={layoutMode === 'inline'
                        ? "h-full w-full bg-slate-950/80 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden"
                        : "fixed right-4 top-20 bottom-24 w-80 md:w-96 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
                    }
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-amber-500" />
                            <h3 className="font-bold text-white text-sm">Шууд чат</h3>
                            <span className="bg-slate-800 text-[10px] text-slate-300 px-2 py-0.5 rounded-full border border-white/5 font-mono">
                                {messages.length}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none"
                    >
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-xs">Зурвас хараахан байхгүй байна.</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.senderId === user?.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <span className="text-[10px] text-slate-500 mb-0.5 px-1">
                                                {msg.senderName}
                                            </span>
                                            <div
                                                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-md ${
                                                    isMe
                                                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-tr-none'
                                                        : 'bg-slate-900 border border-white/5 text-slate-200 rounded-tl-none'
                                                }`}
                                            >
                                                <p>{msg.body}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-slate-950/40">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Зурвас бичих..."
                                className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500/50 text-xs outline-none transition-all shadow-inner"
                            />
                            <button
                                type="submit"
                                disabled={!text.trim()}
                                className="p-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
