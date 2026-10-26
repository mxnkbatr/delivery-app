'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike,
  ChevronDown,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  User,
  Navigation2,
  Clock,
  Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DeliveryMap, { type OrderMapPin } from '@/components/delivery/DeliveryMap';
import { authFetch } from '@/lib/clientAuth';
import { VEHICLE_MN, type DeliveryVehicleType } from '@/lib/delivery/vehicles';
import { STEP_MN, type CourierFlowStep } from '@/lib/delivery/geo';
import { triggerHaptic } from '@/lib/haptics';

type LatLngAt = { lat: number; lng: number; updatedAt: string | null };

type LiveDelivery = {
  id: string;
  code: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string;
  dropoffText: string;
  dropoff: { lat: number; lng: number };
  courierId: string | null;
  courierName: string | null;
  courierPhone: string | null;
  courierStatus: string | null;
  courierLocation: LatLngAt | null;
  courierFlowStep: CourierFlowStep | null;
  readyForDelivery: boolean;
  deliveryVehicleType: string | null;
  courierPayout: number | null;
  packageLabel: string;
  items: { name: string; qty: number; image: string | null }[];
  itemsCount: number;
  adminNote: string | null;
};

type LiveCourier = {
  id: string;
  name: string;
  phone: string;
  status: string;
  vehicleType: string;
  zone: string;
  rating: number;
  totalDeliveries: number;
  activeOrderId: string | null;
  lastLocation: LatLngAt | null;
  activeDelivery: {
    id: string;
    code: string;
    status: string;
    customerName: string;
    customerPhone: string;
    dropoffText: string;
    packageLabel: string;
    itemsCount: number;
  } | null;
};

type LiveSnapshot = {
  updatedAt: string;
  stats: {
    online: number;
    onDelivery: number;
    activeOrders: number;
    readyQueue: number;
    couriersTotal: number;
  };
  deliveries: LiveDelivery[];
  couriers: LiveCourier[];
};

const STATUS_MN: Record<string, string> = {
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж байна',
  shipped: 'Хүргэлтэнд',
  delivered: 'Хүргэгдсэн',
};

const COURIER_STATUS_MN: Record<string, string> = {
  OFFLINE: 'Оффлайн',
  ONLINE: 'Бэлэн',
  ON_DELIVERY: 'Хүргэж байна',
};

type PanelTab = 'deliveries' | 'couriers';

function money(n: number) {
  return `₮${Number(n || 0).toLocaleString()}`;
}

function ageLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}с өмнө`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин өмнө`;
  return `${Math.floor(min / 60)} цаг өмнө`;
}

export default function DeliveryAdminLivePage() {
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<PanelTab>('deliveries');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<'delivery' | 'courier'>('delivery');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await authFetch('/api/delivery/admin/live');
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      if (!silent) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const t = setInterval(() => void load(true), 8000);
    return () => clearInterval(t);
  }, [load]);

  const deliveries = data?.deliveries || [];
  const couriers = data?.couriers || [];
  const stats = data?.stats;

  const selectedDelivery = useMemo(() => {
    if (selectedKind === 'delivery' && selectedId) {
      return deliveries.find((d) => d.id === selectedId) || null;
    }
    if (selectedKind === 'courier' && selectedId) {
      const c = couriers.find((x) => x.id === selectedId);
      if (c?.activeOrderId) return deliveries.find((d) => d.id === c.activeOrderId) || null;
    }
    return null;
  }, [selectedKind, selectedId, deliveries, couriers]);

  const selectedCourier = useMemo(() => {
    if (selectedKind === 'courier' && selectedId) {
      return couriers.find((c) => c.id === selectedId) || null;
    }
    if (selectedDelivery?.courierId) {
      return couriers.find((c) => c.id === selectedDelivery.courierId) || null;
    }
    return null;
  }, [selectedKind, selectedId, couriers, selectedDelivery]);

  useEffect(() => {
    if (selectedId || !deliveries.length) return;
    const withCourier = deliveries.find((d) => d.courierId) || deliveries[0];
    setSelectedId(withCourier.id);
    setSelectedKind('delivery');
  }, [deliveries, selectedId]);

  const orderPins: OrderMapPin[] = useMemo(() => {
    const pins: OrderMapPin[] = [];

    for (const c of couriers) {
      if (!c.lastLocation) continue;
      const isSel =
        (selectedKind === 'courier' && selectedId === c.id) ||
        selectedDelivery?.courierId === c.id;
      pins.push({
        id: `c-${c.id}`,
        lat: c.lastLocation.lat,
        lng: c.lastLocation.lng,
        label: (c.name || '?').slice(0, 1).toUpperCase(),
        payLabel: isSel ? c.name : undefined,
        selected: isSel,
      });
    }

    for (const d of deliveries) {
      if (!d.dropoff) continue;
      const isSel = selectedKind === 'delivery' && selectedId === d.id;
      pins.push({
        id: `d-${d.id}`,
        lat: d.dropoff.lat,
        lng: d.dropoff.lng,
        label: d.code.slice(-2),
        payLabel: isSel ? d.code : undefined,
        selected: isSel && !selectedDelivery?.courierLocation,
      });
    }

    return pins;
  }, [couriers, deliveries, selectedId, selectedKind, selectedDelivery]);

  const mapCourierPos =
    selectedDelivery?.courierLocation || selectedCourier?.lastLocation || null;
  const mapDropoffPos = selectedDelivery?.dropoff || null;
  const hasMapData = orderPins.length > 0 || !!mapCourierPos || !!mapDropoffPos;

  const onPinClick = (pinId: string) => {
    triggerHaptic();
    if (pinId.startsWith('c-')) {
      setSelectedKind('courier');
      setSelectedId(pinId.slice(2));
      setTab('couriers');
    } else if (pinId.startsWith('d-')) {
      setSelectedKind('delivery');
      setSelectedId(pinId.slice(2));
      setTab('deliveries');
    }
  };

  const forceComplete = async (orderId: string, code: string) => {
    const ok = window.confirm(
      `${code}\n\nЭнэ хүргэлтийг PIN кодгүйгээр дуусгах уу?\n\nХүргэгч/захиалагчийн OTP шаардлагагүй.`
    );
    if (!ok) return;
    setCompletingId(orderId);
    try {
      const res = await authFetch(`/api/delivery/admin/orders/${orderId}/force-complete`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Дуусгаж чадсангүй');
      triggerHaptic();
      toast.success(json.message || 'Хүргэлт дууслаа');
      if (selectedId === orderId) setSelectedId(null);
      await load(true);
    } catch (err: any) {
      toast.error(err.message || 'Алдаа');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="admin-live flex h-full min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0c0f14] lg:min-h-0">
      {/* Compact ops bar — hide duplicate title on mobile (layout header already shows it) */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-[#12161e] px-3 py-2 lg:px-4 lg:py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold tracking-[0.08em] text-[#ff6a33] lg:block">
              Шууд хяналт
            </p>
            <h1 className="truncate text-[14px] font-bold text-white lg:text-[17px]">
              <span className="lg:hidden">
                {ageLabel(data?.updatedAt) || 'Шинэчилж байна…'}
              </span>
              <span className="hidden lg:inline">Хүргэлтийн хяналт</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <StatChip label="Бэлэн" value={stats?.online ?? '—'} tone="green" />
            <StatChip label="Замд" value={stats?.onDelivery ?? '—'} tone="brand" />
            <StatChip label="Идэвхтэй" value={stats?.activeOrders ?? '—'} tone="neutral" />
            <StatChip label="Дараалал" value={stats?.readyQueue ?? '—'} tone="neutral" />
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              void load(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/15"
            aria-label="Шинэчлэх"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile stats strip */}
      <div className="grid shrink-0 grid-cols-4 gap-1.5 border-b border-white/[0.06] bg-[#12161e] px-3 py-2 md:hidden">
        <StatChip label="Бэлэн" value={stats?.online ?? '—'} tone="green" compact />
        <StatChip label="Замд" value={stats?.onDelivery ?? '—'} tone="brand" compact />
        <StatChip label="Идэвхтэй" value={stats?.activeOrders ?? '—'} tone="neutral" compact />
        <StatChip label="Дараалал" value={stats?.readyQueue ?? '—'} tone="neutral" compact />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Map */}
        <section
          className={`relative shrink-0 overflow-hidden bg-[#1a222d] transition-[height] duration-300 lg:min-h-0 lg:flex-1 ${
            mapExpanded ? 'h-[55vh]' : 'h-[26vh] max-h-[220px]'
          } lg:h-auto lg:max-h-none`}
        >
          {hasMapData ? (
            <DeliveryMap
              mode="admin"
              className="h-full w-full"
              light
              hideOverlay
              courierPos={mapCourierPos}
              dropoffPos={mapDropoffPos}
              orderPins={orderPins}
              onOrderPinClick={onPinClick}
              overlayTitle="Улаанбаатар"
              overlaySubtitle="Шууд"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-white/40">
                <Radio className="h-5 w-5" />
              </div>
              <p className="text-[14px] font-bold text-white/70">Байршил хүлээж байна</p>
              <p className="text-[12px] text-white/40">
                Хүргэгч онлайн болоход map дээр харагдана
              </p>
            </div>
          )}

          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
            {data?.updatedAt && (
              <div className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-sm">
                {ageLabel(data.updatedAt) || 'Шинэ'}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setMapExpanded((v) => !v);
              }}
              className="flex h-8 items-center gap-1 rounded-full bg-black/60 px-2.5 text-[10px] font-bold text-white backdrop-blur-sm lg:hidden"
            >
              {mapExpanded ? 'Жижигрүүлэх' : 'Томруулах'}
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${mapExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </section>

        {/* Side panel / list */}
        <aside className="flex min-h-0 w-full flex-1 flex-col border-t border-white/[0.06] bg-[#12161e] lg:w-[400px] lg:flex-none lg:border-l lg:border-t-0">
          <div className="flex shrink-0 gap-1 p-2">
            <TabBtn
              active={tab === 'deliveries'}
              onClick={() => {
                triggerHaptic();
                setTab('deliveries');
              }}
            >
              Хүргэлт · {deliveries.length}
            </TabBtn>
            <TabBtn
              active={tab === 'couriers'}
              onClick={() => {
                triggerHaptic();
                setTab('couriers');
              }}
            >
              Хүргэгч · {couriers.length}
            </TabBtn>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20 lg:pb-0">
            {loading && !data ? (
              <div className="flex justify-center py-16">
                <div className="ios-spinner" />
              </div>
            ) : tab === 'deliveries' ? (
              <ul>
                {deliveries.length === 0 ? (
                  <EmptyState text="Идэвхтэй хүргэлт алга" />
                ) : (
                  deliveries.map((d) => {
                    const active = selectedKind === 'delivery' && selectedId === d.id;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSelectedKind('delivery');
                            setSelectedId(d.id);
                          }}
                          className={`w-full border-b border-white/[0.05] px-3.5 py-3 text-left transition active:bg-white/[0.05] ${
                            active ? 'bg-white/[0.08]' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[15px] font-bold text-white">{d.code}</p>
                              <p className="mt-0.5 truncate text-[12px] text-white/45">
                                {d.customerName}
                                {d.dropoffText ? ` · ${d.dropoffText}` : ''}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-[#ff4500]/20 px-2 py-0.5 text-[10px] font-bold text-[#ff8a55]">
                                  {STATUS_MN[d.status] || d.status}
                                </span>
                                {d.courierName ? (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                    {d.courierName}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/35">
                                    Хүргэгчгүй
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="shrink-0 text-[13px] font-bold tabular-nums text-[#ff6a33]">
                              {money(d.total)}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : (
              <ul>
                {couriers.length === 0 ? (
                  <EmptyState text="Хүргэгч алга" />
                ) : (
                  couriers.map((c) => {
                    const active = selectedKind === 'courier' && selectedId === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSelectedKind('courier');
                            setSelectedId(c.id);
                          }}
                          className={`w-full border-b border-white/[0.05] px-3.5 py-3 text-left transition active:bg-white/[0.05] ${
                            active ? 'bg-white/[0.08]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[15px] font-bold text-white">{c.name}</p>
                              <p className="mt-0.5 text-[12px] text-white/45">
                                {c.phone} ·{' '}
                                {VEHICLE_MN[c.vehicleType as DeliveryVehicleType] ||
                                  c.vehicleType}
                              </p>
                              {c.activeDelivery && (
                                <p className="mt-1 truncate text-[11px] font-semibold text-[#ff8a55]">
                                  {c.activeDelivery.code} → {c.activeDelivery.customerName}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                c.status === 'OFFLINE'
                                  ? 'bg-white/8 text-white/30'
                                  : c.status === 'ON_DELIVERY'
                                    ? 'bg-[#ff4500]/20 text-[#ff8a55]'
                                    : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {COURIER_STATUS_MN[c.status] || c.status}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          <AnimatePresence>
            {(selectedDelivery || selectedCourier) && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="max-h-[42%] shrink-0 overflow-y-auto border-t border-white/[0.08] bg-[#0c0f14] px-3.5 py-3.5 pb-24 lg:pb-4"
              >
                {selectedDelivery ? (
                  <DeliveryDetail
                    d={selectedDelivery}
                    courier={selectedCourier}
                    completing={completingId === selectedDelivery.id}
                    onForceComplete={() =>
                      forceComplete(selectedDelivery.id, selectedDelivery.code)
                    }
                  />
                ) : selectedCourier ? (
                  <CourierDetail c={selectedCourier} />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <Package className="mx-auto h-8 w-8 text-white/20" />
      <p className="mt-3 text-[13px] font-semibold text-white/40">{text}</p>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: string | number;
  tone: 'green' | 'brand' | 'neutral';
  compact?: boolean;
}) {
  const bg =
    tone === 'green'
      ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'brand'
        ? 'bg-[#ff4500]/20 text-[#ffb199]'
        : 'bg-white/8 text-white/75';

  if (compact) {
    return (
      <div className={`rounded-[12px] px-1.5 py-2 text-center ${bg}`}>
        <p className="text-[16px] font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-[9px] font-semibold opacity-70">{label}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[12px] px-2.5 py-1.5 ${bg}`}>
      <p className="text-[10px] font-semibold opacity-70">{label}</p>
      <p className="text-[16px] font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[12px] py-2.5 text-[12px] font-bold transition ${
        active ? 'bg-white/12 text-white shadow-sm' : 'text-white/40 active:text-white/70'
      }`}
    >
      {children}
    </button>
  );
}

function DeliveryDetail({
  d,
  courier,
  onForceComplete,
  completing,
}: {
  d: LiveDelivery;
  courier: LiveCourier | null;
  onForceComplete: () => void;
  completing: boolean;
}) {
  const step = d.courierFlowStep
    ? STEP_MN[d.courierFlowStep] || d.courierFlowStep
    : null;
  const vehicle = d.deliveryVehicleType
    ? VEHICLE_MN[d.deliveryVehicleType as DeliveryVehicleType] || d.deliveryVehicleType
    : null;
  const canForceComplete = ['confirmed', 'processing', 'shipped'].includes(d.status);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold tracking-wide text-[#ff6a33]">Захиалга</p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h3 className="text-[17px] font-bold text-white">{d.code}</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">
            {STATUS_MN[d.status] || d.status}
          </span>
        </div>
        {step && (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400">
            <Navigation2 className="h-3.5 w-3.5" />
            {step}
          </p>
        )}
      </div>

      <DetailBlock icon={User} title="Захиалагч">
        <p className="font-semibold text-white">{d.customerName}</p>
        {d.customerPhone && (
          <a
            href={`tel:${d.customerPhone}`}
            className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#ff8a55]"
          >
            <Phone className="h-3.5 w-3.5" />
            {d.customerPhone}
          </a>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-white/55">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6a33]" />
          {d.dropoffText || 'Хаяг байхгүй'}
        </p>
      </DetailBlock>

      <DetailBlock icon={Bike} title="Хүргэгч">
        {courier || d.courierName ? (
          <>
            <p className="font-semibold text-white">{courier?.name || d.courierName}</p>
            <p className="mt-0.5 text-[12px] text-white/50">
              {(courier?.phone || d.courierPhone) ?? '—'}
              {vehicle ? ` · ${vehicle}` : ''}
            </p>
            <p className="mt-1 text-[11px] font-bold text-[#ff8a55]">
              {COURIER_STATUS_MN[courier?.status || d.courierStatus || ''] ||
                courier?.status ||
                'Олгосон'}
            </p>
            {(d.courierLocation?.updatedAt || courier?.lastLocation?.updatedAt) && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-white/40">
                <Clock className="h-3 w-3" />
                GPS{' '}
                {ageLabel(
                  d.courierLocation?.updatedAt || courier?.lastLocation?.updatedAt
                )}
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-white/45">Хүргэгч олгоогүй</p>
        )}
      </DetailBlock>

      <DetailBlock icon={Package} title="Бараа / багц">
        <p className="text-[13px] font-semibold text-white">{d.packageLabel}</p>
        {d.items.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {d.items.map((it, i) => (
              <li
                key={`${it.name}-${i}`}
                className="flex items-center justify-between gap-2 text-[12px]"
              >
                <span className="truncate text-white/70">{it.name}</span>
                <span className="shrink-0 font-bold text-white/90">×{it.qty}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] text-white/40">{d.itemsCount} бараа</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
          <span className="text-white/50">
            Нийт <strong className="text-white">{money(d.total)}</strong>
          </span>
          {d.courierPayout != null && (
            <span className="text-white/50">
              Хүргэгч{' '}
              <strong className="text-emerald-400">{money(d.courierPayout)}</strong>
            </span>
          )}
        </div>
        {d.adminNote && (
          <p className="mt-2 rounded-[10px] bg-white/5 px-2.5 py-2 text-[11px] text-white/55">
            {d.adminNote}
          </p>
        )}
      </DetailBlock>

      {canForceComplete && (
        <div className="rounded-[14px] border border-emerald-500/25 bg-emerald-500/10 p-3">
          <p className="text-[12px] font-semibold leading-snug text-emerald-200/90">
            Хүргэгч PIN авч чадахгүй бол админ шууд дуусгаж болно (OTP шаардлагагүй).
          </p>
          <button
            type="button"
            disabled={completing}
            onClick={onForceComplete}
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-emerald-500 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            PINгүйгээр дуусгах
          </button>
        </div>
      )}
    </div>
  );
}

function CourierDetail({ c }: { c: LiveCourier }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold tracking-wide text-[#ff6a33]">Хүргэгч</p>
        <h3 className="mt-1 text-[17px] font-bold text-white">{c.name}</h3>
        <p className="mt-0.5 text-[13px] text-white/50">
          {c.phone} · {VEHICLE_MN[c.vehicleType as DeliveryVehicleType] || c.vehicleType} ·{' '}
          {c.zone}
        </p>
        <p
          className={`mt-2 text-[12px] font-bold ${
            c.status === 'ON_DELIVERY'
              ? 'text-[#ff6a33]'
              : c.status === 'OFFLINE'
                ? 'text-white/35'
                : 'text-emerald-400'
          }`}
        >
          {COURIER_STATUS_MN[c.status] || c.status}
        </p>
      </div>

      {c.activeDelivery ? (
        <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-3">
          <p className="text-[10px] font-bold tracking-wide text-white/40">Одоо хүргэж буй</p>
          <p className="mt-1 font-bold text-white">{c.activeDelivery.code}</p>
          <p className="mt-0.5 text-[12px] text-white/55">
            {c.activeDelivery.customerName} хүлээж байна
          </p>
          <p className="mt-1 text-[12px] text-white/45">{c.activeDelivery.dropoffText}</p>
        </div>
      ) : (
        <p className="text-[13px] text-white/40">Идэвхтэй хүргэлтгүй</p>
      )}

      <p className="text-[11px] text-white/35">
        Үнэлгээ {c.rating} · {c.totalDeliveries} хүргэлт
        {c.lastLocation?.updatedAt
          ? ` · GPS ${ageLabel(c.lastLocation.updatedAt)}`
          : ' · GPS байхгүй'}
      </p>
    </div>
  );
}

function DetailBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/10 text-white/80">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[11px] font-bold tracking-wide text-white/45">{title}</p>
      </div>
      {children}
    </div>
  );
}
