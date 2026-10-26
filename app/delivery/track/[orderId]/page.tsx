'use client';

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock3, Crosshair, MapPin, Shield } from 'lucide-react';
import DeliveryMap from '@/components/delivery/DeliveryMap';
import { DeliveryContactBar } from '@/components/delivery/DeliveryContactBar';
import { LiveLocationShareBar } from '@/components/delivery/LiveLocationShareBar';
import { useOrderLiveLocations } from '@/hooks/useOrderLiveLocations';
import { authFetch } from '@/lib/clientAuth';
import '@/app/delivery/delivery.css';

type LiveData = {
  code: string;
  status: string;
  statusLabel: string;
  deliveryOtp: string | null;
  dropoff: string;
  hasCourier: boolean;
  courierName: string;
  courierPhone: string;
  vehicleLabel: string | null;
  flowStepLabel: string | null;
  pickedUp: boolean;
};

function TrackContent({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const openChat = searchParams.get('chat') === '1';
  const valid = useMemo(() => !!token && token.length > 0, [token]);
  const [live, setLive] = useState<LiveData | null>(null);
  const [progress, setProgress] = useState(0.35);
  const [missing, setMissing] = useState(false);
  const {
    data: loc,
    sharing,
    startSharing,
    stopSharing,
    error: locError,
    myCoords,
  } = useOrderLiveLocations(orderId, 'customer', valid);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [ordersRes, chatRes] = await Promise.all([
          authFetch('/api/delivery/my-orders'),
          authFetch(`/api/delivery/orders/${orderId}/chat`),
        ]);
        if (!ordersRes.ok) return;
        const data = await ordersRes.json();
        const found = (data.orders || []).find((o: { id: string }) => o.id === orderId);
        if (cancelled) return;
        if (!found) {
          setMissing(true);
          return;
        }

        let courierName = found.courier?.name || '';
        let courierPhone = found.courier?.phone || '';

        if (chatRes.ok) {
          const chat = await chatRes.json();
          if (!courierName && chat.peer?.name) courierName = chat.peer.name;
          if (!courierPhone && chat.peer?.phone) courierPhone = chat.peer.phone;
        }

        const step = found.courier?.flowStep || found.courierFlowStep;
        const progressByStep =
          step === 'arrived' || step === 'completing'
            ? 0.9
            : step === 'en_route'
              ? 0.58
              : found.courier
                ? 0.28
                : 0.12;

        setLive({
          code: found.code,
          status: found.status,
          statusLabel: found.statusLabel || found.status,
          deliveryOtp: found.deliveryOtp || null,
          dropoff: found.shipping?.text || '',
          hasCourier: !!found.courier || !!courierName,
          courierName: courierName || 'Хүргэгч',
          courierPhone,
          vehicleLabel: found.courier?.vehicleLabel || null,
          flowStepLabel: found.courier?.flowStepLabel || null,
          pickedUp: !!found.courier?.pickedUp,
        });
        setProgress(progressByStep);
        setMissing(false);
      } catch {
        /* keep last */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [orderId, valid]);

  if (!valid) {
    return (
      <main className="ios-root ios-canvas flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-[13px] font-semibold text-[var(--ios-brand)]">Soyol Delivery</p>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight">Холбоос буруу</h1>
          <Link href="/customer/track" className="ios-btn-primary mt-6 !h-12">
            Буцах
          </Link>
        </div>
      </main>
    );
  }

  if (missing && !live) {
    return (
      <main className="ios-root ios-canvas flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-[24px] font-bold">Захиалга олдсонгүй</h1>
          <Link href="/customer" className="mt-4 inline-block font-bold text-[var(--ios-brand)]">
            Миний бараа →
          </Link>
        </div>
      </main>
    );
  }

  const dropoff = live?.dropoff || '';
  const otp = live?.deliveryOtp || null;
  const hasCourier = !!live?.hasCourier;
  const etaLabel = live?.flowStepLabel
    ? live.flowStepLabel
    : hasCourier
      ? 'Хүргэлтэнд'
      : 'Хүлээж байна';

  return (
    <main className="ios-root relative min-h-[100dvh] bg-[#e8eaef]">
      <section className="absolute inset-0">
        <DeliveryMap
          mode="track"
          light
          hideOverlay
          className="h-full w-full"
          courierProgress={progress}
          viewerRole="customer"
          courierPos={loc?.courier}
          customerPos={loc?.customer || myCoords}
          dropoffPos={loc?.dropoff}
          distanceM={loc?.distanceM}
          proximity={loc?.proximity}
        />
      </section>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Link
          href="/customer/track"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black shadow-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="pointer-events-auto rounded-full bg-white/95 px-3.5 py-2 text-[12px] font-bold shadow-md">
          {live?.code || '…'}
        </div>
        <button
          type="button"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black shadow-md"
          aria-label="Төвлөрүүлэх"
        >
          <Crosshair className="h-5 w-5" />
        </button>
      </div>

      <motion.section
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="absolute inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-3"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
      >
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
          <div className="px-5 pb-4 pt-4">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10" />

            <p className="mb-3 text-center text-[13px] font-bold text-[var(--ios-brand)]">
              {live?.statusLabel || 'Хүргэлт'}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7]">
                  <Clock3 className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-[15px] font-bold tracking-tight text-black">{etaLabel}</p>
                  <p className="text-[12px] text-[var(--ios-secondary)]">
                    {live?.pickedUp ? 'Бараа авсан' : 'Төлөв'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7]">
                  <MapPin className="h-5 w-5 text-[var(--ios-brand)]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold tracking-tight text-black">
                    {dropoff.split(',')[0] || 'Хаяг'}
                  </p>
                  <p className="line-clamp-2 text-[12px] leading-snug text-[var(--ios-secondary)]">
                    {dropoff || 'Хүргэх хаяг'}
                  </p>
                </div>
              </div>
            </div>

            {otp && (
              <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-[#1c1c1e] px-3.5 py-3 text-white">
                <Shield className="h-4 w-4 shrink-0 text-[var(--ios-brand)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/50">Хүлээн авах код</p>
                  <p className="text-[22px] font-bold tracking-[0.28em] tabular-nums">{otp}</p>
                </div>
              </div>
            )}

            {hasCourier && (
              <div className="mt-4">
                <LiveLocationShareBar
                  role="customer"
                  sharing={sharing}
                  onStart={startSharing}
                  onStop={stopSharing}
                  distanceM={loc?.distanceM ?? null}
                  peerSharing={!!loc?.courier}
                  proximity={!!loc?.proximity}
                  error={locError}
                />
              </div>
            )}

            <div className="mt-3">
              {hasCourier ? (
                <DeliveryContactBar
                  orderId={orderId}
                  peerName={live!.courierName}
                  peerPhone={live!.courierPhone}
                  peerRoleLabel={
                    live?.vehicleLabel ? `Хүргэгч · ${live.vehicleLabel}` : 'Хүргэгч'
                  }
                  autoOpen={openChat}
                />
              ) : (
                <div className="rounded-[16px] bg-[#f3f4f6] px-4 py-3.5 text-center">
                  <p className="text-[14px] font-bold text-[#111827]">Хүргэгч томилогдоогүй</p>
                  <p className="mt-1 text-[12px] text-[#6b7280]">
                    Томилогдмогц нэр, утас, чат энд гарна
                  </p>
                </div>
              )}
            </div>          </div>
        </div>
      </motion.section>
    </main>
  );
}

export default function TrackPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#e8eaef]">
          <div className="ios-spinner" />
        </main>
      }
    >
      <TrackContent orderId={orderId} />
    </Suspense>
  );
}
