'use client';

import { useState } from 'react';
import { VideoConference, RoomAudioRenderer, useParticipants } from '@livekit/components-react';
import { MessageSquare, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import ChatPanel from './ChatPanel';

interface VideoCallRoomProps {
    roomId: string;
    conversationId?: string;
    identity: string;
    onLeave?: () => void;
}

export default function VideoCallRoom({ roomId, conversationId, identity, onLeave }: VideoCallRoomProps) {
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <div className="relative flex flex-col md:flex-row h-full w-full bg-black overflow-hidden rounded-[2.5rem]">
            {/* LiveKit Video Interface */}
            <div className="flex-1 relative flex flex-col min-h-0 min-w-0">
                <VideoConference />
                <RoomAudioRenderer />
                
                {/* Overlay Moderator Controls */}
                <BanControls currentRoom={roomId} currentIdentity={identity} />

                {/* Floating Chat Panel Button */}
                {!isChatOpen && (
                    <div className="absolute bottom-4 right-4 z-40">
                        <button
                            onClick={() => setIsChatOpen(true)}
                            className="p-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full shadow-lg transition-all active:scale-95 border border-white/10"
                            title="Чат нээх"
                        >
                            <MessageSquare className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </div>

            {/* Side-by-Side chat view (or overlay on smaller screens) */}
            {isChatOpen && (
                <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-white/10 bg-slate-950 flex flex-col shrink-0 relative h-[300px] md:h-full">
                    <ChatPanel
                        roomId={roomId}
                        conversationId={conversationId}
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                        layoutMode="inline"
                    />
                </div>
            )}
        </div>
    );
}

// Kick/Ban Capability Component
function BanControls({ currentRoom, currentIdentity }: { currentRoom: string; currentIdentity: string }) {
    const participants = useParticipants();
    const others = participants.filter((p) => p.identity !== currentIdentity);

    const handleKick = async (identity: string) => {
        try {
            const res = await fetch('/api/livekit/ban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName: currentRoom, identity }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Хэрэглэгчийг амжилттай өрөөнөөс гаргалаа');
            } else {
                toast.error('Гаргахад алдаа гарлаа: ' + data.error);
            }
        } catch (e) {
            toast.error('Гаргах хүсэлт илгээж чадсангүй');
        }
    };

    return (
        <div className="absolute top-2 left-2 z-40 flex flex-col gap-2 max-w-[200px]">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 w-fit">
                <span className="text-white text-[10px] font-semibold tracking-wide truncate block">
                    Өрөө: {currentRoom}
                </span>
            </div>

            {others.length > 0 && (
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/15">
                    <h4 className="text-[10px] text-white/50 mb-2 uppercase font-black tracking-widest">
                        Оролцогчид
                    </h4>
                    <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto scrollbar-none">
                        {others.map((p) => (
                            <div
                                key={p.identity}
                                className="flex items-center justify-between gap-3 text-white text-xs"
                            >
                                <span className="truncate max-w-[100px]">{p.identity}</span>
                                <button
                                    onClick={() => handleKick(p.identity)}
                                    title="Гаргах (Ban)"
                                    className="p-1 bg-red-500/20 hover:bg-red-500 rounded border border-red-500/30 text-red-400 hover:text-white transition-colors"
                                >
                                    <Ban className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
