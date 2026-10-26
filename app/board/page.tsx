'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  Package,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import { IOSScreen, IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { formatTime24 } from '@/lib/delivery/format';

type Kpis = {
  readyQueue: number;
  onDelivery: number;
  deliveredToday: number;
  cancelledToday: number;
  todayEarnings: number;
};

type Recent = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  dropoffText: string;
  courierPayout: number | null;
  deliveredAt: string | null;
  courierAcceptedAt: string | null;
  createdAt: string;
};

const STATUS_MN: Record<string, string> = {
  processing: 'Бэлэн',
  confirmed: 'Бэлэн',
  shipped: 'Хүргэлтэнд',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

function statusStyle(status: string) {
  if (status === 'delivered') return 'bg-[rgba(34,197,94,0.14)] text-[#15803d]';
  if (status === 'cancelled') return 'bg-[rgba(239,68,68,0.12)] text-[#dc2626]';
  if (status === 'shipped') return 'bg-[rgba(255,69,0,0.12)] text-[#ff4500]';
  return 'bg-[rgba(6,182,212,0.14)] text-[#0e7490]';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'delivered') {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)] text-[#16a34a]">
        <CheckCircle2 className="h-5 w-5" />
      </div>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(239,68,68,0.12)] text-[#ef4444]">
        <XCircle className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(255,69,0,0.12)] text-[var(--ios-brand)]">
      <Bike className="h-5 w-5" />
    </div>
  );
}

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  return `₮${Number(n).toLocaleString('mn-MN')}`;
}

export default function CourierDashboardPage() {
  const { isLoading, isAuthenticated, isCourier, isCustomer, isAdmin } = useAuth();
  const router = useRouter();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [bars, setBars] = useState<number[]>([]);
  const [barsMax, setBarsMax] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/welcome');
      return;
    }
    if (isCustomer && !isCourier && !isAdmin) router.replace('/customer');
  }, [isLoading, isAuthenticated, isCustomer, isCourier, isAdmin, router]);

  useEffect(() => {
    if (!isAuthenticated || (!isCourier && !isAdmin)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/delivery/courier/dashboard');
        const data = await res.json();
        if (!cancelled && res.ok) {
          setKpis(data.kpis);
          setRecent(data.recent || []);
          setBars(Array.isArray(data.earningsBars) ? data.earningsBars : []);
          setBarsMax(Number(data.earningsBarsMax) || 0);
        }
      } catch {
        if (!cancelled) {
          setKpis(null);
          setRecent([]);
          setBars([]);
          setBarsMax(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCourier, isAdmin]);

  if (isLoading || !isAuthenticated || (isCustomer && !isCourier && !isAdmin)) {
    return <IOSSpinnerScreen />;
  }

  const cards = [
    {
      label: 'Бэлэн',
      value: kpis?.readyQueue ?? '—',
      icon: Package,
      tint: 'from-[#ff7a45] to-[#ff4500]',
    },
    {
      label: 'Хүргэлтэнд',
      value: kpis?.onDelivery ?? '—',
      icon: Bike,
      tint: 'from-[#38bdf8] to-[#0284c7]',
    },
    {
      label: 'Хүргэсэн',
      value: kpis?.deliveredToday ?? '—',
      icon: CheckCircle2,
      tint: 'from-[#4ade80] to-[#16a34a]',
    },
    {
      label: 'Цуцлагдсан',
      value: kpis?.cancelledToday ?? '—',
      icon: XCircle,
      tint: 'from-[#f87171] to-[#dc2626]',
    },
  ];

  const earnings = Number(kpis?.todayEarnings || 0);
  const showChart = earnings > 0 && barsMax > 0;

  return (
    <IOSScreen className="pb-28">
      <div className="px-5 pt-2">
        <h1 className="text-[32px] font-bold tracking-tight">Хянах самбар</h1>
        <p className="mt-1 text-[14px] font-medium text-[var(--ios-secondary)]">
          Өнөөдрийн тойм
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="ios-spinner" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="dl-card p-3.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br ${c.tint} text-white`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-[28px] font-bold leading-none tracking-tight">
                    {c.value}
                  </p>
                  <p className="mt-1.5 text-[12px] font-semibold text-[var(--ios-secondary)]">
                    {c.label}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="dl-card mx-4 mt-4 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--ios-secondary)]">
                  Өнөөдрийн орлого
                </p>
                <p className="mt-1 text-[28px] font-bold tracking-tight text-[var(--ios-brand)]">
                  {formatMoney(earnings)}
                </p>
              </div>
              <Link
                href="/earnings"
                className="rounded-full bg-[rgba(255,69,0,0.1)] px-3 py-1.5 text-[12px] font-bold text-[var(--ios-brand)]"
              >
                Дэлгэрэнгүй
              </Link>
            </div>
            {showChart ? (
              <div className="mt-4 flex h-14 items-end gap-1.5">
                {bars.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-[#ff4500] to-[#ff9f0a] opacity-90"
                    style={{
                      height: `${Math.max(8, Math.round((v / barsMax) * 100))}%`,
                    }}
                    title={`₮${v.toLocaleString()}`}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-[14px] bg-[#f8fafc] px-3 py-4 text-center text-[13px] font-medium text-[var(--ios-secondary)]">
                Өнөөдөр хүргэсэн орлого хараахан алга
              </p>
            )}
          </div>

          <div className="mt-6 px-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[17px] font-bold">Сүүлийн үйл ажиллагаа</p>
              <Link href="/history" className="text-[13px] font-bold text-[var(--ios-brand)]">
                Бүгдийг үзэх
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="dl-card px-5 py-10 text-center">
                <Package className="mx-auto h-8 w-8 text-[var(--ios-tertiary)]" />
                <p className="mt-3 text-[14px] text-[var(--ios-secondary)]">Одоогоор түүх алга</p>
                <Link href="/work" className="mt-3 inline-block text-[14px] font-bold text-[var(--ios-brand)]">
                  Бэлэн бараа үзэх →
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recent.map((o) => (
                  <Link
                    key={o.id}
                    href={
                      o.status === 'shipped' || o.status === 'processing'
                        ? `/active/${o.id}`
                        : '/history'
                    }
                    className="dl-card flex items-center gap-3 p-3.5 active:scale-[0.99] transition-transform"
                  >
                    <StatusIcon status={o.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-bold">{o.code}</p>
                        <span className="text-[11px] tabular-nums text-[var(--ios-tertiary)]">
                          {formatTime24(o.deliveredAt || o.courierAcceptedAt || o.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[14px] font-semibold">{o.customerName}</p>
                      <p className="truncate text-[12px] text-[var(--ios-secondary)]">
                        {o.dropoffText || 'Хаяг'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle(o.status)}`}
                      >
                        {STATUS_MN[o.status] || o.status}
                      </span>
                      {o.courierPayout != null && o.courierPayout > 0 && (
                        <p className="mt-1.5 text-[14px] font-bold">
                          ₮{Number(o.courierPayout).toLocaleString('mn-MN')}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 px-4">
            <Link href="/work" className="dl-cta">
              Хүргэхэд бэлэн бараа
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </>
      )}
    </IOSScreen>
  );
}
