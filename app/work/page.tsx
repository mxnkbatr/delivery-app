'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock3,
  Loader2,
  Map as MapIcon,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Route,
  UserRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DeliveryMap from '@/components/delivery/DeliveryMap';
import NewOrderBounceSheet from '@/components/delivery/NewOrderBounceSheet';
import OrdersLiveMapSheet from '@/components/delivery/OrdersLiveMapSheet';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import { IOSScreen, IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { triggerHaptic, hapticSuccess } from '@/lib/haptics';
import { ImpactStyle } from '@capacitor/haptics';
import { useCourierLocation } from '@/hooks/useCourierLocation';
import { REJECT_REASONS, STEP_MN, DEFAULT_UB, type CourierFlowStep } from '@/lib/delivery/geo';
import { formatContactLine } from '@/lib/delivery/format';
import { formatMoneyMNT } from '@/lib/delivery/payout';

function playNewOrderSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    beep(880, 0, 0.16);
    beep(1175, 0.18, 0.22);
  } catch {
    /* ignore */
  }
}

async function announceNewDelivery(order: { code: string; dropoffText?: string; courierPayout?: number | null }) {
  const pay =
    order.courierPayout != null && order.courierPayout > 0
      ? `₮${Number(order.courierPayout).toLocaleString('mn-MN')}`
      : '';
  const title = 'Шинэ хүргэлтийн захиалга';
  const body = [order.code, pay, order.dropoffText?.split(',')[0]].filter(Boolean).join(' · ');

  hapticSuccess();
  triggerHaptic(ImpactStyle.Heavy);
  playNewOrderSound();
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([180, 80, 180]);
  }

  toast.custom(
    (t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex w-[min(92vw,360px)] items-start gap-3 rounded-[18px] bg-[#111827] px-4 py-3.5 text-white shadow-xl`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ios-brand)] text-[18px]">
          🚚
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#ff8a5c]">{title}</p>
          <p className="mt-0.5 text-[15px] font-bold leading-snug">{order.code}</p>
          <p className="mt-0.5 truncate text-[12px] text-white/65">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="text-[12px] font-bold text-white/50"
        >
          OK
        </button>
      </div>
    ),
    { duration: 5500, id: `new-ready-${order.code}` }
  );

  try {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission === 'granted') {
        new Notification(title, { body, silent: false });
      }
    }
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new Event('sync-notifications'));
}

type ReadyOrder = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  customerPhone: string;
  dropoffText: string;
  district?: string | null;
  packageLabel?: string;
  packageTag?: string;
  courierPayout?: number | null;
  courierTip?: number;
  courierBonus?: number;
  deliveryVehicleType?: string | null;
  distanceM?: number;
  etaMin?: number;
  maps?: { google: string; waze: string; search: string };
  dropoff?: { lat: number; lng: number } | null;
  batchSiblingId?: string | null;
  batchSiblingDistanceM?: number | null;
};

type MineOrder = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  customerPhone: string;
  dropoffText: string;
  district?: string | null;
  packageTag?: string;
  courierPayout?: number | null;
  courierTip?: number;
  courierBonus?: number;
  distanceM?: number;
  etaMin?: number;
  maps?: { google: string; waze: string; search: string };
  dropoff?: { lat: number; lng: number } | null;
  courierFlowStep?: CourierFlowStep | null;
  hasOtp?: boolean;
};

type HubTab = 'ready' | 'mine';
type SortKey = 'near' | 'pay' | 'new';

const DISMISS_KEY = 'soyol_dismissed_offers';
const OFFER_SECONDS = 60;

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function formatDistance(m?: number | null) {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 100) return `${Math.max(0, Math.round(m))}м`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} км`;
}

function payoutOf(o: {
  courierPayout?: number | null;
  courierTip?: number;
  courierBonus?: number;
}) {
  return (
    Number(o.courierPayout || 0) + Number(o.courierTip || 0) + Number(o.courierBonus || 0)
  );
}

function mapsHref(order: { maps?: { google?: string }; dropoffText?: string }) {
  if (order.maps?.google) return order.maps.google;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    order.dropoffText || 'Ulaanbaatar'
  )}`;
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, seconds / total));
  const offset = c * (1 - progress);

  return (
    <div className="dl-countdown" aria-label={`${seconds} секунд`}>
      <svg viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,69,0,0.12)" strokeWidth="4.5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#ff4500"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="dl-countdown-text">{seconds}</span>
    </div>
  );
}

function MetricStrip({
  distanceM,
  etaMin,
  pay,
  distanceLabel = 'ЗАЙ',
}: {
  distanceM?: number | null;
  etaMin?: number | null;
  pay: number;
  distanceLabel?: string;
}) {
  return (
    <div className="dl-metric-row">
      <div className="dl-metric-cell">
        <Navigation className="mb-0.5 h-3.5 w-3.5 text-[var(--ios-brand)]" />
        <p className="dl-metric-value">{formatDistance(distanceM)}</p>
        <p className="dl-metric-label">{distanceLabel}</p>
      </div>
      <div className="dl-metric-cell">
        <Clock3 className="mb-0.5 h-3.5 w-3.5 text-[var(--ios-cyan)]" />
        <p className="dl-metric-value">{etaMin != null ? `~${etaMin} мин` : '—'}</p>
        <p className="dl-metric-label">ETA</p>
      </div>
      <div className="dl-metric-cell">
        <p className="dl-metric-value">{formatMoneyMNT(pay)}</p>
        <p className="dl-metric-label">ОРЛОГО</p>
      </div>
    </div>
  );
}

/** Ready / nearby order card — matches courier work design */
function NearOrderCard({
  order,
  countdown,
  accepting,
  featured,
  onAccept,
  onReject,
  onRoute,
}: {
  order: ReadyOrder;
  countdown?: number | null;
  accepting?: boolean;
  featured?: boolean;
  onAccept: (order: ReadyOrder) => void;
  onLater?: (order: ReadyOrder) => void;
  onReject: (order: ReadyOrder) => void;
  onRoute?: (order: ReadyOrder) => void;
}) {
  const pay = payoutOf(order);

  return (
    <div className={`dl-info-card ${featured || countdown != null ? 'dl-info-card-featured' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="dl-info-label">Хүргэх бараа</p>
          <p className="dl-info-code">{order.code}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {order.district && (
              <span className="rounded-full bg-[var(--ios-fill)] px-2.5 py-1 text-[11px] font-bold text-[var(--ios-secondary)]">
                {order.district}
              </span>
            )}
            {(order.packageTag || order.packageLabel) && (
              <span className="rounded-full bg-[rgba(255,69,0,0.14)] px-2.5 py-1 text-[11px] font-bold text-[var(--ios-brand)]">
                {order.packageTag || order.packageLabel}
              </span>
            )}
            {order.batchSiblingId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(6,182,212,0.16)] px-2.5 py-1 text-[11px] font-bold text-[var(--ios-cyan)]">
                <Route className="h-3 w-3" />
                Batch ойр
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {countdown != null && <CountdownRing seconds={countdown} total={OFFER_SECONDS} />}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic();
              onReject(order);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ios-fill)] text-[var(--ios-secondary)]"
            aria-label="Татгалзах"
            title="Татгалзах"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <MetricStrip distanceM={order.distanceM} etaMin={order.etaMin} pay={pay} distanceLabel="ЗАЙ" />

      <div className="dl-info-row">
        <MapPin className="dl-info-row-icon h-[18px] w-[18px]" strokeWidth={2.4} />
        <p className="dl-info-row-text">{order.dropoffText || 'Хаяг байхгүй'}</p>
      </div>
      <div className="dl-info-row !mt-2.5">
        <UserRound className="dl-info-row-icon dl-info-row-icon-muted h-[18px] w-[18px]" />
        <p className="dl-info-row-text">
          {formatContactLine(order.customerName, order.customerPhone) || 'Холбоо барих байхгүй'}
        </p>
      </div>

      <div className="dl-info-actions dl-info-actions-3">
        {order.customerPhone ? (
          <a
            href={`tel:${order.customerPhone}`}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic();
            }}
            className="dl-info-btn-ghost !px-0"
            aria-label="Залгах"
          >
            <Phone className="h-4 w-4 text-[#ff4500]" />
          </a>
        ) : (
          <span className="dl-info-btn-ghost !px-0 opacity-40">
            <Phone className="h-4 w-4" />
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic();
            onRoute?.(order);
          }}
          className="dl-info-btn-ghost"
        >
          <Navigation className="h-4 w-4 text-[#ff4500]" />
          Зам
        </button>
        <button
          type="button"
          disabled={accepting}
          onClick={(e) => {
            e.stopPropagation();
            onAccept(order);
          }}
          className="dl-info-btn-primary disabled:opacity-60"
        >
          {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Авах'}
        </button>
      </div>
    </div>
  );
}

function MineCard({
  order,
  onRoute,
}: {
  order: MineOrder;
  onRoute?: (order: MineOrder) => void;
}) {
  const pay = payoutOf(order);
  const step = (order.courierFlowStep || 'accepted') as CourierFlowStep;
  const etaLabel =
    order.etaMin != null ? `${order.etaMin} мин` : STEP_MN[step] || 'Замд';

  return (
    <div className="dl-info-card dl-info-card-featured">
      <div className="flex items-start justify-between gap-3">
        <p className="dl-info-label">Идэвхтэй хүргэлт</p>
        <span className="dl-info-eta">{etaLabel}</span>
      </div>
      <p className="dl-info-code">{order.code}</p>

      <MetricStrip
        distanceM={order.distanceM}
        etaMin={order.etaMin}
        pay={pay}
        distanceLabel="Хаяг хүртэл"
      />

      <div className="dl-info-row">
        <MapPin className="dl-info-row-icon h-[18px] w-[18px]" strokeWidth={2.4} />
        <p className="dl-info-row-text">{order.dropoffText || 'Хаяг байхгүй'}</p>
      </div>
      <div className="dl-info-row !mt-2.5">
        <UserRound className="dl-info-row-icon dl-info-row-icon-muted h-[18px] w-[18px]" />
        <p className="dl-info-row-text">
          {formatContactLine(order.customerName, order.customerPhone) || 'Холбоо барих байхгүй'}
        </p>
      </div>

      {order.packageTag && (
        <p className="mt-3 inline-flex rounded-full bg-[rgba(255,69,0,0.14)] px-2.5 py-1 text-[11px] font-bold text-[var(--ios-brand)]">
          {order.packageTag}
        </p>
      )}
      {order.hasOtp && (
        <p className="mt-3 rounded-full bg-[rgba(255,69,0,0.08)] px-3 py-1.5 text-center text-[12px] font-bold text-[#ff4500]">
          OTP код илгээгдсэн
        </p>
      )}

      <div className="dl-info-actions dl-info-actions-3">
        {order.customerPhone ? (
          <a
            href={`tel:${order.customerPhone}`}
            onClick={() => triggerHaptic()}
            className="dl-info-btn-ghost !px-0"
            aria-label="Залгах"
          >
            <Phone className="h-4 w-4 text-[#ff4500]" />
          </a>
        ) : (
          <span className="dl-info-btn-ghost !px-0 opacity-40">
            <Phone className="h-4 w-4" />
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            onRoute?.(order);
          }}
          className="dl-info-btn-ghost"
        >
          <Navigation className="h-4 w-4 text-[#ff4500]" />
          Зам
        </button>
        <Link
          href={`/active/${order.id}`}
          onClick={() => triggerHaptic()}
          className="dl-info-btn-primary dl-info-btn-dark"
        >
          Үргэлжлүүлэх
        </Link>
      </div>
    </div>
  );
}

function WorkHubInner() {
  const { isLoading, isAuthenticated, isCourier, isCustomer, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { coords, pendingOffline, refreshQueueCount } = useCourierLocation(
    isAuthenticated && (isCourier || !!isAdmin)
  );

  const initialTab: HubTab =
    searchParams.get('tab') === 'mine' || searchParams.get('tab') === 'accepted'
      ? 'mine'
      : 'ready';

  const [tab, setTab] = useState<HubTab>(initialTab);
  const [sort, setSort] = useState<SortKey>('near');
  const [online, setOnline] = useState(true);
  const [offer, setOffer] = useState<ReadyOrder | null>(null);
  const [bounceOffer, setBounceOffer] = useState<ReadyOrder | null>(null);
  const [countdown, setCountdown] = useState(OFFER_SECONDS);
  const [ready, setReady] = useState<ReadyOrder[]>([]);
  const [mine, setMine] = useState<MineOrder[]>([]);
  const [loadingReady, setLoadingReady] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<ReadyOrder | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);
  const [liveMapOpen, setLiveMapOpen] = useState(false);
  const [fabMounted, setFabMounted] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setFabMounted(true);
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'mine' || t === 'accepted') setTab('mine');
    if (t === 'ready') setTab('ready');
  }, [searchParams]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/welcome');
      return;
    }
    if (isCustomer && !isCourier && !isAdmin) {
      router.replace('/customer');
      return;
    }
    if (isCourier || isAdmin) {
      try {
        if (localStorage.getItem('soyol_onboard_courier_v1') !== '1') {
          router.replace('/onboarding/courier');
        }
      } catch {
        /* ignore */
      }
    }
  }, [isLoading, isAuthenticated, isCustomer, isCourier, isAdmin, router]);

  const setHubTab = (next: HubTab) => {
    triggerHaptic();
    setTab(next);
    const q = next === 'mine' ? '?tab=mine' : '';
    router.replace(`/work${q}`, { scroll: false });
  };

  const showOfferFor = useCallback((order: ReadyOrder, opts?: { bounce?: boolean }) => {
    const dismissed = readDismissed();
    if (dismissed.has(order.id)) return;
    setOffer(order);
    setCountdown(OFFER_SECONDS);
    if (opts?.bounce) {
      setBounceOffer(order);
      setTab('ready');
    }
    triggerHaptic();
  }, []);

  const dismissOffer = useCallback(() => {
    if (offer) {
      const dismissed = readDismissed();
      dismissed.add(offer.id);
      writeDismissed(dismissed);
      setReady((list) => list.filter((o) => o.id !== offer.id));
    }
    setOffer(null);
    setBounceOffer(null);
  }, [offer]);

  const closeBounceSoft = useCallback(() => {
    setBounceOffer(null);
    setOffer(null);
  }, []);

  const fetchMine = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingMine(true);
      const res = await authFetch('/api/delivery/my-accepted');
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      const orders: MineOrder[] = data.orders || [];
      setMine(orders);
      // Авсан захиалга байвал зөвхөн хүргэлтийн дэлгэц — бэлэн жагсаалт харуулахгүй
      if (orders.length > 0 && orders[0]?.id) {
        router.replace(`/active/${orders[0].id}`);
        return true;
      }
      return false;
    } catch {
      if (!silent) setMine([]);
      return false;
    } finally {
      if (!silent) setLoadingMine(false);
    }
  }, [router]);

  const fetchReady = useCallback(
    async (silent = false) => {
      if (!online) {
        setReady([]);
        setLoadingReady(false);
        return;
      }
      try {
        if (!silent) setLoadingReady(true);
        const res = await authFetch('/api/delivery/ready-orders');
        if (!res.ok) throw new Error('fail');
        const data = await res.json();
        const dismissed = readDismissed();
        const list: ReadyOrder[] = (data.orders || []).filter(
          (o: ReadyOrder) => !dismissed.has(o.id)
        );
        setReady(list);

        const nextIds = new Set(list.map((o) => o.id));
        if (firstLoad.current) {
          knownIds.current = nextIds;
          firstLoad.current = false;
          // Existing queue: list only — no bounce spam on open
        } else {
          const newcomers = list.filter((o) => !knownIds.current.has(o.id));
          knownIds.current = nextIds;
          if (newcomers[0]) {
            showOfferFor(newcomers[0], { bounce: true });
            announceNewDelivery(newcomers[0]);
          }
        }
      } catch {
        if (!silent) setReady([]);
      } finally {
        if (!silent) setLoadingReady(false);
      }
    },
    [online, showOfferFor]
  );

  const refreshAll = useCallback(async () => {
    triggerHaptic();
    await Promise.all([fetchReady(false), fetchMine(false)]);
  }, [fetchReady, fetchMine]);

  useEffect(() => {
    if (!isAuthenticated || (!isCourier && !isAdmin)) return;
    // Sync availability when opening work hub
    void authFetch('/api/delivery/courier/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ONLINE' }),
    }).catch(() => {});
  }, [isAuthenticated, isCourier, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated || (!isCourier && !isAdmin)) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const locked = await fetchMine(false);
      if (cancelled || locked) return;
      await fetchReady(false);
      if (cancelled) return;
      interval = setInterval(() => {
        void (async () => {
          const again = await fetchMine(true);
          if (!again) fetchReady(true);
        })();
      }, 8000);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, isCourier, isAdmin, fetchReady, fetchMine]);

  const acceptOrder = async (order: ReadyOrder) => {
    setAcceptingId(order.id);
    triggerHaptic();
    try {
      const body: { batchIds?: string[] } = {};
      if (order.batchSiblingId) body.batchIds = [order.batchSiblingId];
      const res = await authFetch(`/api/delivery/orders/${order.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Авах амжилтгүй');
      toast.success(`${order.code} авсан`);
      setOffer(null);
      setBounceOffer(null);
      setReady((list) => list.filter((o) => o.id !== order.id));
      await fetchMine(true);
      setTab('mine');
      const goId = data.orderId || data.claimedIds?.[0] || order.id;
      router.push(`/active/${goId}`);
    } catch (err: any) {
      toast.error(err.message || 'Алдаа');
    } finally {
      setAcceptingId(null);
      refreshQueueCount();
    }
  };

  const rejectOrder = async (reason: string) => {
    if (!rejectTarget) return;
    setRejectBusy(true);
    try {
      const res = await authFetch(`/api/delivery/orders/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Алдаа');
      const dismissed = readDismissed();
      dismissed.add(rejectTarget.id);
      writeDismissed(dismissed);
      setReady((list) => list.filter((o) => o.id !== rejectTarget.id));
      if (offer?.id === rejectTarget.id) setOffer(null);
      setBounceOffer((b) => (b?.id === rejectTarget.id ? null : b));
      toast.success('Татгалзлаа');
      setRejectTarget(null);
      refreshQueueCount();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRejectBusy(false);
    }
  };

  useEffect(() => {
    if (!offer || !online) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setBounceOffer(null);
          setOffer(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [offer?.id, online]);

  useEffect(() => {
    const onSync = () => {
      fetchReady(true);
      fetchMine(true);
    };
    window.addEventListener('sync-notifications', onSync);
    return () => window.removeEventListener('sync-notifications', onSync);
  }, [fetchReady, fetchMine]);

  const sortedReady = useMemo(() => {
    const dismissed = typeof window !== 'undefined' ? readDismissed() : new Set<string>();
    const list = ready.filter((o) => !dismissed.has(o.id));
    if (sort === 'near') list.sort((a, b) => (a.distanceM ?? 9e9) - (b.distanceM ?? 9e9));
    if (sort === 'pay') list.sort((a, b) => payoutOf(b) - payoutOf(a));
    if (sort === 'new') {
      list.sort((a, b) => String(b.id).localeCompare(String(a.id)));
    }
    return list;
  }, [ready, sort]);

  const mapOrders = tab === 'ready' ? sortedReady : mine;
  const mapPins = useMemo(
    () =>
      mapOrders
        .filter((o) => o.dropoff?.lat != null && o.dropoff?.lng != null)
        .slice(0, 40)
        .map((o) => {
          const pay = payoutOf(o);
          return {
            id: o.id,
            lat: Number(o.dropoff!.lat),
            lng: Number(o.dropoff!.lng),
            label: o.code,
            payLabel: pay > 0 ? formatMoneyMNT(pay) : undefined,
            selected: (mapFocusId || offer?.id || mapOrders[0]?.id) === o.id,
          };
        }),
    [mapOrders, mapFocusId, offer?.id]
  );

  /** All ready orders for full live map (numbered pins) */
  const liveMapOrders = useMemo(() => {
    const list = tab === 'ready' ? sortedReady : mine;
    return list
      .filter((o) => o.dropoff?.lat != null && o.dropoff?.lng != null)
      .map((o, i) => {
        const pay = payoutOf(o);
        return {
          id: o.id,
          index: i + 1,
          lat: Number(o.dropoff!.lat),
          lng: Number(o.dropoff!.lng),
          code: o.code,
          payLabel: pay > 0 ? formatMoneyMNT(pay) : undefined,
          dropoffText: o.dropoffText,
          district: o.district || null,
          distanceM: o.distanceM ?? null,
          etaMin: o.etaMin ?? null,
          googleMapsUrl: mapsHref(o),
        };
      });
  }, [tab, sortedReady, mine]);

  const focusOrderOnMap = useCallback((id: string) => {
    setMapFocusId(id);
    triggerHaptic();
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const openLiveMap = useCallback(() => {
    triggerHaptic();
    if (!mapFocusId && liveMapOrders[0]) setMapFocusId(liveMapOrders[0].id);
    setLiveMapOpen(true);
  }, [mapFocusId, liveMapOrders]);

  const openRouteForOrder = useCallback((orderId: string) => {
    triggerHaptic();
    setMapFocusId(orderId);
    setLiveMapOpen(true);
  }, []);

  if (isLoading || !isAuthenticated || (isCustomer && !isCourier && !isAdmin)) {
    return <IOSSpinnerScreen />;
  }

  // Авсан захиалга шалгаж байна / redirect хийж байна — бэлэн жагсаалт гялс харагдахгүй
  if (loadingMine) {
    return <IOSSpinnerScreen />;
  }

  if (!isCourier && !isAdmin) {
    return (
      <IOSScreen className="flex flex-col items-center justify-center px-6 text-center">
        <p className="ios-title-2">Хүргэгчийн эрх шаардлагатай</p>
        <Link href="/courier/register" className="mt-4 text-[17px] font-semibold text-[var(--ios-brand)]">
          Хүргэгч болох
        </Link>
      </IOSScreen>
    );
  }

  return (
    <IOSScreen className="flex flex-col pb-28">
      <header
        className="px-5 pb-1"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ios-bg-elevated)]/90 px-2.5 py-1 shadow-sm ring-1 ring-[var(--ios-separator)]">
            <span
              className={`h-2 w-2 rounded-full ${
                online
                  ? 'bg-[#16a34a] shadow-[0_0_0_3px_rgba(34,197,94,0.28)]'
                  : 'bg-[var(--ios-tertiary)]'
              }`}
            />
            <span className="text-[12px] font-bold text-[var(--ios-secondary)]">
              {online ? 'Хүлээн авч байна' : 'Оффлайн'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--ios-bg-elevated)]/90 px-3 text-[var(--ios-secondary)] shadow-sm ring-1 ring-[var(--ios-separator)]"
              aria-label="Жагсаалт шинэчлэх"
              title="Жагсаалт шинэчлэх"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-[11px] font-bold">Шинэчлэх</span>
            </button>
            <button
              type="button"
              aria-pressed={online}
              aria-label={online ? 'Оффлайн болгох' : 'Онлайн болгох'}
              onClick={async () => {
                triggerHaptic();
                const next = !online;
                setOnline(next);
                try {
                  const res = await authFetch('/api/delivery/courier/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: next ? 'ONLINE' : 'OFFLINE' }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setOnline(!next);
                    toast.error(data.error || 'Статус солигдсонгүй');
                  }
                } catch {
                  setOnline(!next);
                  toast.error('Статус солигдсонгүй');
                }
              }}
              className="ios-toggle shrink-0"
              style={{
                background: online
                  ? 'linear-gradient(145deg, #34d7cf, #30d158)'
                  : 'rgba(120,120,128,0.32)',
              }}
            >
              <motion.span
                className="ios-toggle-knob"
                animate={{ left: online ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              />
            </button>
          </div>
        </div>
      </header>

      <div className="mt-3 px-4">
        <button
          type="button"
          className="ios-map-wrap relative block h-[30vh] min-h-[210px] max-h-[300px] w-full overflow-hidden rounded-[28px] text-left"
          onClick={() => {
            if (liveMapOrders.length > 0) openLiveMap();
          }}
        >
          <DeliveryMap
            mode="courier"
            light
            hideOverlay
            className="pointer-events-none h-full w-full rounded-[26px]"
            courierProgress={0.48}
            courierPos={coords || DEFAULT_UB}
            orderPins={mapPins}
            overlayTitle="Улаанбаатар"
            overlaySubtitle={
              mapPins.length > 0
                ? tab === 'ready'
                  ? 'Ойрхон захиалга'
                  : 'Таны хүргэлт'
                : 'Live map'
            }
          />
          {liveMapOrders.length > 0 && (
            <span className="pointer-events-none absolute bottom-3 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-[#111827] px-3.5 py-2 text-[12px] font-bold text-white shadow-lg">
              Бүх захиалга · {liveMapOrders.length}
            </span>
          )}
        </button>
        {pendingOffline > 0 && (
          <p className="mt-2 rounded-full bg-[#111827] px-3 py-1.5 text-center text-[11px] font-bold text-white">
            Оффлайн sync: {pendingOffline}
          </p>
        )}
      </div>

      <div className="dl-hub-tabs">
        <button
          type="button"
          className={`dl-hub-tab ${tab === 'ready' ? 'dl-hub-tab-active' : ''}`}
          onClick={() => setHubTab('ready')}
        >
          Бэлэн бараа
          <span className="dl-hub-tab-count">{ready.length}</span>
        </button>
        <button
          type="button"
          className={`dl-hub-tab ${tab === 'mine' ? 'dl-hub-tab-active' : ''}`}
          onClick={() => setHubTab('mine')}
        >
          Авсан
          <span className="dl-hub-tab-count">{mine.length}</span>
        </button>
      </div>

      {tab === 'ready' && (
        <div className="mt-4 px-4 pb-2">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'near', label: 'Ойроос' },
                { id: 'pay', label: 'Орлого ↑' },
                { id: 'new', label: 'Шинэ' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setSort(s.id);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
                  sort === s.id
                    ? 'bg-[rgba(255,69,0,0.16)] text-[var(--ios-brand)]'
                    : 'bg-[var(--ios-bg-elevated)] text-[var(--ios-secondary)] ring-1 ring-[var(--ios-separator)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {!online ? (
            <div className="rounded-2xl border border-dashed border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/70 px-4 py-12 text-center">
              <p className="text-[16px] font-bold">Оффлайн горим</p>
              <p className="mt-1 text-[13px] text-[var(--ios-secondary)]">Онлайн болгож бараа хүлээнэ үү.</p>
            </div>
          ) : loadingReady ? (
            <div className="flex justify-center py-12">
              <div className="ios-spinner" />
            </div>
          ) : sortedReady.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/70 px-4 py-12 text-center">
              <Package className="mx-auto h-9 w-9 text-[var(--ios-tertiary)]" />
              <p className="mt-3 text-[16px] font-bold">Бэлэн бараа алга</p>
              <p className="mt-1.5 text-[13px] text-[var(--ios-secondary)]">
                Админ хүргэлтэд гаргахад энд харагдана.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {sortedReady.map((o, i) => (
                <div
                  key={o.id}
                  ref={(el) => {
                    cardRefs.current[o.id] = el;
                  }}
                  onClick={() => setMapFocusId(o.id)}
                >
                  <NearOrderCard
                    order={o}
                    featured={i === 0 || mapFocusId === o.id}
                    countdown={offer?.id === o.id ? countdown : null}
                    accepting={acceptingId === o.id}
                    onAccept={acceptOrder}
                    onReject={setRejectTarget}
                    onRoute={(ord) => openRouteForOrder(ord.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="mt-4 px-4 pb-2">
          {loadingMine ? (
            <div className="flex justify-center py-12">
              <div className="ios-spinner" />
            </div>
          ) : mine.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/70 px-4 py-12 text-center">
              <Package className="mx-auto h-9 w-9 text-[var(--ios-tertiary)]" />
              <p className="mt-3 text-[16px] font-bold">Авсан хүргэлт алга</p>
              <p className="mt-1.5 text-[13px] text-[var(--ios-secondary)]">
                Бэлэн бараанаас хүлээн авна уу.
              </p>
              <button
                type="button"
                onClick={() => setHubTab('ready')}
                className="mt-4 text-[14px] font-bold text-[#ff4500]"
              >
                Бэлэн бараа үзэх →
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {mine.map((o) => (
                <div
                  key={o.id}
                  ref={(el) => {
                    cardRefs.current[o.id] = el;
                  }}
                  onClick={() => setMapFocusId(o.id)}
                >
                  <MineCard order={o} onRoute={(ord) => openRouteForOrder(ord.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {online && bounceOffer && (
          <NewOrderBounceSheet
            key={bounceOffer.id}
            order={bounceOffer}
            countdown={countdown}
            countdownTotal={OFFER_SECONDS}
            accepting={acceptingId === bounceOffer.id}
            onAccept={() => acceptOrder(bounceOffer)}
            onReject={() => {
              setRejectTarget(bounceOffer);
              setBounceOffer(null);
            }}
            onLater={closeBounceSoft}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="dl-fixed-overlay fixed inset-0 z-[120] flex items-end justify-center bg-black/45 px-3"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            onClick={() => setRejectTarget(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 30 }}
              className="dl-info-card w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[17px] font-bold text-[var(--ios-label)]">Татгалзах шалтгаан</p>
              <p className="mt-1 text-[13px] text-[var(--ios-secondary)]">
                {rejectTarget.code} · acceptance rate-д нөлөөлнө
              </p>
              <div className="mt-3 space-y-2">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={rejectBusy}
                    onClick={() => rejectOrder(r.id)}
                    className="flex h-12 w-full items-center justify-center rounded-[14px] bg-[var(--ios-fill)] text-[14px] font-bold text-[var(--ios-label)] disabled:opacity-50"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="mt-3 w-full py-2.5 text-[14px] font-semibold text-[var(--ios-secondary)]"
              >
                Болих
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {fabMounted &&
        liveMapOrders.length > 0 &&
        !liveMapOpen &&
        !bounceOffer &&
        createPortal(
          <button
            type="button"
            className="live-map-fab"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openLiveMap();
            }}
            onPointerDown={(e) => {
              // Keep list scroll / card presses from stealing the tap
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
          >
            <MapIcon className="h-[18px] w-[18px]" strokeWidth={2.4} />
            Газрын зураг
          </button>,
          document.body
        )}

      <OrdersLiveMapSheet
        open={liveMapOpen}
        onClose={() => setLiveMapOpen(false)}
        orders={liveMapOrders}
        courierPos={coords || DEFAULT_UB}
        selectedId={mapFocusId || liveMapOrders[0]?.id || null}
        onSelect={(id) => {
          setMapFocusId(id);
          triggerHaptic();
        }}
        onOpenList={() => {
          setLiveMapOpen(false);
          if (mapFocusId) {
            requestAnimationFrame(() => {
              cardRefs.current[mapFocusId]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });
            });
          }
        }}
        continueLabel={tab === 'ready' ? 'Авах' : 'Үргэлжлүүлэх'}
        onContinue={(id) => {
          setLiveMapOpen(false);
          if (tab === 'ready') {
            const order = sortedReady.find((o) => o.id === id);
            if (order) acceptOrder(order);
          } else {
            router.push(`/active/${id}`);
          }
        }}
      />
    </IOSScreen>
  );
}

export default function WorkHubPage() {
  return (
    <Suspense fallback={<IOSSpinnerScreen />}>
      <WorkHubInner />
    </Suspense>
  );
}
