'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MapPin, Package, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import {
  IOSNavBack,
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';
import {
  CustomerCourierPanel,
  TrackCta,
  type CustomerCourierInfo,
} from '@/components/delivery/CustomerCourierCard';

const STATUS_MN: Record<string, string> = {
  pending: 'Төлбөр хүлээгдэж',
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж байна',
  shipped: 'Хүргэлтэнд явж байна',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

const TIMELINE = [
  { key: 'confirmed', label: 'Баталгаажсан' },
  { key: 'processing', label: 'Бэлтгэж байна' },
  { key: 'shipped', label: 'Хүргэлтэнд' },
  { key: 'delivered', label: 'Хүргэгдсэн' },
] as const;

type DetailOrder = {
  id: string;
  code: string;
  status: string;
  statusLabel?: string;
  total?: number;
  paidAt?: string | null;
  deliveryOtp?: string | null;
  shipping?: {
    text?: string;
    city?: string;
    district?: string;
    address?: string;
    street?: string;
  };
  items?: {
    name?: string;
    qty?: number;
    quantity?: number;
    image?: string | null;
    images?: string[];
  }[];
  courier?: CustomerCourierInfo | null;
};

function timelineIndex(status: string) {
  const i = TIMELINE.findIndex((s) => s.key === status);
  if (status === 'cancelled') return -1;
  if (i >= 0) return i;
  if (status === 'pending') return -1;
  return 0;
}

export default function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isLoading, isAuthenticated, isCourier } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<DetailOrder | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [openChat, setOpenChat] = useState(false);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('chat') === '1') {
        setOpenChat(true);
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=customer');
    if (isCourier) router.replace('/work');
  }, [isLoading, isAuthenticated, isCourier, router]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    let cancelled = false;

    const load = async (silent = false) => {
      try {
        const [listRes, otpRes] = await Promise.all([
          authFetch('/api/delivery/my-orders'),
          authFetch(`/api/delivery/orders/${id}/otp`),
        ]);
        if (!listRes.ok) throw new Error('nf');
        const data = await listRes.json();
        const found = (data.orders || []).find((o: DetailOrder) => o.id === id);
        if (!found) throw new Error('nf');
        if (!cancelled) setOrder(found);

        if (otpRes.ok) {
          const otpData = await otpRes.json();
          if (!cancelled) setOtp(otpData.otp || found.deliveryOtp || null);
        } else if (!cancelled) {
          setOtp(found.deliveryOtp || null);
        }
      } catch {
        if (!cancelled && !silent) setLoadError(true);
      }
    };

    load();
    const t = setInterval(() => load(true), 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated, id]);

  if (isLoading || (!order && !loadError)) return <IOSSpinnerScreen />;

  if (loadError || !order) {
    return (
      <IOSScreen className="flex flex-col items-center justify-center px-6 text-center">
        <p className="ios-title-2">Захиалга олдсонгүй</p>
        <Link href="/customer" className="mt-4 text-[17px] font-semibold text-[var(--ios-brand)]">
          Буцах
        </Link>
      </IOSScreen>
    );
  }

  const shipping = order.shipping || {};
  const address =
    shipping.text ||
    [shipping.city, shipping.district, shipping.address || shipping.street]
      .filter(Boolean)
      .join(', ');
  const canTrack = ['confirmed', 'processing', 'shipped'].includes(order.status);
  const items = order.items || [];
  const step = timelineIndex(order.status);
  const displayOtp = otp || order.deliveryOtp;

  return (
    <IOSScreen className="pb-28">
      <div className="flex items-center px-2 pb-1 pt-1">
        <IOSNavBack href="/customer" label="Миний бараа" />
      </div>

      <div className="px-5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="ios-large-title !text-[30px]">
              {order.code || `#${id.slice(-6).toUpperCase()}`}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={
                  order.status === 'shipped'
                    ? 'dl-chip dl-chip-brand'
                    : order.status === 'delivered'
                      ? 'dl-chip dl-chip-cyan'
                      : 'dl-chip dl-chip-green'
                }
              >
                {order.statusLabel || STATUS_MN[order.status] || order.status}
              </span>
              {order.status === 'shipped' && <span className="dl-live-dot" aria-label="Live" />}
            </div>
          </div>
          {order.total != null && (
            <div className="dl-price-box shrink-0">
              <p className="text-[11px] font-semibold text-[var(--ios-secondary)]">Дүн</p>
              <p className="text-[18px] font-bold tabular-nums text-[var(--ios-brand)]">
                ₮{Number(order.total).toLocaleString('mn-MN')}
              </p>
            </div>
          )}
        </div>
      </div>

      {step >= 0 && (
        <div className="dl-card mx-4 mb-4 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
            Явц
          </p>
          <div className="dl-timeline mt-4">
            {TIMELINE.map((s, i) => {
              const done = i <= step;
              const current = i === step;
              return (
                <div key={s.key} className="dl-timeline-step">
                  <div
                    className={`dl-timeline-dot ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                  />
                  {i < TIMELINE.length - 1 && (
                    <div className={`dl-timeline-line ${i < step ? 'is-done' : ''}`} />
                  )}
                  <p className={`dl-timeline-label ${done ? 'is-done' : ''}`}>{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {displayOtp && order.status !== 'delivered' && (
        <div className="dl-otp-card mx-4 mb-4">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-[var(--ios-brand)]" />
            <p className="text-[12px] font-semibold text-white/55">Хүлээн авах 4 оронтой код</p>
          </div>
          <p className="mt-3 text-center text-[48px] font-bold tracking-[0.4em] tabular-nums">
            {displayOtp}
          </p>
          <p className="mt-2 text-center text-[13px] text-white/50">
            Хүргэгчид энэ кодыг хэлнэ үү — ингэснээр хүргэлт баталгаажна
          </p>
        </div>
      )}

      {order.status === 'delivered' && (
        <div className="dl-card mx-4 mb-4 flex items-center gap-3 px-4 py-3.5">
          <CheckCircle2 className="h-5 w-5 text-[var(--ios-green)]" />
          <p className="text-[15px] font-semibold text-[var(--ios-green)]">
            Хүргэлт амжилттай дууссан
          </p>
        </div>
      )}

      <div className="space-y-3 px-4">
        <CustomerCourierPanel
          orderId={id}
          courier={order.courier}
          statusLabel={order.statusLabel}
          autoOpenChat={openChat}
        />

        <div className="dl-card p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(255,69,0,0.1)]">
              <MapPin className="h-4 w-4 text-[var(--ios-brand)]" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
                Хүргэлтийн хаяг
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">
                {address || 'Хаяг байхгүй'}
              </p>
            </div>
          </div>
        </div>

        <div className="dl-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
            Захиалсан бараа
          </p>
          <ul className="mt-3 space-y-3">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-[12px] bg-[var(--ios-fill)]">
                  {it.image || it.images?.[0] ? (
                    <Image
                      src={it.image || it.images![0]}
                      alt={it.name || 'Бараа'}
                      fill
                      className="object-cover"
                      sizes="56px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-[var(--ios-tertiary)]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{it.name || 'Бараа'}</p>
                  <p className="text-[12px] text-[var(--ios-secondary)]">
                    ×{it.quantity || it.qty || 1}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {order.total != null && (
            <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-3">
              <p className="text-[13px] font-semibold text-[var(--ios-secondary)]">Нийт дүн</p>
              <p className="text-[17px] font-bold text-[var(--ios-brand)]">
                ₮{Number(order.total).toLocaleString('mn-MN')}
              </p>
            </div>
          )}
        </div>

        {canTrack && <TrackCta orderId={id} />}
      </div>
    </IOSScreen>
  );
}
