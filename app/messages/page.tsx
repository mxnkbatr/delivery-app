'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { useUser } from '@/context/AuthContext';
import { MessageSquare, ArrowLeft, Loader2, Plus, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Conversation {
    _id: string;
    participants: string[];
    createdAt: string;
    lastMessageAt: string;
    lastMessage?: string;
    unreadCount?: number;
}

const fetcher = async (url: string) => {
    // Check for guest ID
    let guestId = '';
    if (typeof window !== 'undefined') {
        guestId = localStorage.getItem('soyol-guest-id') || '';
    }
    const headers: any = {};
    if (guestId) {
        headers['x-guest-id'] = guestId;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

function MessagesContent() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [creating, setCreating] = useState(false);

    // Generate/retrieve guest-id
    const getGuestId = (): string => {
        if (typeof window === 'undefined') return 'guest';
        let id = localStorage.getItem('soyol-guest-id');
        if (!id) {
            id = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            localStorage.setItem('soyol-guest-id', id);
        }
        return id;
    };

    const { data: conversations, error, mutate } = useSWR<Conversation[]>(
        '/api/messages/conversations',
        fetcher,
        { refreshInterval: 4000 }
    );

    const handleCreateConversation = async () => {
        setCreating(true);
        try {
            const guestId = getGuestId();
            const headers: any = { 'Content-Type': 'application/json' };
            if (guestId) {
                headers['x-guest-id'] = guestId;
            }

            const res = await fetch('/api/messages/conversations', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: 'Харилцагч холбогдлоо.',
                    senderName: user?.name || 'Зочин'
                })
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/messages/${data.conversation._id}`);
            } else {
                throw new Error('Failed to create support thread');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="animate-spin text-orange-500 w-8 h-8" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
            {/* Header */}
            <header className="border-b border-white/5 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-20 shrink-0">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-lg font-bold text-white tracking-tight">Мессежүүд</h1>
                    </div>
                    <button
                        onClick={handleCreateConversation}
                        disabled={creating}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Plus className="w-3.5 h-3.5" />
                        )}
                        Шинэ чат
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col justify-start">
                {conversations === undefined ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-orange-500 w-6 h-6" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
                            <MessageCircle className="w-8 h-8 opacity-40" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-white">Чат одоогоор байхгүй байна</h3>
                            <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
                                Тусламжийн багтай чатлахын тулд "Шинэ чат" товчийг дарна уу.
                            </p>
                        </div>
                        <button
                            onClick={handleCreateConversation}
                            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95"
                        >
                            Чат эхлүүлэх
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Харилцаанууд</h2>
                        <div className="grid gap-2">
                            {conversations.map((conv) => {
                                const hasUnread = conv.unreadCount && conv.unreadCount > 0;
                                const formattedTime = new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });

                                return (
                                    <Link
                                        key={conv._id}
                                        href={`/messages/${conv._id}`}
                                        className="group p-4 bg-slate-900 hover:bg-slate-800/80 border border-white/5 rounded-2xl transition-all flex items-center justify-between gap-4 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orange-500/10 to-amber-600/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform shrink-0">
                                                <MessageSquare className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white text-sm truncate">
                                                    Тусламжийн чат #{conv._id.slice(-4)}
                                                </h4>
                                                <p className="text-xs text-slate-400 truncate max-w-[260px] md:max-w-md mt-0.5">
                                                    {conv.lastMessage || 'Зурвас байхгүй'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                                            <span className="text-[10px] text-slate-500">
                                                {formattedTime}
                                            </span>
                                            {hasUnread && (
                                                <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-md animate-pulse">
                                                    {conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ClientMessagesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" /></div>}>
            <MessagesContent />
        </Suspense>
    );
}