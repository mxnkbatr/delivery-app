'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gift, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import {
  IOSLargeTitle,
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';
import { triggerHaptic } from '@/lib/haptics';

type Earnings = {
  today: { count: number; payout: number; tip: number; bonus: number; total: number };
  week: { count: number; payout: number; tip: number; bonus: number; total: number };
  stats: {
    acceptanceRate: number;
    acceptedCount: number;
    rejectedCount: number;
    totalDeliveries: number;
    rating: number;
  };
};

type Range = 'today' | 'week';

function money(n: number) {
  if (!n) return '—';
  return `₮${n.toLocaleString('mn-MN')}`;
}

export default function EarningsPage() {
  const { isLoading, isAuthenticated, isCourier, isAdmin } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('today');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=courier');
    else if (!isCourier && !isAdmin) router.replace('/customer');
  }, [isLoading, isAuthenticated, isCourier, isAdmin, router]);

  useEffect(() => {
    if (!isAuthenticated || (!isCourier && !isAdmin)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/delivery/courier/earnings');
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCourier, isAdmin]);

  if (isLoading || !isAuthenticated || (!isCourier && !isAdmin)) {
    return <IOSSpinnerScreen />;
  }

  const block = range === 'today' ? data?.today : data?.week;

  return (
    <IOSScreen className="pb-28">
      <IOSLargeTitle title="Орлого" subtitle="Үндсэн · Tip · Бонус" />

      <div className="mx-4 flex gap-2">
        {(
          [
            { id: 'today', label: 'Өнөөдөр' },
            { id: 'week', label: '7 хоног' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              triggerHaptic();
              setRange(t.id);
            }}
            className={`flex-1 rounded-[14px] py-2.5 text-[14px] font-bold ${
              range === t.id
                ? 'bg-[var(--ios-brand)] text-white shadow-md'
                : 'bg-white text-[#6b7280] ring-1 ring-black/[0.06]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !data || !block ? (
        <div className="flex justify-center py-16">
          <div className="ios-spinner" />
        </div>
      ) : (
        <div className="mt-4 space-y-4 px-4">
          <div className="dl-card overflow-hidden">
            <div className="bg-gradient-to-br from-[#ff7a45] to-[#ff4500] p-5 text-white">
              <p className="text-[13px] font-semibold text-white/80">
                {range === 'today' ? 'Өнөөдөр' : 'Сүүлийн 7 хоног'}
              </p>
              <p className="mt-1 text-[34px] font-extrabold tracking-tight">
                {money(block.total)}
              </p>
              <p className="mt-1 text-[12px] text-white/75">{block.count} хүргэлт</p>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              <div className="rounded-[16px] bg-[#f8fafc] p-3 text-center">
                <Wallet className="mx-auto h-4 w-4 text-[var(--ios-brand)]" />
                <p className="mt-1 text-[14px] font-bold">{money(block.payout)}</p>
                <p className="text-[10px] font-bold text-[var(--ios-tertiary)]">Үндсэн</p>
              </div>
              <div className="rounded-[16px] bg-[#f8fafc] p-3 text-center">
                <Gift className="mx-auto h-4 w-4 text-[var(--ios-cyan)]" />
                <p className="mt-1 text-[14px] font-bold">{money(block.tip)}</p>
                <p className="text-[10px] font-bold text-[var(--ios-tertiary)]">Tip</p>
              </div>
              <div className="rounded-[16px] bg-[#f8fafc] p-3 text-center">
                <Sparkles className="mx-auto h-4 w-4 text-[#16a34a]" />
                <p className="mt-1 text-[14px] font-bold">{money(block.bonus)}</p>
                <p className="text-[10px] font-bold text-[var(--ios-tertiary)]">Бонус</p>
              </div>
            </div>
          </div>

          <div className="dl-card grid grid-cols-2 gap-3 p-4">
            <div>
              <p className="text-[12px] text-[var(--ios-secondary)]">Хүлээн авах хувь</p>
              <p className="mt-1 text-[24px] font-extrabold">{data.stats.acceptanceRate}%</p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--ios-secondary)]">Үнэлгээ</p>
              <p className="mt-1 text-[24px] font-extrabold">{data.stats.rating}★</p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--ios-secondary)]">Авсан</p>
              <p className="mt-1 text-[18px] font-bold">{data.stats.acceptedCount}</p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--ios-secondary)]">Татгалзсан</p>
              <p className="mt-1 text-[18px] font-bold">{data.stats.rejectedCount}</p>
            </div>
          </div>

          <Link href="/history" className="dl-cta">
            Хүргэлтийн түүх
          </Link>
        </div>
      )}
    </IOSScreen>
  );
}
