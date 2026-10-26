'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, MapPinned, Navigation, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import {
  IOSLargeTitle,
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';
import { CourierSnippet, type CustomerCourierInfo } from '@/components/delivery/CustomerCourierCard';

type MyOrder = {
  id: string;
  code: string;
  status: string;
  statusLabel?: string;
  deliveryOtp: string | null;
  shipping: { text: string };
  total: number;
  courier?: CustomerCourierInfo | null;
};

const TRACKABLE = ['confirmed', 'processing', 'shipped'];

function statusChip(status: string) {
  if (status === 'shipped') return 'dl-chip dl-chip-brand';
  return 'dl-chip dl-chip-cyan';
}

export default function CustomerTrackListPage() {
  const { isLoading, isAuthenticated, isCourier } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=customer');
    if (isCourier) router.replace('/work');
  }, [isLoading, isAuthenticated, isCourier, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch('/api/delivery/my-orders');
        const data = await res.json();
        if (!cancelled) setOrders(data.orders || []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) return <IOSSpinnerScreen />;

  const trackable = orders.filter((o) => TRACKABLE.includes(o.status));

  return (
    <IOSScreen className="pb-28">
      <IOSLargeTitle title="Хүргэлт" subtitle="Live байршил · хүргэгч · чат" />

      <div className="mt-1 space-y-3 px-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="ios-spinner" />
          </div>
        ) : trackable.length === 0 ? (
          <div className="dl-card px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(2,132,199,0.12)]">
              <MapPinned className="h-7 w-7 text-[#0284c7]" />
            </div>
            <p className="mt-4 text-[17px] font-bold">Идэвхтэй хүргэлт алга</p>
            <p className="mt-1.5 text-[14px] text-[var(--ios-secondary)]">
              Захиалга баталгаажсаны дараа энд live харагдана.
            </p>
            <Link
              href="/customer"
              className="mt-5 inline-flex items-center gap-1 text-[14px] font-bold text-[var(--ios-brand)]"
            >
              Миний бараа
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          trackable.map((o) => (
            <Link
              key={o.id}
              href={`/delivery/track/${o.id}?token=demo`}
              className="dl-card block overflow-hidden transition-transform active:scale-[0.99]"
            >
              <div className="dl-track-map-strip">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-white" />
                  <p className="text-[12px] font-bold text-white/90">Live map нээх</p>
                </div>
                {o.status === 'shipped' && <span className="dl-live-dot dl-live-dot-on-dark" />}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="ios-icon-tile ios-icon-tile-cyan !h-12 !w-12 !rounded-[14px]">
                    <MapPinned className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[17px] font-bold">{o.code}</p>
                      <span className={statusChip(o.status)}>
                        {o.statusLabel || o.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[13px] text-[var(--ios-secondary)]">
                      {o.shipping?.text || 'Хаяг'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" strokeWidth={2.2} />
                </div>
                <CourierSnippet courier={o.courier} statusLabel={o.statusLabel} />
                {o.deliveryOtp && (
                  <div className="mt-3 flex items-center justify-between rounded-[14px] bg-[#111827] px-3.5 py-2.5">
                    <p className="text-[11px] font-semibold text-white/50">Хүлээн авах код</p>
                    <p className="text-[18px] font-bold tracking-[0.25em] text-white">
                      {o.deliveryOtp}
                    </p>
                  </div>
                )}
                {!o.courier && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--ios-tertiary)]">
                    <Package className="h-3 w-3" />
                    Хүргэгч томилогдоход энд харагдана
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </IOSScreen>
  );
}
