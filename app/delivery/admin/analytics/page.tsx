'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { authFetch } from '@/lib/clientAuth';

type Overview = {
  kpis: {
    deliveredToday: number;
    deliveredWeek: number;
    cancelledWeek: number;
    couriersTotal: number;
    activeDeliveries: number;
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

export default function DeliveryAnalyticsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const p = data?.profit;
  const k = data?.kpis;
  const bars = data?.volumeBars || [0, 0, 0, 0, 0, 0, 0];
  const maxBar = Math.max(...bars, 1);

  const metrics = [
    { label: '7 хоногийн GMV', value: money(p?.weekRevenue || 0), hint: `${p?.weekOrders || 0} захиалга` },
    {
      label: 'Хүргэлтийн орлого',
      value: money(p?.weekShippingFees || 0),
      hint: 'shipping / 8% fallback',
    },
    {
      label: 'Цэвэр ашиг',
      value: money(p?.weekProfit || 0),
      hint: `Төлбөр −${money(p?.weekCourierPayout || 0)}`,
    },
    {
      label: 'Дундаж захиалга',
      value: money(p?.avgOrderValue || 0),
      hint: `${p?.allTimeDelivered || 0} нийт хүргэлт`,
    },
  ];

  return (
    <div className="px-4 py-5 lg:px-8 lg:py-8">
      <p className="text-[12px] font-semibold text-[var(--ios-brand)]">Insight</p>
      <h1 className="mt-1 text-[32px] font-bold tracking-tight">Ашиг · статистик</h1>
      <p className="mt-1 max-w-lg text-[14px] text-[var(--ios-secondary)]">
        Бодит захиалгын өгөгдлөөс тооцсон гүйцэтгэл, орлого, ашиг
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="ios-spinner" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-[20px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] p-5 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ios-secondary)]">
                  {m.label}
                </p>
                <p className="mt-3 text-[28px] font-bold tracking-tight text-[var(--ios-label)]">{m.value}</p>
                <p className="mt-1 text-[12px] text-[var(--ios-secondary)]">{m.hint}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[20px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] p-5 shadow-sm">
              <p className="text-[14px] font-bold">Долоо хоногийн эзлэхүүн</p>
              <div className="mt-6 flex h-40 items-end gap-3">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                    className="origin-bottom flex-1 rounded-t-md bg-gradient-to-t from-[#FF4500] to-[#FF9F0A]"
                    style={{ height: `${Math.max(6, (h / maxBar) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--ios-secondary)]">
                {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] p-5 shadow-sm">
              <p className="text-[14px] font-bold">Үйл ажиллагаа</p>
              <dl className="mt-4 space-y-3 text-[14px]">
                <div className="flex justify-between border-b border-black/[0.05] pb-3">
                  <dt className="text-[var(--ios-secondary)]">Идэвхтэй хүргэлт</dt>
                  <dd className="font-bold">{k?.activeDeliveries ?? 0}</dd>
                </div>
                <div className="flex justify-between border-b border-black/[0.05] pb-3">
                  <dt className="text-[var(--ios-secondary)]">Өнөөдөр хүргэсэн</dt>
                  <dd className="font-bold">{k?.deliveredToday ?? 0}</dd>
                </div>
                <div className="flex justify-between border-b border-black/[0.05] pb-3">
                  <dt className="text-[var(--ios-secondary)]">7 хоногт хүргэсэн</dt>
                  <dd className="font-bold">{k?.deliveredWeek ?? 0}</dd>
                </div>
                <div className="flex justify-between border-b border-black/[0.05] pb-3">
                  <dt className="text-[var(--ios-secondary)]">Цуцлагдсан (7 хоног)</dt>
                  <dd className="font-bold text-[var(--ios-red)]">{k?.cancelledWeek ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--ios-secondary)]">Нийт GMV (бүх цаг)</dt>
                  <dd className="font-bold">{money(p?.allTimeRevenue || 0)}</dd>
                </div>
              </dl>
              <p className="mt-5 text-[11px] leading-relaxed text-[var(--ios-secondary)]">
                Ашиг = хүргэлтийн орлого − хүргэгчийн тооцоолсон төлбөр (65%). Хүргэлтийн
                төлбөр байхгүй бол GMV-ийн 8%-иар тооцно.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
