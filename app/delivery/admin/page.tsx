'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bike,
  Package,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import { useRouter } from 'next/navigation';

type Overview = {
  kpis: {
    activeDeliveries: number;
    readyQueue: number;
    awaitingRelease?: number;
    deliveredToday: number;
    deliveredWeek: number;
    cancelledWeek: number;
    couriersTotal: number;
    couriersOnline: number;
    couriersOnDelivery: number;
  };
  profit: {
    weekRevenue: number;
    weekOrders: number;
    weekShippingFees: number;
    weekCourierPayout: number;
    weekProfit: number;
    allTimeRevenue: number;
    allTimeDelivered: number;
    avgOrderValue: number;
  };
  volumeBars: number[];
};

function money(n: number) {
  return `₮${Number(n || 0).toLocaleString()}`;
}

export default function DeliveryAdminDashboard() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=admin');
    else if (!isAdmin) router.replace('/welcome');
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/delivery/admin/overview');
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="ios-spinner" />
      </div>
    );
  }

  const k = data?.kpis;
  const p = data?.profit;
  const bars = data?.volumeBars || [0, 0, 0, 0, 0, 0, 0];
  const maxBar = Math.max(...bars, 1);

  const cards = [
    {
      label: 'Гаргах',
      value: k?.awaitingRelease ?? '—',
      hint: 'Тээвэр сонгоно',
      icon: Package,
      color: 'from-[#FF7A45] to-[#FF4500]',
      href: '/delivery/admin/orders',
    },
    {
      label: 'Бэлэн',
      value: k?.readyQueue ?? '—',
      hint: `${k?.activeDeliveries ?? 0} идэвхтэй`,
      icon: Truck,
      color: 'from-[#34d7cf] to-[#00c7be]',
      href: '/delivery/admin/orders',
    },
    {
      label: 'Онлайн',
      value: k?.couriersOnline ?? '—',
      hint: `${k?.couriersOnDelivery ?? 0} замд`,
      icon: Bike,
      color: 'from-[#5BC4EF] to-[#007AFF]',
      href: '/delivery/admin/live',
    },
    {
      label: 'Ашиг',
      value: p ? money(p.weekProfit) : '—',
      hint: '7 хоног',
      icon: Wallet,
      color: 'from-[#7B79F0] to-[#5856D6]',
      href: '/delivery/admin/analytics',
    },
  ];

  const quickActions = [
    {
      href: '/delivery/admin/orders',
      label: 'Хүргэлт гаргах',
      desc: 'Release · queue',
      icon: Package,
      tone: 'brand' as const,
    },
    {
      href: '/delivery/admin/live',
      label: 'Live хяналт',
      desc: 'Map · GPS',
      icon: Truck,
      tone: 'dark' as const,
    },
    {
      href: '/delivery/admin/couriers',
      label: 'Хүргэгчид',
      desc: 'Бүртгэл',
      icon: Bike,
      tone: 'soft' as const,
    },
    {
      href: '/delivery/admin/analytics',
      label: 'Тайлан',
      desc: 'Ашиг',
      icon: TrendingUp,
      tone: 'soft' as const,
    },
  ];

  return (
    <div className="px-3.5 pb-4 pt-3 sm:px-4 lg:px-8 lg:py-8">
      {/* Mobile hero */}
      <div className="lg:hidden">
        <p className="text-[12px] font-bold text-[var(--ios-brand)]">Сайн байна уу</p>
        <h1 className="mt-0.5 text-[26px] font-bold tracking-tight text-[var(--ios-label)]">
          Админ самбар
        </h1>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/delivery/admin/orders"
            className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] bg-[var(--ios-brand)] text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(255,69,0,0.25)]"
          >
            <Package className="h-4 w-4" />
            Гаргах
          </Link>
          <Link
            href="/delivery/admin/live"
            className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] bg-[#0f172a] text-[13px] font-bold text-white"
          >
            <Truck className="h-4 w-4" />
            Live
          </Link>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden flex-wrap items-end justify-between gap-3 lg:flex">
        <div>
          <p className="text-[12px] font-semibold text-[var(--ios-brand)]">Админ панел</p>
          <h1 className="mt-1 text-[32px] font-bold tracking-tight text-[var(--ios-label)]">Самбар</h1>
          <p className="mt-1 text-[14px] text-[var(--ios-secondary)]">
            Үйл ажиллагаа · хүмүүс · тайлан — нэг дороос
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/delivery/admin/live"
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#0f172a] px-4 text-[14px] font-semibold text-white shadow-md"
          >
            <Truck className="h-4 w-4" />
            Live map
          </Link>
          <Link
            href="/delivery/admin/orders"
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--ios-brand)] px-4 text-[14px] font-semibold text-white shadow-md"
          >
            Хүргэлт гаргах
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="ios-spinner" />
        </div>
      ) : (
        <>
          <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ios-tertiary)] lg:mt-6">
            Өнөөдрийн тойм
          </p>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={c.href}
                    className="dl-card block p-3.5 transition active:scale-[0.98] sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-[var(--ios-secondary)] sm:text-[12px]">
                        {c.label}
                      </p>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br ${c.color} text-white sm:h-9 sm:w-9 sm:rounded-[12px]`}
                      >
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                    </div>
                    <p className="mt-2.5 text-[22px] font-bold tracking-tight text-[var(--ios-label)] sm:mt-3 sm:text-[28px]">
                      {c.value}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[var(--ios-secondary)] sm:text-[12px]">
                      {c.hint}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Mobile quick grid */}
          <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`flex items-center gap-2.5 rounded-[16px] px-3 py-3 active:scale-[0.98] ${
                    a.tone === 'brand'
                      ? 'bg-[rgba(255,69,0,0.1)]'
                      : a.tone === 'dark'
                        ? 'bg-[#0f172a] text-white'
                        : 'dl-card !rounded-[16px]'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-[11px] ${
                      a.tone === 'brand'
                        ? 'bg-[var(--ios-brand)] text-white'
                        : a.tone === 'dark'
                          ? 'bg-white/12 text-white'
                          : 'bg-[rgba(255,69,0,0.1)] text-[var(--ios-brand)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{a.label}</p>
                    <p
                      className={`truncate text-[10px] font-medium ${
                        a.tone === 'dark' ? 'text-white/50' : 'text-[var(--ios-secondary)]'
                      }`}
                    >
                      {a.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 lg:mt-5 lg:grid-cols-[1.4fr_1fr] lg:gap-4">
            <div className="dl-card p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--ios-brand)]" />
                <p className="text-[14px] font-bold">7 хоногийн эзлэхүүн</p>
              </div>
              <div className="mt-5 flex h-28 items-end gap-1.5 sm:mt-6 sm:h-36 sm:gap-2.5">
                {bars.map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5 sm:gap-2">
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: 0.08 + i * 0.04, duration: 0.45 }}
                      className="origin-bottom w-full rounded-t-md bg-gradient-to-t from-[#FF4500] to-[#FF9F0A]"
                      style={{ height: `${Math.max(8, (h / maxBar) * 100)}%` }}
                    />
                    <span className="text-[9px] font-semibold text-[var(--ios-secondary)] sm:text-[10px]">
                      {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dl-card p-4 sm:p-5">
              <p className="text-[14px] font-bold">Ашиг (7 хоног)</p>
              <dl className="mt-3 space-y-2.5 text-[13px] sm:mt-4 sm:space-y-3">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ios-secondary)]">GMV</dt>
                  <dd className="font-semibold tabular-nums">{money(p?.weekRevenue || 0)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ios-secondary)]">Хүргэлтийн орлого</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(p?.weekShippingFees || 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ios-secondary)]">Хүргэгчид</dt>
                  <dd className="font-semibold tabular-nums text-[var(--ios-red)]">
                    −{money(p?.weekCourierPayout || 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-black/[0.06] pt-2.5 sm:pt-3">
                  <dt className="font-bold">Цэвэр ашиг</dt>
                  <dd className="text-[17px] font-bold tabular-nums text-[var(--ios-green)] sm:text-[18px]">
                    {money(p?.weekProfit || 0)}
                  </dd>
                </div>
              </dl>
              <Link
                href="/delivery/admin/analytics"
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--ios-brand)] sm:mt-4"
              >
                Дэлгэрэнгүй <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Desktop grouped shortcuts */}
          <div className="mt-8 hidden space-y-5 lg:block">
            {[
              {
                title: 'Үйл ажиллагаа',
                items: [
                  {
                    href: '/delivery/admin/orders',
                    label: 'Хүргэлт гаргах',
                    desc: 'Дэлгүүрийн захиалга · тээвэр сонгох · release',
                  },
                  {
                    href: '/delivery/admin/live',
                    label: 'Live хяналт',
                    desc: 'Том map · хүргэгчийн байршил · идэвхтэй хүргэлт',
                  },
                ],
              },
              {
                title: 'Хүмүүс',
                items: [
                  {
                    href: '/delivery/admin/couriers',
                    label: 'Хүргэгчид',
                    desc: 'Шинэ хүргэгч · онлайн статус · бүртгэл',
                  },
                ],
              },
              {
                title: 'Харилцаа · тайлан',
                items: [
                  {
                    href: '/delivery/admin/notify',
                    label: 'Мэдэгдэл',
                    desc: 'Push мэдэгдэл илгээх',
                  },
                  {
                    href: '/delivery/admin/analytics',
                    label: 'Ашиг / статистик',
                    desc: 'Орлого · эзлэхүүн · тайлан',
                  },
                ],
              },
            ].map((group) => (
              <section key={group.title}>
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ios-tertiary)]">
                  {group.title}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="dl-card flex items-center justify-between gap-3 p-4 transition hover:ring-2 hover:ring-[rgba(255,69,0,0.2)]"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-[var(--ios-label)]">{s.label}</p>
                        <p className="mt-1 text-[12px] leading-snug text-[var(--ios-secondary)]">
                          {s.desc}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ios-tertiary)]" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
