'use client';

import { motion } from 'framer-motion';
import { Loader2, MapPin, Navigation, X } from 'lucide-react';
import { formatMoneyMNT } from '@/lib/delivery/payout';
import { triggerHaptic } from '@/lib/haptics';

export type BounceOrder = {
  id: string;
  code: string;
  dropoffText: string;
  district?: string | null;
  distanceM?: number;
  etaMin?: number;
  courierPayout?: number | null;
  courierTip?: number;
  courierBonus?: number;
};

function formatDistance(m?: number | null) {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 100) return `${Math.max(0, Math.round(m))}м`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} км`;
}

function payoutOf(o: BounceOrder) {
  return (
    Number(o.courierPayout || 0) + Number(o.courierTip || 0) + Number(o.courierBonus || 0)
  );
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, seconds / total));
  const offset = c * (1 - progress);

  return (
    <div className="relative h-12 w-12 shrink-0" aria-label={`${seconds} секунд`}>
      <svg viewBox="0 0 56 56" className="h-12 w-12 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,69,0,0.14)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#ff4500"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold tabular-nums text-[#ff4500]">
        {seconds}
      </span>
    </div>
  );
}

/** Appetizing bounce sheet when admin releases a new delivery order */
export default function NewOrderBounceSheet({
  order,
  countdown,
  countdownTotal = 60,
  accepting,
  onAccept,
  onReject,
  onLater,
}: {
  order: BounceOrder;
  countdown: number;
  countdownTotal?: number;
  accepting?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onLater: () => void;
}) {
  const pay = payoutOf(order);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="dl-fixed-overlay fixed inset-0 z-[130] flex items-end justify-center px-3"
      style={{
        paddingBottom: 'max(88px, calc(env(safe-area-inset-bottom) + 72px))',
        background: 'rgba(15, 23, 42, 0.48)',
      }}
      onClick={onLater}
    >
      <motion.div
        initial={{ y: 120, scale: 0.86, opacity: 0 }}
        animate={{
          y: 0,
          scale: 1,
          opacity: 1,
          transition: {
            type: 'spring',
            stiffness: 420,
            damping: 16,
            mass: 0.85,
          },
        }}
        exit={{
          y: 80,
          scale: 0.92,
          opacity: 0,
          transition: { duration: 0.2, ease: 'easeIn' },
        }}
        className="dl-bounce-sheet relative w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ff6a33] via-[#ff4500] to-[#ff8a5c]" />

        <div className="px-5 pb-4 pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--ios-separator)]" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 }}
                className="text-[13px] font-bold text-[var(--ios-brand)]"
              >
                Шинэ захиалга
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 380, damping: 20 }}
                className="mt-1 text-[28px] font-extrabold tracking-tight text-[var(--ios-label)]"
              >
                {order.code}
              </motion.p>
              {order.district && (
                <span className="mt-2 inline-flex rounded-full bg-[var(--ios-fill)] px-2.5 py-1 text-[11px] font-bold text-[var(--ios-secondary)]">
                  {order.district}
                </span>
              )}
            </div>
            <div className="flex items-start gap-2">
              <CountdownRing seconds={countdown} total={countdownTotal} />
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  onReject();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ios-fill)] text-[var(--ios-secondary)]"
                aria-label="Татгалзах"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl bg-[var(--ios-fill-secondary)]"
          >
            <div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
              <Navigation className="h-3.5 w-3.5 text-[var(--ios-brand)]" />
              <p className="text-[15px] font-extrabold tabular-nums text-[var(--ios-label)]">
                {formatDistance(order.distanceM)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ios-tertiary)]">Зай</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x border-[var(--ios-separator)] px-2 py-3 text-center">
              <p className="text-[15px] font-extrabold tabular-nums text-[var(--ios-label)]">
                {order.etaMin != null ? `~${order.etaMin} мин` : '—'}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ios-tertiary)]">ETA</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-[rgba(255,69,0,0.1)] px-2 py-3 text-center">
              <p className="text-[15px] font-extrabold tabular-nums text-[var(--ios-brand)]">
                {formatMoneyMNT(pay)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ios-tertiary)]">Орлого</p>
            </div>
          </motion.div>

          <div className="mt-3.5 flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--ios-brand)]" strokeWidth={2.4} />
            <p className="text-[14px] font-medium leading-snug text-[var(--ios-secondary)]">
              {order.dropoffText || 'Хаяг байхгүй'}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, type: 'spring', stiffness: 360, damping: 22 }}
            className="mt-4 grid grid-cols-[48px_1fr] gap-2.5"
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onReject();
              }}
              className="flex h-12 items-center justify-center rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] text-[var(--ios-secondary)]"
              aria-label="Татгалзах"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={accepting}
              onClick={() => {
                triggerHaptic();
                onAccept();
              }}
              className="flex h-12 items-center justify-center rounded-[14px] bg-[#ff4500] text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(255,69,0,0.28)] disabled:opacity-60"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Хүлээн авах'}
            </button>
          </motion.div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onLater();
            }}
            className="mt-1 w-full py-2.5 text-center text-[14px] font-semibold text-[var(--ios-secondary)]"
          >
            Дараа үзэх
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
