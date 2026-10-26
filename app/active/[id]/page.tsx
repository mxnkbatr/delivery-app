'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Check,
  ChevronLeft,
  Loader2,
  MapPin,
  Navigation2,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DeliveryMap from '@/components/delivery/DeliveryMap';
import { LiveLocationShareBar } from '@/components/delivery/LiveLocationShareBar';
import { DeliveryContactBar } from '@/components/delivery/DeliveryContactBar';
import { IOSScreen, IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import { triggerHaptic } from '@/lib/haptics';
import { useCourierLocation } from '@/hooks/useCourierLocation';
import { useOrderLiveLocations } from '@/hooks/useOrderLiveLocations';
import {
  COMPLETE_GEOFENCE_M,
  haversineM,
  STEP_MN,
  type CourierFlowStep,
} from '@/lib/delivery/geo';
import { formatContactLine } from '@/lib/delivery/format';
import { formatMoneyMNT } from '@/lib/delivery/payout';
import { enqueueOfflineAction } from '@/lib/delivery/offlineQueue';
import { VEHICLE_MN, type DeliveryVehicleType } from '@/lib/delivery/vehicles';

type OrderDetail = {
  id: string;
  code: string;
  status: string;
  courierId: string | null;
  isMine: boolean;
  isAvailable: boolean;
  customerName: string;
  customerPhone: string;
  dropoffText: string;
  dropoff?: { lat: number; lng: number };
  maps?: { google: string; waze: string; search: string };
  geofenceM?: number;
  preciseDropoff?: boolean;
  courierPayout?: number | null;
  courierTip?: number;
  courierBonus?: number;
  deliveryVehicleType?: string | null;
  hasOtp: boolean;
  hasPod?: boolean;
  deliveryOtpRequestedAt: string | null;
  courierFlowStep?: CourierFlowStep | null;
  courierPickedUpAt?: string | null;
  batchOrderIds?: string[];
  createdAt?: string;
};

const STEPS: CourierFlowStep[] = ['accepted', 'en_route', 'arrived', 'completing'];

export default function CourierOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isLoading, isAuthenticated, isCourier, isAdmin } = useAuth();
  const router = useRouter();
  const { coords, pendingOffline, refreshQueueCount } = useCourierLocation(
    isAuthenticated && (isCourier || isAdmin)
  );

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [stepBusy, setStepBusy] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpPhase, setOtpPhase] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [podUploading, setPodUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [openChat, setOpenChat] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('chat') === '1') {
        setOpenChat(true);
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  const {
    data: loc,
    myCoords,
    error: locError,
  } = useOrderLiveLocations(
    id,
    'courier',
    isAuthenticated && (isCourier || isAdmin) && !!order?.isMine
  );

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Буруу захиалгын ID');
      }
      const res = await authFetch(`/api/delivery/orders/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Алдаа (${res.status})`);
      }
      if (!data.order) throw new Error('Захиалга олдсонгүй');

      const next = data.order as OrderDetail & { status: string };
      setOrder(next);

      // Admin (or anyone) already completed — leave this screen
      if (next.status === 'delivered') {
        setDone(true);
        setOtpPhase(false);
        toast.success('Хүргэлт дууссан', { id: 'order-delivered' });
        setTimeout(async () => {
          const { resolveCourierHomePath } = await import('@/lib/delivery/courierHome');
          router.replace(await resolveCourierHomePath());
        }, 1200);
        return;
      }

      if (next.status === 'cancelled') {
        toast.error('Захиалга цуцлагдсан');
        router.replace('/work');
        return;
      }

      if (next.hasOtp || next.deliveryOtpRequestedAt) {
        setOtpPhase(true);
      }
    } catch (err: any) {
      const msg = err.message || 'Захиалга олдсонгүй';
      if (!silent) {
        setLoadError(msg);
        setOrder(null);
        toast.error(msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=courier');
    else if (!isCourier && !isAdmin) router.replace('/customer');
  }, [isLoading, isAuthenticated, isCourier, isAdmin, router]);

  useEffect(() => {
    toast.dismiss();
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated || (!isCourier && !isAdmin)) return;
    void load(false);
    const t = setInterval(() => void load(true), 4000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated, isCourier, isAdmin]);

  const distanceM = useMemo(() => {
    if (!coords || !order?.dropoff) return null;
    return Math.round(haversineM(coords, order.dropoff));
  }, [coords, order?.dropoff]);

  // Geofence only when shipping has real GPS — district fallback must not block «Ирлээ»
  const withinGeofence =
    !order?.preciseDropoff ||
    distanceM == null ||
    distanceM <= (order?.geofenceM || COMPLETE_GEOFENCE_M);

  const otpValue = otp.join('');
  const step = (order?.courierFlowStep || 'accepted') as CourierFlowStep;
  const stepIndex = STEPS.indexOf(step);

  const onDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 3) inputsRef.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const postWithOffline = async (url: string, body: unknown) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineAction({ url, method: 'POST', body });
      refreshQueueCount();
      toast('Оффлайн — дараа синк хийнэ', { icon: '📡' });
      return { offline: true as const };
    }
    const res = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { offline: false as const, res, data };
  };

  const acceptOrder = async (withBatch = false) => {
    if (!order) return;
    setAccepting(true);
    try {
      const body: any = {};
      if (withBatch && (order as any).batchSiblingId) {
        body.batchIds = [(order as any).batchSiblingId];
      }
      const res = await authFetch(`/api/delivery/orders/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Авах амжилтгүй');
      triggerHaptic();
      toast.success(data.message || 'Хүлээн авлаа');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAccepting(false);
    }
  };

  const advanceStep = async (next: CourierFlowStep) => {
    setStepBusy(true);
    try {
      const body: any = { step: next };
      if (coords) {
        body.lat = coords.lat;
        body.lng = coords.lng;
      }
      const result = await postWithOffline(`/api/delivery/orders/${id}/step`, body);
      if (result.offline) {
        setOrder((o) => (o ? { ...o, courierFlowStep: next } : o));
        return;
      }
      if (!result.res!.ok) {
        // Geofence: inline UI already shows distance — no toast spam
        if (result.data?.geofenceBlocked) return;
        throw new Error(result.data.error || 'Алдаа');
      }
      triggerHaptic();
      toast.success(result.data.message || STEP_MN[next]);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStepBusy(false);
    }
  };

  const startComplete = async () => {
    // Block quietly — distance is already on the map / status chip
    if (order?.preciseDropoff && !withinGeofence) return;
    setRequestingOtp(true);
    try {
      await advanceStep('completing').catch(() => {});
      const res = await authFetch(`/api/delivery/orders/${id}/request-otp`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Код илгээж чадсангүй');
      triggerHaptic();
      toast.success(data.message || 'Код илгээлээ');
      setOtpPhase(true);
      setTimeout(() => inputsRef.current[0]?.focus(), 200);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRequestingOtp(false);
    }
  };

  const uploadPod = async (file: File) => {
    setPodUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await authFetch(`/api/delivery/orders/${id}/pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Зураг алдаа');
      toast.success('POD зураг хадгаллаа');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPodUploading(false);
    }
  };

  const completeDelivery = async () => {
    if (!order || otpValue.length !== 4) {
      toast.error('4 оронтой код оруулна уу');
      return;
    }
    if (order?.preciseDropoff && !withinGeofence) return;
    setSubmitting(true);
    try {
      const body: any = { otp: otpValue };
      if (coords) {
        body.lat = coords.lat;
        body.lng = coords.lng;
      }
      const result = await postWithOffline(`/api/delivery/orders/${id}/deliver`, body);
      if (result.offline) {
        setDone(true);
        toast.success('Оффлайн хадгаллаа — онлайн болоход баталгаажна');
        return;
      }
      if (!result.res!.ok) {
        if (result.data?.geofenceBlocked) return;
        throw new Error(result.data.error || 'Баталгаажуулалт амжилтгүй');
      }
      triggerHaptic();
      setDone(true);
      toast.success(result.data.message || 'Хүргэлт дууслаа');
      setTimeout(async () => {
        const { resolveCourierHomePath } = await import('@/lib/delivery/courierHome');
        router.replace(await resolveCourierHomePath());
      }, 1200);
    } catch (err: any) {
      toast.error(err.message);
      setOtp(['', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !isAuthenticated || (!isCourier && !isAdmin) || loading) {
    return <IOSSpinnerScreen />;
  }

  if (!order) {
    return (
      <IOSScreen className="flex flex-col items-center justify-center px-6 pb-28 text-center">
        <p className="ios-title-2">Захиалга олдсонгүй</p>
        {loadError && (
          <p className="ios-subhead mt-2 max-w-xs text-[#6b7280]">{loadError}</p>
        )}
        <button
          type="button"
          onClick={() => load()}
          className="mt-5 text-[17px] font-semibold text-[var(--ios-brand)]"
        >
          Дахин ачаалах
        </button>
        <Link href="/work" className="mt-4 text-[15px] font-medium text-[#6b7280]">
          Буцах
        </Link>
      </IOSScreen>
    );
  }

  if (done) {
    return (
      <IOSScreen className="flex flex-col items-center justify-center px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(48,209,88,0.15)]">
          <Check className="h-10 w-10 text-[var(--ios-green)]" />
        </div>
        <p className="ios-title-2 mt-5">Хүргэлт дууслаа</p>
        <p className="ios-subhead mt-2">
          {order?.code || 'Захиалга'} амжилттай баталгаажлаа
        </p>
        <p className="mt-2 text-[13px] text-[var(--ios-secondary)]">Буцаж байна…</p>
      </IOSScreen>
    );
  }

  // Safety: never show OTP actions for already-delivered orders
  if (order.status === 'delivered') {
    return <IOSSpinnerScreen />;
  }

  const mine = order.isMine;
  const vehicleLabel = order.deliveryVehicleType
    ? VEHICLE_MN[order.deliveryVehicleType as DeliveryVehicleType] || order.deliveryVehicleType
    : '—';
  const totalEarn =
    Number(order.courierPayout || 0) +
    Number(order.courierTip || 0) +
    Number(order.courierBonus || 0);

  return (
    <div className="ios-root min-h-screen bg-[#f7f8fb] pb-40">
      <header
        className="bg-gradient-to-b from-[#ff6b2c] to-[#ff4500] text-white"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between px-3 pb-4 pt-2">
          <button
            type="button"
            onClick={() => {
              // Авсан захиалгатай үед бэлэн жагсаалт руу буцахгүй — хүргэлт дуустал үлдэнэ
              if (mine && order.status !== 'delivered') {
                toast('Хүргэлт дуустал энэ дэлгэцэд үлдээрэй');
                return;
              }
              void import('@/lib/delivery/courierHome').then(({ resolveCourierHomePath }) =>
                resolveCourierHomePath().then((p) => router.replace(p))
              );
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-[17px] font-bold">Захиалга {order.code}</h1>
          {order.customerPhone ? (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
            >
              <Phone className="h-5 w-5" />
            </a>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>
      </header>

      <div className="-mt-3 px-4">
        {pendingOffline > 0 && (
          <p className="mb-2 rounded-full bg-[#111827] px-3 py-1.5 text-center text-[11px] font-bold text-white">
            Оффлайн queue: {pendingOffline}
          </p>
        )}

        {mine && (
          <div className="dl-card mb-3 p-3">
            <div className="flex gap-1">
              {STEPS.map((s, i) => {
                const doneStep = i <= stepIndex;
                return (
                  <div key={s} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`h-2 w-full rounded-full ${
                        doneStep
                          ? 'bg-gradient-to-r from-[#ff7a45] to-[#ff4500]'
                          : 'bg-black/[0.08]'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold ${
                        doneStep ? 'text-[var(--ios-brand)]' : 'text-[var(--ios-tertiary)]'
                      }`}
                    >
                      {STEP_MN[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <span className="rounded-full bg-[rgba(34,197,94,0.16)] px-3.5 py-1.5 text-[12px] font-bold text-[#15803d] shadow-sm ring-4 ring-[#f7f8fb]">
            {mine ? STEP_MN[step] : 'Бэлэн'}
            {distanceM != null ? ` · ${distanceM}м` : ''}
          </span>
        </div>

        <section className="dl-card mt-4 p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
            Захиалагч
          </p>
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold">
                {formatContactLine(order.customerName, order.customerPhone) || 'Захиалагч'}
              </p>
              <div className="mt-3 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ios-brand)]" />
                <p className="text-[14px] font-medium leading-snug">
                  {order.dropoffText || 'Хаяг байхгүй'}
                </p>
              </div>
            </div>
            {order.customerPhone && (
              <a
                href={`tel:${order.customerPhone}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ios-brand)] text-white shadow-md"
              >
                <Phone className="h-5 w-5" />
              </a>
            )}
          </div>
        </section>

        <section className="mt-3 overflow-hidden rounded-[20px] shadow-sm ring-1 ring-black/[0.06]">
          <div className="h-[180px]">
            <DeliveryMap
              mode="courier"
              light
              hideOverlay
              className="h-full w-full"
              viewerRole="courier"
              courierProgress={
                step === 'arrived' || step === 'completing' ? 0.92 : step === 'en_route' ? 0.55 : 0.25
              }
              courierPos={loc?.courier || myCoords || coords}
              customerPos={loc?.customer}
              dropoffPos={loc?.dropoff || order.dropoff}
              distanceM={loc?.distanceM}
              proximity={loc?.proximity}
            />
          </div>
        </section>

        {mine && (
          <section className="mt-3">
            <LiveLocationShareBar
              role="courier"
              sharing
              onStart={() => {}}
              distanceM={loc?.distanceM ?? null}
              peerSharing={!!loc?.customer}
              proximity={!!loc?.proximity}
              error={locError}
              courierToDropoffM={loc?.courierToDropoffM ?? null}
            />
          </section>
        )}

        <section className="dl-card mt-3 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-[var(--ios-tertiary)]">Таны орлого</p>
              <p className="text-[24px] font-bold text-[#16a34a]">
                {totalEarn > 0 ? `₮${totalEarn.toLocaleString('mn-MN')}` : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ios-secondary)]">
                Үндсэн {formatMoneyMNT(order.courierPayout)}
                {Number(order.courierTip) > 0
                  ? ` · Tip ₮${Number(order.courierTip).toLocaleString('mn-MN')}`
                  : ''}
                {Number(order.courierBonus) > 0
                  ? ` · Бонус ₮${Number(order.courierBonus).toLocaleString('mn-MN')}`
                  : ''}
              </p>
            </div>
            <div className="text-right text-[12px] text-[var(--ios-secondary)]">
              <p>Тээвэр</p>
              <p className="mt-0.5 font-semibold text-[#111827]">{vehicleLabel}</p>
              {order.batchOrderIds && order.batchOrderIds.length > 1 && (
                <p className="mt-1 font-bold text-[var(--ios-cyan)]">
                  Batch ×{order.batchOrderIds.length}
                </p>
              )}
            </div>
          </div>
        </section>

        {mine && (
          <section className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={order.maps?.google || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-white text-[13px] font-bold shadow-sm ring-1 ring-black/[0.06]"
            >
              <Navigation2 className="h-4 w-4 text-[var(--ios-brand)]" />
              Google Maps
            </a>
            <a
              href={order.maps?.waze || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-white text-[13px] font-bold shadow-sm ring-1 ring-black/[0.06]"
            >
              <Navigation2 className="h-4 w-4 text-[#33ccff]" />
              Waze
            </a>
          </section>
        )}

        {mine && (
          <section className="mt-3">
            <DeliveryContactBar
              orderId={id}
              peerName={order.customerName}
              peerPhone={order.customerPhone}
              peerRoleLabel="Захиалагч"
              autoOpen={openChat}
            />
          </section>
        )}

        {mine && (step === 'arrived' || step === 'completing' || otpPhase) && (
          <section className="dl-card mt-3 p-4">
            <p className="text-[13px] font-bold">POD зураг (нэмэлт)</p>
            <p className="mt-1 text-[12px] text-[var(--ios-secondary)]">
              Хүлээлгэсний дараа зураг авч хадгална
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPod(f);
              }}
            />
            <button
              type="button"
              disabled={podUploading}
              onClick={() => fileRef.current?.click()}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/[0.08] text-[14px] font-bold"
            >
              {podUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {order.hasPod ? 'Зураг солих' : 'Зураг авах'}
            </button>
          </section>
        )}

        {mine && otpPhase && (
          <section className="dl-card mt-3 p-5">
            <div className="flex items-center gap-2 text-[var(--ios-green)]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[13px] font-semibold">Хүлээн авах 4 оронтой код</p>
            </div>
            <div className="mt-4 flex gap-2">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => onDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  className="h-14 w-full rounded-[14px] bg-[var(--ios-fill)] text-center text-[26px] font-bold tabular-nums text-[var(--ios-label)] outline-none focus:shadow-[0_0_0_3px_rgba(255,69,0,0.25)]"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {order.preciseDropoff && !withinGeofence && distanceM != null && (
              <p className="mt-3 text-center text-[12px] font-semibold text-[var(--ios-red)]">
                Geofence: хаягнаас {distanceM}м · {order.geofenceM || COMPLETE_GEOFENCE_M}м дотор
                ойртоно уу
              </p>
            )}
            <button
              type="button"
              disabled={submitting || otpValue.length !== 4 || (order.preciseDropoff && !withinGeofence)}
              onClick={completeDelivery}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#16a34a] text-[15px] font-bold text-white disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Кодоор дуусгах'}
            </button>
          </section>
        )}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[80] mx-auto max-w-lg border-t border-black/[0.06] bg-white px-4 pt-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {!mine && order.isAvailable && (
          <button
            type="button"
            disabled={accepting}
            onClick={() => acceptOrder(false)}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--ios-brand)] text-[15px] font-bold text-white shadow-md disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              `Хүлээн авах · ₮${totalEarn.toLocaleString()}`
            )}
          </button>
        )}

        {mine && !otpPhase && step === 'accepted' && (
          <div className="space-y-2">
            <p className="px-1 text-center text-[12px] font-medium leading-snug text-[#6b7280]">
              Дэлгүүр/агуулахаас бараагаа авч, ширхэг · байрлал зөв эсэхийг шалгаад
              баталгаажуулна.
            </p>
            <button
              type="button"
              disabled={stepBusy}
              onClick={() => {
                const ok = window.confirm(
                  `${order.code}\n\nБараа гарт авсан уу?\n\n• Ширхэг зөв эсэх\n• Босоо/хүйтэн гинж гэх мэт handling\n\nТийм бол замд гарна.`
                );
                if (!ok) return;
                advanceStep('en_route');
              }}
              className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--ios-brand)] text-[15px] font-bold text-white"
            >
              {stepBusy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Бараа авсан · Замд гарах'
              )}
            </button>
          </div>
        )}

        {mine && !otpPhase && step === 'en_route' && (
          <button
            type="button"
            disabled={stepBusy}
            onClick={() => advanceStep('arrived')}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--ios-brand)] text-[15px] font-bold text-white disabled:opacity-40"
          >
            {stepBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : distanceM != null && order?.preciseDropoff && !withinGeofence ? (
              `Ирлээ (${distanceM}м хол)`
            ) : (
              'Ирлээ'
            )}
          </button>
        )}

        {mine && !otpPhase && (step === 'arrived' || step === 'completing') && (
          <button
            type="button"
            disabled={requestingOtp || (order.preciseDropoff && !withinGeofence)}
            onClick={startComplete}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--ios-brand)] text-[15px] font-bold text-white disabled:opacity-40"
          >
            {requestingOtp ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : order.preciseDropoff && !withinGeofence && distanceM != null ? (
              `Ойртоно уу · ${distanceM}м`
            ) : (
              'Хүргэлт дуусгах · OTP'
            )}
          </button>
        )}

        {mine && otpPhase && (
          <button
            type="button"
            disabled={requestingOtp}
            onClick={startComplete}
            className="flex h-11 w-full items-center justify-center rounded-full border border-black/[0.08] text-[14px] font-bold"
          >
            {requestingOtp ? 'Илгээж байна…' : 'Код дахин илгээх'}
          </button>
        )}

        {!mine && !order.isAvailable && (
          <p className="py-2 text-center text-[14px] text-[var(--ios-secondary)]">
            Энэ захиалга боломжгүй
          </p>
        )}
      </div>
    </div>
  );
}
