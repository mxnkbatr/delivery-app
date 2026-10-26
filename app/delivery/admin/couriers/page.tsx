'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike,
  ChevronRight,
  Phone,
  Plus,
  Search,
  Wallet,
  X,
  Package,
  Loader2,
} from 'lucide-react';
import { authFetch } from '@/lib/clientAuth';
import { triggerHaptic } from '@/lib/haptics';

type Courier = {
  id: string;
  name: string;
  phone: string;
  status: string;
  vehicleType: string;
  zone: string;
  rating: number;
  totalDeliveries: number;
  totalEarnings?: number;
  totalTips?: number;
  totalBonus?: number;
  activeOrderId?: string | null;
};

type CourierDetail = {
  courier: {
    id: string;
    name: string;
    phone: string;
    status: string;
    vehicleType: string;
    vehicleLabel: string;
    zone: string;
    rating: number;
    createdAt: string | null;
  };
  stats: {
    totalDeliveries: number;
    deliveredToday: number;
    deliveredWeek: number;
    activeCount: number;
    rating: number;
  };
  earnings: {
    totalEarned: number;
    totalBase: number;
    totalTips: number;
    totalBonus: number;
    earnedToday: number;
    earnedWeek: number;
    pendingOnRoad: number;
  };
  active: {
    id: string;
    code: string;
    status: string;
    payout: number;
    customerName: string;
    dropoffText: string;
    flowStep: string | null;
  }[];
  recent: {
    id: string;
    code: string;
    payout: number;
    customerName: string;
    dropoffText: string;
    deliveredAt: string | null;
    adminForceComplete?: boolean;
  }[];
};

const VEHICLE_MN: Record<string, string> = {
  motorbike: 'Мотоцикл',
  car: 'Машин',
  foot: 'Явган',
};

const STATUS_MN: Record<string, string> = {
  OFFLINE: 'Оффлайн',
  ONLINE: 'Бэлэн',
  ON_DELIVERY: 'Замд',
};

function money(n: number) {
  return `₮${Number(n || 0).toLocaleString('mn-MN')}`;
}

function statusClass(status: string) {
  if (status === 'OFFLINE') return 'bg-[var(--ios-fill)] text-[var(--ios-tertiary)]';
  if (status === 'ON_DELIVERY') return 'bg-[rgba(255,69,0,0.12)] text-[var(--ios-brand)]';
  return 'bg-[rgba(48,209,88,0.15)] text-[#1b8f3d]';
}

export default function AdminCouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CourierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    vehicleType: 'motorbike',
    zone: 'Улаанбаатар',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : '';
      const res = await authFetch(`/api/delivery/admin/couriers${qs}`);
      const data = await res.json();
      setCouriers(data.couriers || []);
    } catch {
      setCouriers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    triggerHaptic();
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await authFetch(`/api/delivery/admin/couriers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ачаалж чадсангүй');
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    setSaving(true);
    try {
      const res = await authFetch('/api/delivery/admin/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Амжилтгүй');
        return;
      }
      setOk(
        data.upgraded
          ? 'Одоо байсан хэрэглэгчийг хүргэгч болголоо'
          : 'Шинэ хүргэгч амжилттай үүслээ'
      );
      setForm({
        name: '',
        phone: '',
        password: '',
        vehicleType: 'motorbike',
        zone: 'Улаанбаатар',
      });
      setShowCreate(false);
      await load();
      if (data.courier?.id) void openDetail(data.courier.id);
    } catch {
      setError('Сүлжээний алдаа');
    } finally {
      setSaving(false);
    }
  }

  const selectedListItem = useMemo(
    () => couriers.find((c) => c.id === selectedId) || null,
    [couriers, selectedId]
  );

  return (
    <div className="px-3.5 py-4 pb-28 sm:px-4 lg:px-8 lg:py-8 lg:pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[var(--ios-brand)]">Хүмүүс</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight sm:text-[32px]">
            Хүргэгчид
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ios-secondary)] sm:text-[14px]">
            Нэр · утсаар хайх · орлого · хүргэлт
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setShowCreate((v) => !v);
          }}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ios-brand)] px-3.5 text-[13px] font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Нэмэх
        </button>
      </div>

      {/* Search */}
      <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] px-3.5 py-2.5 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-[var(--ios-tertiary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Нэр эсвэл утасны дугаар…"
          className="h-9 w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--ios-tertiary)]"
          inputMode="search"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ios-fill)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={onCreate}
          className="dl-card mt-4 p-4 sm:p-5"
        >
          <p className="text-[16px] font-bold">Шинэ хүргэгч</p>
          <label className="mt-4 block">
            <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Нэр</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
              placeholder="Жишээ: Батбаяр Д."
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Утас</span>
            <input
              required
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
              placeholder="99112233"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Нууц үг</span>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
              placeholder="Нэвтрэх нууц үг"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Тээвэр</span>
              <select
                value={form.vehicleType}
                onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] outline-none"
              >
                <option value="motorbike">Мотоцикл</option>
                <option value="car">Машин</option>
                <option value="foot">Явган</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Бүс</span>
              <input
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] outline-none"
              />
            </label>
          </div>
          {error && <p className="mt-3 text-[13px] font-medium text-[var(--ios-red)]">{error}</p>}
          {ok && <p className="mt-3 text-[13px] font-medium text-[var(--ios-green)]">{ok}</p>}
          <button type="submit" disabled={saving} className="ios-btn-primary mt-4 !h-12">
            {saving ? 'Үүсгэж байна…' : 'Хүргэгч үүсгэх'}
          </button>
        </form>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.05fr]">
        {/* List */}
        <div className="dl-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
            <p className="text-[15px] font-bold">
              Жагсаалт · {couriers.length}
            </p>
            {debouncedQ && (
              <span className="text-[12px] font-semibold text-[var(--ios-brand)]">
                «{debouncedQ}»
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="ios-spinner" />
            </div>
          ) : couriers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Bike className="mx-auto h-8 w-8 text-[var(--ios-tertiary)]" />
              <p className="mt-3 text-sm text-[var(--ios-secondary)]">
                {debouncedQ ? 'Хайлтад тохирох хүргэгч алга' : 'Хүргэгч бүртгэгдээгүй'}
              </p>
            </div>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {couriers.map((c) => {
                const active = selectedId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(c.id)}
                      className={`flex w-full items-center gap-3 border-b border-black/[0.05] px-4 py-3.5 text-left last:border-0 active:bg-black/[0.03] ${
                        active ? 'bg-[rgba(255,69,0,0.06)]' : ''
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-[13px] font-bold text-white">
                        {(c.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15px] font-bold">{c.name}</p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(c.status)}`}
                          >
                            {STATUS_MN[c.status] || c.status}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-[var(--ios-secondary)]">
                          {c.phone || '—'} · {VEHICLE_MN[c.vehicleType] || c.vehicleType}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[var(--ios-secondary)]">
                          <span className="inline-flex items-center gap-0.5">
                            <Package className="h-3 w-3" />
                            {c.totalDeliveries} хүргэлт
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[var(--ios-brand)]">
                            <Wallet className="h-3 w-3" />
                            {money(c.totalEarnings || 0)}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ios-tertiary)]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Desktop detail panel */}
        <div className="hidden lg:block">
          {!selectedId ? (
            <div className="dl-card flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <Bike className="h-10 w-10 text-[var(--ios-tertiary)]" />
              <p className="mt-3 text-[15px] font-bold">Хүргэгч сонгоно уу</p>
              <p className="mt-1 text-[13px] text-[var(--ios-secondary)]">
                Нэр/утсаар хайгаад дарж дэлгэрэнгүй үзнэ
              </p>
            </div>
          ) : detailLoading ? (
            <div className="dl-card flex min-h-[320px] items-center justify-center">
              <div className="ios-spinner" />
            </div>
          ) : detail ? (
            <CourierDetailCard detail={detail} onClose={closeDetail} />
          ) : (
            <div className="dl-card px-5 py-10 text-center text-[13px] text-[var(--ios-secondary)]">
              Мэдээлэл олдсонгүй
            </div>
          )}
        </div>
      </div>

      {/* Mobile detail sheet */}
      {selectedId && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Хаах"
            onClick={closeDetail}
          />
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-lg overflow-y-auto rounded-t-[24px] bg-[var(--ios-bg)] shadow-2xl"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/95 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold">
                  {detail?.courier.name || selectedListItem?.name || 'Хүргэгч'}
                </p>
                <p className="text-[12px] text-[var(--ios-secondary)]">Дэлгэрэнгүй</p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ios-fill)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3.5">
              {detailLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--ios-brand)]" />
                </div>
              ) : detail ? (
                <CourierDetailCard detail={detail} embedded />
              ) : (
                <p className="py-10 text-center text-[13px] text-[var(--ios-secondary)]">
                  Мэдээлэл олдсонгүй
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CourierDetailCard({
  detail,
  onClose,
  embedded = false,
}: {
  detail: CourierDetail;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const { courier, stats, earnings, active, recent } = detail;

  return (
    <div className={embedded ? 'space-y-3' : 'dl-card space-y-0 overflow-hidden'}>
      {!embedded && (
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[18px] font-bold">{courier.name}</p>
            <p className="mt-0.5 text-[13px] text-[var(--ios-secondary)]">
              {courier.phone} · {courier.vehicleLabel} · {courier.zone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(courier.status)}`}>
              {STATUS_MN[courier.status] || courier.status}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ios-fill)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={embedded ? 'space-y-3' : 'space-y-3 p-4'}>
        {embedded && (
          <div className="dl-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-[16px] font-bold text-white">
                {(courier.name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold">{courier.name}</p>
                <a
                  href={`tel:${courier.phone}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--ios-brand)]"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {courier.phone}
                </a>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(courier.status)}`}>
                {STATUS_MN[courier.status] || courier.status}
              </span>
            </div>
            <p className="mt-3 text-[12px] text-[var(--ios-secondary)]">
              {courier.vehicleLabel} · {courier.zone} · ⭐ {stats.rating}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <StatBox label="Нийт хүргэлт" value={String(stats.totalDeliveries)} />
          <StatBox label="Авах ёстой нийт" value={money(earnings.totalEarned)} accent />
          <StatBox label="Өнөөдөр" value={`${stats.deliveredToday} · ${money(earnings.earnedToday)}`} />
          <StatBox label="7 хоног" value={`${stats.deliveredWeek} · ${money(earnings.earnedWeek)}`} />
        </div>

        <div className="dl-card p-4">
          <p className="text-[13px] font-bold">Орлогын задаргаа</p>
          <dl className="mt-3 space-y-2 text-[13px]">
            <Row label="Үндсэн (payout)" value={money(earnings.totalBase)} />
            <Row label="Tip" value={money(earnings.totalTips)} />
            <Row label="Bonus" value={money(earnings.totalBonus)} />
            <Row label="Зам дээрх хүлээгдэж буй" value={money(earnings.pendingOnRoad)} />
            <div className="flex justify-between border-t border-black/[0.06] pt-2.5">
              <dt className="font-bold">Нийт авах ёстой</dt>
              <dd className="text-[16px] font-bold text-[var(--ios-brand)]">
                {money(earnings.totalEarned)}
              </dd>
            </div>
          </dl>
        </div>

        {active.length > 0 && (
          <div className="dl-card p-4">
            <p className="text-[13px] font-bold">Идэвхтэй хүргэлт · {active.length}</p>
            <ul className="mt-3 space-y-2.5">
              {active.map((o) => (
                <li key={o.id} className="rounded-[12px] bg-[var(--ios-fill-secondary)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-bold">{o.code}</p>
                    <p className="text-[13px] font-bold text-[var(--ios-brand)]">
                      {money(o.payout)}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--ios-secondary)]">
                    {o.customerName} · {o.dropoffText || 'Хаяг'}
                  </p>
                  {o.flowStep && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-600">{o.flowStep}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="dl-card p-4">
          <p className="text-[13px] font-bold">Сүүлийн хүргэлт</p>
          {recent.length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--ios-secondary)]">Түүх алга</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {recent.map((o) => (
                <li
                  key={o.id}
                  className="flex items-start justify-between gap-2 border-b border-black/[0.04] py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">{o.code}</p>
                    <p className="truncate text-[11px] text-[var(--ios-secondary)]">
                      {o.customerName}
                      {o.adminForceComplete ? ' · админ дуусгасан' : ''}
                    </p>
                    {o.deliveredAt && (
                      <p className="mt-0.5 text-[10px] text-[var(--ios-tertiary)]">
                        {new Date(o.deliveredAt).toLocaleString('mn-MN')}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-[13px] font-bold text-[var(--ios-brand)]">
                    {money(o.payout)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!embedded && courier.phone && courier.phone !== '—' && (
          <a
            href={`tel:${courier.phone}`}
            className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#0f172a] text-[14px] font-bold text-white"
          >
            <Phone className="h-4 w-4" />
            Залгах
          </a>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="dl-card p-3.5">
      <p className="text-[11px] font-semibold text-[var(--ios-secondary)]">{label}</p>
      <p
        className={`mt-1.5 text-[18px] font-bold tabular-nums leading-tight ${
          accent ? 'text-[var(--ios-brand)]' : 'text-[var(--ios-label)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--ios-secondary)]">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
