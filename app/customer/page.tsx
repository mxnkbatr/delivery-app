'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  MapPinned,
  Package,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import {
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';
import { CourierSnippet, type CustomerCourierInfo } from '@/components/delivery/CustomerCourierCard';

const STATUS_MN: Record<string, string> = {
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж байна',
  shipped: 'Хүргэлтэнд явж байна',
  delivered: 'Хүргэгдсэн',
};

type DeliveryItem = {
  name: string;
  qty: number;
  price: number | null;
  image: string | null;
};

type MyOrder = {
  id: string;
  code: string;
  status: string;
  statusLabel?: string;
  paidAt: string | null;
  total: number;
  deliveryOtp: string | null;
  shipping: { text: string };
  items: DeliveryItem[];
  courier?: CustomerCourierInfo | null;
};

type PendingOrder = {
  id: string;
  code: string;
  total: number;
  itemsCount: number;
  paymentMethod: string | null;
};

function statusChipClass(status: string) {
  if (status === 'shipped') return 'dl-chip dl-chip-brand';
  if (status === 'delivered') return 'dl-chip dl-chip-cyan';
  return 'dl-chip dl-chip-green';
}

function OtpCard({ code, orderCode }: { code: string; orderCode: string }) {
  return (
    <div className="dl-otp-card mx-4 mb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--ios-brand)]" />
          <p className="text-[12px] font-semibold text-white/55">
            Хүлээн авах код · {orderCode}
          </p>
        </div>
        <span className="dl-live-dot" aria-hidden />
      </div>
      <p className="mt-4 text-center text-[46px] font-bold tracking-[0.35em] tabular-nums">
        {code}
      </p>
      <p className="mt-2 text-center text-[12px] text-white/45">
        Хүргэгчид энэ 4 оронтой кодыг хэлнэ үү
      </p>
    </div>
  );
}

function OrderCard({ order }: { order: MyOrder }) {
  const preview = order.items.slice(0, 3);
  const isLive = order.status === 'shipped';
  return (
    <Link
      href={`/customer/orders/${order.id}`}
      className="dl-card block transition-transform active:scale-[0.985]"
    >
      <div className="dl-card-accent" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[20px] font-bold tracking-tight">{order.code}</p>
              {isLive && <span className="dl-live-dot" aria-label="Live" />}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={statusChipClass(order.status)}>
                {order.statusLabel || STATUS_MN[order.status] || order.status}
              </span>
              {order.deliveryOtp && (
                <span className="rounded-full bg-black px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-white">
                  {order.deliveryOtp}
                </span>
              )}
            </div>
          </div>
          <div className="dl-price-box shrink-0">
            <p className="text-[11px] font-semibold text-[var(--ios-secondary)]">Дүн</p>
            <p className="text-[18px] font-bold tabular-nums text-[var(--ios-brand)]">
              ₮{Number(order.total || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="dl-section-soft mt-3">
          <div className="flex gap-2">
            {preview.map((it, idx) => (
              <div
                key={idx}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-white shadow-sm ring-1 ring-black/[0.04]"
              >
                {it.image ? (
                  <Image
                    src={it.image}
                    alt={it.name}
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
                <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[9px] font-bold text-white">
                  ×{it.qty}
                </span>
              </div>
            ))}
            <div className="min-w-0 flex-1 self-center pl-1">
              <p className="truncate text-[13px] font-semibold">
                {order.items.map((i) => i.name).join(', ')}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ios-secondary)]">
                {order.items.length} бараа
              </p>
            </div>
          </div>
        </div>

        <CourierSnippet courier={order.courier} statusLabel={order.statusLabel} />

        <div className="mt-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-[var(--ios-brand)]" />
          <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--ios-secondary)]">
            {order.shipping.text || 'Хаяг'}
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ios-tertiary)]" />
        </div>
      </div>
    </Link>
  );
}

export default function CustomerHomePage() {
  const { user, isLoading, isAuthenticated, isCourier, isAdmin } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [tab, setTab] = useState<'active' | 'past'>('active');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/sign-in?as=customer');
      return;
    }
    if (isCourier && !isAdmin) {
      void import('@/lib/delivery/onboarding').then(({ resolvePostAuthPath }) =>
        resolvePostAuthPath('courier').then((p) => router.replace(p))
      );
      return;
    }
    try {
      if (localStorage.getItem('soyol_onboard_customer_v1') !== '1') {
        router.replace('/onboarding/customer');
      }
    } catch {
      /* ignore */
    }
  }, [isLoading, isAuthenticated, isCourier, isAdmin, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const fetchOrders = async (silent = false) => {
      if (!silent) setLoadingOrders(true);
      try {
        const res = await authFetch('/api/delivery/my-orders');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!cancelled) {
          setOrders(data.orders || []);
          setPending(data.pendingPayment || []);
        }
      } catch {
        if (!cancelled && !silent) {
          setOrders([]);
          setPending([]);
        }
      } finally {
        if (!cancelled && !silent) setLoadingOrders(false);
      }
    };

    fetchOrders();
    const t = setInterval(() => fetchOrders(true), 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) return <IOSSpinnerScreen />;

  const active = orders.filter((o) => o.status !== 'delivered');
  const past = orders.filter((o) => o.status === 'delivered');
  const trackable = active.filter((o) =>
    ['confirmed', 'processing', 'shipped'].includes(o.status)
  );
  const withOtp = active.filter((o) => o.deliveryOtp);
  const firstName = (user?.name || 'Хэрэглэгч').split(' ')[0];

  return (
    <IOSScreen className="pb-28">
      <div className="px-5 pt-2">
        <p className="text-[13px] font-semibold text-[var(--ios-secondary)]">Сайн байна уу</p>
        <h1 className="mt-0.5 text-[32px] font-bold tracking-tight">{firstName}</h1>
        <p className="mt-1 text-[14px] font-medium text-[var(--ios-secondary)]">
          Захиалга · хүргэгч · хүлээн авах код
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 px-4">
        <div className="dl-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-white">
            <Package className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[26px] font-bold leading-none tracking-tight">{active.length}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-[var(--ios-secondary)]">Идэвхтэй</p>
        </div>
        <Link href="/customer/track" className="dl-card p-3.5 transition-transform active:scale-[0.98]">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#38bdf8] to-[#0284c7] text-white">
            <MapPinned className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[26px] font-bold leading-none tracking-tight">{trackable.length}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-[var(--ios-secondary)]">Track</p>
        </Link>
        <div className="dl-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#4ade80] to-[#16a34a] text-white">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[26px] font-bold leading-none tracking-tight">{past.length}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-[var(--ios-secondary)]">Хүргэгдсэн</p>
        </div>
      </div>

      {withOtp[0] && (
        <div className="mt-4">
          <OtpCard code={withOtp[0].deliveryOtp!} orderCode={withOtp[0].code} />
        </div>
      )}

      {loadingOrders ? (
        <div className="flex justify-center py-16">
          <div className="ios-spinner" />
        </div>
      ) : (
        <div className="mt-2 px-4">
          <div className="dl-hub-tabs !mx-0">
            <button
              type="button"
              className={`dl-hub-tab ${tab === 'active' ? 'dl-hub-tab-active' : ''}`}
              onClick={() => setTab('active')}
            >
              Идэвхтэй
              <span className="dl-hub-tab-count">{active.length}</span>
            </button>
            <button
              type="button"
              className={`dl-hub-tab ${tab === 'past' ? 'dl-hub-tab-active' : ''}`}
              onClick={() => setTab('past')}
            >
              Түүх
              <span className="dl-hub-tab-count">{past.length}</span>
            </button>
          </div>

          {pending.length > 0 && tab === 'active' && (
            <section className="mt-4">
              <p className="mb-2.5 text-[13px] font-bold text-[var(--ios-secondary)]">
                Төлбөр хүлээгдэж буй
              </p>
              <div className="space-y-2.5">
                {pending.map((o) => (
                  <div key={o.id} className="dl-card flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[rgba(245,158,11,0.15)] text-[var(--ios-orange)]">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold">{o.code}</p>
                      <p className="text-[12px] text-[var(--ios-secondary)]">
                        {o.itemsCount} бараа · баталгаажаагүй
                      </p>
                    </div>
                    <p className="text-[14px] font-bold text-[var(--ios-brand)]">
                      ₮{Number(o.total || 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-4">
            {tab === 'active' ? (
              active.length === 0 ? (
                <div className="dl-card px-5 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(255,69,0,0.1)]">
                    <Package className="h-7 w-7 text-[var(--ios-brand)]" />
                  </div>
                  <p className="mt-4 text-[17px] font-bold">Одоогоор бараа алга</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-[var(--ios-secondary)]">
                    Дэлгүүрээс захиалга хийж төлбөрөө төлсний дараа энд харагдана.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {active.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              )
            ) : past.length === 0 ? (
              <div className="dl-card px-5 py-10 text-center">
                <p className="text-[14px] text-[var(--ios-secondary)]">Хүргэгдсэн захиалга алга</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {past.map((o) => (
                  <Link
                    key={o.id}
                    href={`/customer/orders/${o.id}`}
                    className="dl-card flex items-center gap-3 p-4 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(34,197,94,0.14)] text-[#16a34a]">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold">{o.code}</p>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--ios-secondary)]">
                        {o.items.map((i) => i.name).join(', ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="dl-chip dl-chip-cyan">{STATUS_MN.delivered}</span>
                      <p className="mt-1.5 text-[13px] font-bold tabular-nums text-[var(--ios-brand)]">
                        ₮{Number(o.total || 0).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </IOSScreen>
  );
}
