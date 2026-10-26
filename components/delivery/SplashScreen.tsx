'use client';

import { motion } from 'framer-motion';
import { Bike } from 'lucide-react';
import '@/app/delivery/delivery.css';

/** Cream brand splash — first impression */
export default function SplashScreen({ onDone }: { onDone?: () => void }) {
  return (
    <motion.div
      className="auth-cream fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-[#ff4500]/15 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -right-16 bottom-24 h-56 w-56 rounded-full bg-[#ff6a33]/20 blur-3xl"
        animate={{ y: [0, -18, 0], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 18, mass: 0.85 }}
        className="auth-hero-mark relative"
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
        >
          <Bike className="h-12 w-12 text-[#ff4500]" strokeWidth={2.2} />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 text-center px-6"
      >
        <p className="text-[32px] font-extrabold tracking-tight text-[var(--auth-ink,#1c1917)]">
          Soyol <span className="text-[#ff4500]">Delivery</span>
        </p>
        <p className="mt-2 text-[15px] font-semibold text-[var(--auth-muted,#78716c)]">
          Хурдан · найдвартай хүргэлт
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="absolute bottom-14 left-0 right-0 flex flex-col items-center gap-3"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="h-1 w-14 overflow-hidden rounded-full bg-[rgba(28,25,23,0.12)]">
          <motion.div
            className="h-full rounded-full bg-[#ff4500]"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.75, ease: 'easeInOut' }}
            onAnimationComplete={() => onDone?.()}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
