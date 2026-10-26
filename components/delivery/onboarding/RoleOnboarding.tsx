'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bike, ChevronRight, type LucideIcon } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import '@/app/delivery/delivery.css';

export type OnboardSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  accent: string;
};

type Props = {
  slides: readonly OnboardSlide[];
  brandLabel: string;
  finishLabel?: string;
  onFinish: () => void;
};

export default function RoleOnboarding({
  slides,
  brandLabel,
  finishLabel = 'Эхлэх',
  onFinish,
}: Props) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const Icon = slide.icon;
  const isLast = index === slides.length - 1;

  const goNext = () => {
    triggerHaptic();
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  };

  const skip = () => {
    triggerHaptic();
    onFinish();
  };

  return (
    <div className="auth-cream ios-root min-h-[100dvh]">
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#ff4500] text-white">
              <Bike className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <span className="text-[14px] font-extrabold tracking-tight text-[var(--auth-ink)]">
              {brandLabel}
            </span>
          </div>
          {!isLast && (
            <button
              type="button"
              onClick={skip}
              className="text-[14px] font-bold text-[var(--auth-muted)]"
            >
              Алгасах
            </button>
          )}
        </div>

        <div className="relative mt-6 flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="flex flex-1 flex-col"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) goNext();
                if (info.offset.x > 60 && index > 0) {
                  triggerHaptic();
                  setIndex((i) => i - 1);
                }
              }}
            >
              <div className="relative mx-auto flex h-[42vh] min-h-[240px] w-full max-w-sm items-center justify-center overflow-hidden rounded-[32px] bg-[rgba(255,69,0,0.08)]">
                <motion.div
                  className={`absolute inset-8 rounded-[28px] bg-gradient-to-br ${slide.accent} opacity-95 shadow-lg`}
                  initial={{ scale: 0.88, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.95 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                />
                <motion.div
                  initial={{ scale: 0.7, y: 18, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 16, delay: 0.06 }}
                  className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[28px] bg-white shadow-[0_16px_40px_rgba(28,25,23,0.16)]"
                >
                  <Icon className="h-12 w-12 text-[var(--auth-ink)]" strokeWidth={2} />
                </motion.div>
              </div>

              <div className="mt-8">
                <p className="auth-eyebrow">{slide.eyebrow}</p>
                <h1 className="auth-title mt-2 whitespace-pre-line">{slide.title}</h1>
                <p className="auth-subtitle mt-3">{slide.body}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Слайд ${i + 1}`}
                onClick={() => {
                  triggerHaptic();
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-[#ff4500]' : 'w-1.5 bg-[#d6d3d1]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[#ff4500] px-5 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(255,69,0,0.28)]"
          >
            {isLast ? finishLabel : 'Үргэлжлүүлэх'}
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}
