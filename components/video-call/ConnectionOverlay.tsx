'use client';

import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConnectionOverlayProps {
    state: 'connecting' | 'reconnecting' | 'failed';
    onRetry?: () => void;
}

export default function ConnectionOverlay({ state, onRetry }: ConnectionOverlayProps) {
    if (!state) return null;

    const overlayDetails = {
        connecting: {
            title: 'Холбогдож байна...',
            description: 'Дуудлагын өрөөнд холбогдож байна. Түр хүлээнэ үү.',
            icon: <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />,
            bgColor: 'bg-slate-950/70'
        },
        reconnecting: {
            title: 'Дахин холбогдож байна...',
            description: 'Сүлжээ тасарлаа. Дахин холбогдохыг оролдож байна.',
            icon: <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />,
            bgColor: 'bg-slate-950/80'
        },
        failed: {
            title: 'Холболт амжилтгүй',
            description: 'Өрөөнд холбогдож чадсангүй. Та сүлжээгээ шалгаад дахин оролдоно уу.',
            icon: <WifiOff className="w-8 h-8 text-red-500" />,
            bgColor: 'bg-slate-950/90'
        }
    };

    const details = overlayDetails[state];

    return (
        <div className={`absolute inset-0 ${details.bgColor} backdrop-blur-md flex items-center justify-center z-50 transition-all duration-300`}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full mx-4 p-6 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-4"
            >
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center shadow-inner">
                    {details.icon}
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white tracking-wide">{details.title}</h3>
                    <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed mx-auto">
                        {details.description}
                    </p>
                </div>

                {state === 'failed' && onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Дахин оролдох
                    </button>
                )}
            </motion.div>
        </div>
    );
}
