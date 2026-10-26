'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Package,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import {
  IOSLargeTitle,
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';

type HistoryOrder = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  dropoffText: string;
  courierPayout: number | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

const STATUS_MN: Record<string, string> = {
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

function formatTime(iso?: string | null) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${date} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

export default function HistoryPage() {
  const { isLoading, isAuthenticated, isCourier, isAdmin } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
        const res = await authFetch('/api/delivery/courier/history');
        const data = await res.json();
        if (!cancelled && res.ok) {
          setOrders(data.orders || []);
          setEarnings(data.summary?.earnings || 0);
          setDeliveredCount(data.summary?.count || 0);
        }
      } catch {
        if (!cancelled) setOrders([]);
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

  return (
    <IOSScreen className="pb-28">
      <IOSLargeTitle
        title="Түүх"
        subtitle="Хүргэсэн · цуцлагдсан захиалга"
      />

      <div className="mx-4 mt-1 grid grid-cols-2 gap-2.5">
        <div className="dl-card p-4">
          <p className="text-[12px] font-semibold text-[var(--ios-secondary)]">Нийт орлого</p>
          <p className="mt-1 text-[22px] font-bold text-[var(--ios-brand)]">
            {earnings > 0 ? `₮${Number(earnings).toLocaleString('mn-MN')}` : '—'}
          </p>
        </div>
        <div className="dl-card p-4">
          <p className="text-[12px] font-semibold text-[var(--ios-secondary)]">Хүргэсэн</p>
          <p className="mt-1 text-[22px] font-bold">{deliveredCount}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2 px-4">
        <Link
          href="/earnings"
          className="flex-1 rounded-[14px] bg-white py-2.5 text-center text-[13px] font-bold text-[var(--ios-brand)] ring-1 ring-black/[0.06]"
        >
          Өдөр / 7 хоног
        </Link>
        <Link
          href="/earnings"
          className="flex-1 rounded-[14px] bg-[rgba(255,69,0,0.1)] py-2.5 text-center text-[13px] font-bold text-[var(--ios-brand)]"
        >
          Tip · бонус
        </Link>
      </div>

      <div className="mt-5 px-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[17px] font-bold">Сүүлийн үйл ажиллагаа</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="ios-spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="dl-card px-5 py-12 text-center">
            <Package className="mx-auto h-9 w-9 text-[var(--ios-tertiary)]" />
            <p className="mt-3 text-[15px] font-semibold">Түүх хоосон</p>
            <p className="mt-1 text-[13px] text-[var(--ios-secondary)]">
              Хүргэлт дууссаны дараа энд харагдана.
            </p>
            <Link href="/work" className="mt-4 inline-block text-[14px] font-bold text-[var(--ios-brand)]">
              Ажил руу очих →
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <div key={o.id} className="dl-card flex items-center gap-3 p-3.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    o.status === 'delivered'
                      ? 'bg-[rgba(34,197,94,0.15)] text-[#16a34a]'
                      : 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'
                  }`}
                >
                  {o.status === 'delivered' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold">{o.code}</p>
                    <span className="text-[11px] text-[var(--ios-tertiary)]">
                      {formatTime(o.deliveredAt || o.updatedAt || o.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[14px] font-semibold">{o.customerName}</p>
                  <p className="truncate text-[12px] text-[var(--ios-secondary)]">
                    {o.dropoffText || 'Хаяг'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      o.status === 'delivered'
                        ? 'bg-[rgba(34,197,94,0.14)] text-[#15803d]'
                        : 'bg-[rgba(239,68,68,0.12)] text-[#dc2626]'
                    }`}
                  >
                    {STATUS_MN[o.status] || o.status}
                  </span>
                  {o.courierPayout != null && o.courierPayout > 0 && o.status === 'delivered' && (
                    <p className="mt-1.5 text-[14px] font-bold">
                      ₮{Number(o.courierPayout).toLocaleString('mn-MN')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </IOSScreen>
  );
}
