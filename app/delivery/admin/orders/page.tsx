'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike,
  Car,
  CheckCircle2,
  CheckSquare,
  Footprints,
  Loader2,
  Package,
  Plus,
  Send,
  Square,
  Undo2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/clientAuth';
import {
  DELIVERY_VEHICLES,
  VEHICLE_MN,
  type DeliveryVehicleType,
} from '@/lib/delivery/vehicles';

type AdminOrder = {
  id: string;
  code: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string;
  dropoffText: string;
  itemsCount: number;
  items?: { name: string; qty: number; image: string | null }[];
  deliveryOtp: string | null;
  readyForDelivery: boolean;
  courierId: string | null;
  deliveryVehicleType: string | null;
  courierPayout: number | null;
  shippingCost?: number | null;
  manualDelivery?: boolean;
  adminNote?: string | null;
  awaitingDeliveryRelease?: boolean;
  orderSource?: string | null;
  createdAt: string;
};

const STATUS_MN: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж байна',
  shipped: 'Хүргэлтэнд',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

const VEHICLE_ICON = {
  motorbike: Bike,
  car: Car,
  foot: Footprints,
} as const;

type Tab = 'manual' | 'release' | 'queue' | 'all';

const emptyManual = {
  customerName: '',
  customerPhone: '',
  city: 'Улаанбаатар',
  district: '',
  address: '',
  packageCount: '1',
  adminNote: '',
  vehicleType: 'motorbike' as DeliveryVehicleType,
  courierPayout: '5000',
};

export default function DeliveryAdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [tab, setTab] = useState<Tab>('release');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>('motorbike');
  const [courierPayout, setCourierPayout] = useState('5000');
  const [manual, setManual] = useState(emptyManual);
  const [savingManual, setSavingManual] = useState(false);
  const [forceCompletingId, setForceCompletingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await authFetch('/api/delivery/admin/orders?status=all&limit=150');
      const data = await res.json();
      setOrders(data.orders || []);
      if (!silent) setSelected(new Set());
    } catch {
      if (!silent) setOrders([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 12000);
    return () => clearInterval(t);
  }, [load]);

  const visible = useMemo(() => {
    if (tab === 'manual') {
      return orders.filter((o) => o.manualDelivery && o.readyForDelivery && !o.courierId);
    }
    if (tab === 'release') {
      return orders.filter(
        (o) =>
          ['confirmed', 'processing'].includes(o.status) &&
          !o.readyForDelivery &&
          !o.courierId &&
          !o.manualDelivery
      );
    }
    if (tab === 'queue') {
      return orders.filter((o) => o.readyForDelivery && !o.courierId);
    }
    return orders.filter((o) => o.status !== 'pending');
  }, [orders, tab]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        const o = orders.find((x) => x.id === id);
        const suggested =
          Number(o?.courierPayout) || Number(o?.shippingCost) || 0;
        if (suggested > 0) setCourierPayout(String(suggested));
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((o) => o.id)));
  };

  const createManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const payout = Number(String(manual.courierPayout).replace(/[^\d]/g, ''));
    if (!manual.customerName.trim()) {
      toast.error('Нэр оруулна уу');
      return;
    }
    if (manual.customerPhone.replace(/\D/g, '').length < 8) {
      toast.error('Утас буруу');
      return;
    }
    if (!manual.address.trim()) {
      toast.error('Хаяг оруулна уу');
      return;
    }
    if (!payout) {
      toast.error('Орлого оруулна уу');
      return;
    }

    setSavingManual(true);
    try {
      const res = await authFetch('/api/delivery/admin/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: manual.customerName.trim(),
          customerPhone: manual.customerPhone,
          city: manual.city.trim() || 'Улаанбаатар',
          district: manual.district.trim(),
          address: manual.address.trim(),
          packageCount: Number(manual.packageCount) || 1,
          adminNote: manual.adminNote.trim(),
          vehicleType: manual.vehicleType,
          courierPayout: payout,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Амжилтгүй');
      toast.success(data.message || 'Queue-д нэмэгдлээ');
      setManual(emptyManual);
      await load();
      setTab('queue');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingManual(false);
    }
  };

  const releaseSelected = async () => {
    if (selected.size === 0) {
      toast.error('Захиалга сонгоно уу');
      return;
    }
    const payout = Number(String(courierPayout).replace(/[^\d]/g, ''));
    if (!payout) {
      toast.error('Хүргэгчид өгөх дүнг оруулна уу');
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch('/api/delivery/admin/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: [...selected],
          vehicleType,
          courierPayout: payout,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Амжилтгүй');
      toast.success(
        `${data.message || 'Хүргэлтэд гаргалаа'} · ${VEHICLE_MN[vehicleType]} · ₮${payout.toLocaleString()}`
      );
      await load();
      setTab('queue');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pullSelected = async () => {
    if (selected.size === 0) {
      toast.error('Захиалга сонгоно уу');
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch('/api/delivery/admin/release', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Амжилтгүй');
      toast.success(data.message || 'Буцаалаа');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const forceComplete = async (order: AdminOrder) => {
    const ok = window.confirm(
      `${order.code}\n\nPIN кодгүйгээр хүргэлт дуусгах уу?\n\nOTP шаардлагагүй.`
    );
    if (!ok) return;
    setForceCompletingId(order.id);
    try {
      const res = await authFetch(`/api/delivery/admin/orders/${order.id}/force-complete`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Дуусгаж чадсангүй');
      toast.success(data.message || 'Хүргэлт дууслаа');
      await load(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setForceCompletingId(null);
    }
  };

  const tabs: { id: Tab; label: string; short: string; count: number }[] = [
    {
      id: 'release',
      label: 'Дэлгүүрийн захиалга',
      short: 'Гаргах',
      count: orders.filter(
        (o) =>
          ['confirmed', 'processing'].includes(o.status) &&
          !o.readyForDelivery &&
          !o.courierId &&
          !o.manualDelivery
      ).length,
    },
    {
      id: 'queue',
      label: 'Хүргэгчийн жагсаалт',
      short: 'Бэлэн',
      count: orders.filter((o) => o.readyForDelivery && !o.courierId).length,
    },
    {
      id: 'manual',
      label: 'Гараар нэмэх',
      short: 'Гараар',
      count: orders.filter((o) => o.manualDelivery && o.readyForDelivery && !o.courierId).length,
    },
    {
      id: 'all',
      label: 'Бүгд',
      short: 'Бүгд',
      count: orders.filter((o) => o.status !== 'pending').length,
    },
  ];

  return (
    <div className="px-3.5 py-4 sm:px-4 lg:px-8 lg:py-8">
      <p className="text-[12px] font-semibold text-[var(--ios-brand)]">Operations</p>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight sm:text-[32px]">Хүргэлт гаргах</h1>
      <p className="mt-1 hidden max-w-2xl text-[14px] leading-relaxed text-[var(--ios-secondary)] sm:block">
        E-commerce дэлгүүрээс <strong className="font-semibold text-[var(--ios-label)]">хүргэлтээр</strong> төлбөр
        баталгаажсан захиалга энд автоматаар орно. Та тээвэр + орлого сонгоод «Хүргэлтэд гаргах» — дараа нь
        хүргэгчдийн жагсаалтад нэмэгдэнэ. Дэлгүүрийн pickup / checkout логик өөрчлөгдөхгүй.
      </p>

      <div className="mt-3 rounded-[16px] border border-[rgba(255,69,0,0.15)] bg-[rgba(255,69,0,0.06)] px-3.5 py-3 text-[12px] leading-snug text-[var(--ios-label)] sm:mt-4 sm:px-4 sm:text-[13px]">
        <p className="font-bold text-[var(--ios-brand)]">Урсгал</p>
        <p className="mt-1 text-[var(--ios-secondary)]">
          Дэлгүүр → төлбөр OK → <span className="font-semibold text-[var(--ios-label)]">Гаргах</span> →
          админ → <span className="font-semibold text-[var(--ios-label)]">Бэлэн</span> → хүргэгч
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:mt-5 sm:flex sm:gap-1.5 sm:overflow-x-auto sm:pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSelected(new Set());
            }}
            className={`rounded-[14px] px-1.5 py-2.5 text-center text-[11px] font-bold sm:shrink-0 sm:rounded-full sm:px-3.5 sm:py-2 sm:text-left sm:text-[12px] ${
              tab === t.id
                ? 'bg-[var(--ios-brand)] text-white shadow-sm'
                : 'border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] text-[var(--ios-secondary)]'
            }`}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="mt-0.5 block text-[10px] opacity-80 sm:mt-0 sm:ml-1.5 sm:inline">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'manual' && (
        <form onSubmit={createManual} className="dl-card mt-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[16px] font-bold">Гараар хүргэлт нэмэх</p>
              <p className="text-[12px] text-[var(--ios-secondary)]">
                Шууд queue-д орно · хүргэгчид бараа харагдахгүй
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Захиалагчийн нэр
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.customerName}
                onChange={(e) => setManual((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Бат-Эрдэнэ"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Утас
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.customerPhone}
                onChange={(e) => setManual((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="99112233"
                inputMode="tel"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Хот
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.city}
                onChange={(e) => setManual((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Дүүрэг
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.district}
                onChange={(e) => setManual((f) => ({ ...f, district: e.target.value }))}
                placeholder="СБД"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Хүргэх хаяг
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.address}
                onChange={(e) => setManual((f) => ({ ...f, address: e.target.value }))}
                placeholder="Гудамж, байр, тоот…"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Багцын тоо
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.packageCount}
                onChange={(e) =>
                  setManual((f) => ({
                    ...f,
                    packageCount: e.target.value.replace(/[^\d]/g, ''),
                  }))
                }
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Хүргэгчийн орлого ₮
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] font-bold outline-none focus:border-[var(--ios-brand)]"
                value={manual.courierPayout}
                onChange={(e) =>
                  setManual((f) => ({
                    ...f,
                    courierPayout: e.target.value.replace(/[^\d]/g, ''),
                  }))
                }
                inputMode="numeric"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-bold text-[var(--ios-secondary)]">
                Админ тэмдэглэл (зөвхөн танд харагдана)
              </label>
              <input
                className="h-11 w-full rounded-[12px] border border-black/[0.08] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
                value={manual.adminNote}
                onChange={(e) => setManual((f) => ({ ...f, adminNote: e.target.value }))}
                placeholder="Жишээ: цамц 2, гутал 1 — хүргэгчид харагдахгүй"
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
              Тээвэр · хэн харах вэ
            </p>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_VEHICLES.map((v) => {
                const Icon = VEHICLE_ICON[v];
                const active = manual.vehicleType === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setManual((f) => ({ ...f, vehicleType: v }))}
                    className={`inline-flex items-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[13px] font-bold transition ${
                      active
                        ? 'bg-gradient-to-r from-[#ff7a45] to-[#ff4500] text-white shadow-md'
                        : 'bg-[var(--ios-fill)] text-[var(--ios-secondary)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {VEHICLE_MN[v]}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingManual}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#ff7a45] to-[#ff4500] text-[15px] font-bold text-white shadow-md disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {savingManual ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
            Queue-д нэмэх
          </button>
        </form>
      )}

      {(tab === 'release' || tab === 'queue') && (
        <div className="dl-card mt-4 p-4">
          {tab === 'release' && (
            <p className="mb-3 text-[13px] leading-snug text-[var(--ios-secondary)]">
              <span className="font-bold text-[var(--ios-label)]">1.</span> Захиалга сонго →{' '}
              <span className="font-bold text-[var(--ios-label)]">2.</span> Тээвэр сонго →{' '}
              <span className="font-bold text-[var(--ios-label)]">3.</span> Орлого оруулаад «Хүргэлтэд гаргах»
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ios-fill)] px-3 py-2 text-[12px] font-bold text-[var(--ios-label)]"
            >
              {selected.size === visible.length && visible.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-[var(--ios-brand)]" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Бүгдийг сонгох
            </button>
            <span className="text-[13px] text-[var(--ios-secondary)]">
              Сонгосон: <b className="text-[var(--ios-label)]">{selected.size}</b>
            </span>
          </div>

          {tab === 'release' && (
            <div className="mt-4 grid gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
                  Тээврийн хэрэгсэл
                </p>
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_VEHICLES.map((v) => {
                    const Icon = VEHICLE_ICON[v];
                    const active = vehicleType === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVehicleType(v)}
                        className={`inline-flex items-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[13px] font-bold transition ${
                          active
                            ? 'bg-gradient-to-r from-[#ff7a45] to-[#ff4500] text-white shadow-md'
                            : 'bg-[var(--ios-fill)] text-[var(--ios-secondary)]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {VEHICLE_MN[v]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
                  Хүргэгчийн орлого ₮
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={courierPayout}
                  onChange={(e) => setCourierPayout(e.target.value.replace(/[^\d]/g, ''))}
                  className="h-12 w-full rounded-[14px] border border-black/[0.08] px-3 text-[18px] font-bold outline-none focus:border-[var(--ios-brand)]"
                  placeholder="5000"
                />
                <p className="mt-1 text-[11px] text-[var(--ios-secondary)]">
                  Сонгоход дэлгүүрийн хүргэлтийн төлбөрөөс санал болгоно
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {tab === 'release' && (
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={releaseSelected}
                className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-[var(--ios-brand)] px-6 text-[14px] font-bold text-white shadow-md disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Хүргэлтэд гаргах
                {selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            )}
            {tab === 'queue' && (
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={pullSelected}
                className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] px-4 text-[13px] font-bold text-[var(--ios-label)] disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Жагсаалтаас буцаах
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sticky release bar — always visible while selecting */}
      {tab === 'release' && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 border-t border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur-md lg:bottom-0 lg:left-[272px]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[var(--ios-label)]">
                {selected.size} захиалга · {VEHICLE_MN[vehicleType]} · ₮
                {Number(courierPayout || 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-[var(--ios-secondary)]">
                Хүргэгчийн жагсаалт руу гаргана
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={releaseSelected}
              className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-[var(--ios-brand)] px-5 text-[14px] font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Хүргэлтэд гаргах
            </button>
          </div>
        </div>
      )}

      {tab !== 'manual' && (
        <div className={`mt-4 space-y-2.5 ${tab === 'release' && selected.size > 0 ? 'pb-24' : ''}`}>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="ios-spinner" />
            </div>
          ) : visible.length === 0 ? (
            <div className="dl-card px-5 py-12 text-center">
              <Package className="mx-auto h-8 w-8 text-[var(--ios-tertiary)]" />
              <p className="mt-3 text-[15px] font-semibold">Жагсаалт хоосон</p>
              {tab === 'release' && (
                <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--ios-secondary)]">
                  Дэлгүүрээс хүргэлтээр төлбөр баталгаажсан захиалга энд автоматаар гарна.
                  Pickup захиалга энд орохгүй.
                </p>
              )}
              {tab === 'queue' && (
                <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--ios-secondary)]">
                  «Дэлгүүрийн захиалга»-аас гаргасан эсвэл гараар нэмсэн хүргэлтүүд энд —
                  хүргэгчид харна.
                </p>
              )}
            </div>
          ) : (
            visible.map((o) => {
              const canCheck =
                (tab === 'release' && !o.readyForDelivery) ||
                (tab === 'queue' && o.readyForDelivery && !o.courierId);
              const checked = selected.has(o.id);
              const VehicleIcon =
                o.deliveryVehicleType && o.deliveryVehicleType in VEHICLE_ICON
                  ? VEHICLE_ICON[o.deliveryVehicleType as DeliveryVehicleType]
                  : null;
              return (
                <div
                  key={o.id}
                  role={canCheck ? 'button' : undefined}
                  tabIndex={canCheck ? 0 : undefined}
                  onClick={() => {
                    if (canCheck) toggle(o.id);
                  }}
                  onKeyDown={(e) => {
                    if (canCheck && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      toggle(o.id);
                    }
                  }}
                  className={`dl-card transition ${checked ? 'ring-2 ring-[rgba(255,69,0,0.25)]' : ''} ${
                    canCheck ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 px-3.5 py-3.5">
                    {canCheck ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(o.id);
                        }}
                        className="mt-1 shrink-0"
                      >
                        {checked ? (
                          <CheckSquare className="h-6 w-6 text-[var(--ios-brand)]" />
                        ) : (
                          <Square className="h-6 w-6 text-[var(--ios-tertiary)]" />
                        )}
                      </button>
                    ) : (
                      <div className="mt-1 h-6 w-6 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[16px] font-bold">{o.code}</p>
                        <span className="dl-chip dl-chip-green">
                          {STATUS_MN[o.status] || o.status}
                        </span>
                        {o.manualDelivery && <span className="dl-chip dl-chip-cyan">Гараар</span>}
                        {!o.manualDelivery && tab === 'release' && (
                          <span className="dl-chip dl-chip-brand">Дэлгүүр</span>
                        )}
                        {o.readyForDelivery && <span className="dl-chip dl-chip-brand">Queue</span>}
                        {o.deliveryVehicleType && (
                          <span className="dl-chip dl-chip-cyan inline-flex items-center gap-1">
                            {VehicleIcon && <VehicleIcon className="h-3 w-3" />}
                            {VEHICLE_MN[o.deliveryVehicleType as DeliveryVehicleType] ||
                              o.deliveryVehicleType}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] font-medium">{o.customerName}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--ios-secondary)]">
                        {o.dropoffText || 'Хаяг'}
                        {o.customerPhone ? ` · ${o.customerPhone}` : ''}
                      </p>
                      {o.adminNote && (
                        <p className="mt-1.5 rounded-lg bg-[var(--ios-fill-secondary)] px-2 py-1.5 text-[12px] text-[var(--ios-secondary)]">
                          Админ: {o.adminNote}
                        </p>
                      )}
                      {o.items && o.items.length > 0 && !o.manualDelivery && (
                        <ul className="mt-2 space-y-0.5">
                          {o.items.slice(0, 3).map((it, i) => (
                            <li key={i} className="text-[12px] text-[var(--ios-secondary)]">
                              · {it.name} ×{it.qty}
                            </li>
                          ))}
                        </ul>
                      )}
                      {['confirmed', 'processing', 'shipped'].includes(o.status) && (
                        <button
                          type="button"
                          disabled={forceCompletingId === o.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void forceComplete(o);
                          }}
                          className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-emerald-500/15 px-3 text-[12px] font-bold text-emerald-700 disabled:opacity-50"
                        >
                          {forceCompletingId === o.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          PINгүйгээр дуусгах
                        </button>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {o.courierPayout != null ? (
                        <p className="text-[14px] font-bold text-[var(--ios-brand)]">
                          Орлого ₮{Number(o.courierPayout).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-[15px] font-bold">
                          ₮{Number(o.total || 0).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="mt-6">
          <p className="ios-section-header !px-0">Саяхан гараар нэмсэн (queue)</p>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="ios-spinner" />
            </div>
          ) : visible.length === 0 ? (
            <div className="dl-card px-5 py-10 text-center text-[13px] text-[var(--ios-secondary)]">
              Одоогоор гараар нэмсэн хүргэлт алга
            </div>
          ) : (
            <div className="space-y-2.5">
              {visible.map((o) => (
                <div key={o.id} className="dl-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-bold">{o.code}</p>
                    <span className="dl-chip dl-chip-cyan">Гараар</span>
                    {o.deliveryVehicleType && (
                      <span className="dl-chip dl-chip-brand">
                        {VEHICLE_MN[o.deliveryVehicleType as DeliveryVehicleType]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-medium">
                    {o.customerName} · {o.customerPhone}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--ios-secondary)]">{o.dropoffText}</p>
                  {o.adminNote && (
                    <p className="mt-2 text-[12px] text-[var(--ios-secondary)]">Админ: {o.adminNote}</p>
                  )}
                  {o.courierPayout != null && (
                    <p className="mt-2 text-[14px] font-bold text-[var(--ios-brand)]">
                      Орлого ₮{Number(o.courierPayout).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
