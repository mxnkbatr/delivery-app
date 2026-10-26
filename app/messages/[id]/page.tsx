'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SupportChatWindow from '@/components/Chat/SupportChatWindow';
import VideoCall from '@/components/VideoCall';
import { useUser } from '@/context/AuthContext';

interface MessagePageProps {
    params: Promise<{ id: string }>;
}

export default function MessagePage({ params }: MessagePageProps) {
    const { id } = use(params);
    const router = useRouter();
    const { isLoaded } = useUser();

    const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null);
    const [guestId, setGuestId] = useState<string>('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            let idVal = localStorage.getItem('soyol-guest-id');
            if (!idVal) {
                idVal = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                localStorage.setItem('soyol-guest-id', idVal);
            }
            setGuestId(idVal);
        }
    }, []);

    if (!isLoaded || !guestId) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-orange-500 w-8 h-8" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 relative">
            {/* Header */}
            <header className="border-b border-white/5 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-20 shrink-0">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button
                        onClick={() => router.push('/messages')}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Буцах"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-white tracking-tight">
                        Тусламжийн чат #{id.slice(-4)}
                    </h1>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-4 h-[calc(100vh-80px)] flex flex-col justify-start">
                <SupportChatWindow
                    conversationId={id}
                    guestId={guestId}
                    onBack={() => router.push('/messages')}
                    onJoinCall={setActiveCallRoom}
                />
            </main>

            {activeCallRoom && (
                <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
                    <VideoCall
                        prefilledRoom={activeCallRoom}
                        onDisconnected={() => setActiveCallRoom(null)}
                        onBack={() => setActiveCallRoom(null)}
                    />
                </div>
            )}
        </div>
    );
}