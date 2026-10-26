'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  HelpCircle,
  MapPinned,
  Package,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';
import ThemeToggle from '@/components/ThemeToggle';
import DeleteAccountButton from '@/components/delivery/DeleteAccountButton';
import {
  IOSLargeTitle,
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';

export default function CustomerMePage() {
  const { user, isLoading, isAuthenticated, isCourier, logout } = useAuth();
  const router = useRouter();
  const [activeCount, setActiveCount] = useState(0);
  const [trackCount, setTrackCount] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=customer');
    if (isCourier) router.replace('/work');
  }, [isLoading, isAuthenticated, isCourier, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/delivery/my-orders');
        const data = await res.json();
        const orders = (data.orders || []) as { status: string }[];
        if (cancelled) return;
        setActiveCount(orders.filter((o) => o.status !== 'delivered').length);
        setTrackCount(
          orders.filter((o) => ['confirmed', 'processing', 'shipped'].includes(o.status)).length
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) return <IOSSpinnerScreen />;

  const initial = (user?.name?.[0] || user?.phone?.[0] || 'U').toUpperCase();

  const links = [
    {
      href: '/customer',
      title: 'Миний захиалга',
      desc: activeCount > 0 ? `${activeCount} идэвхтэй` : 'Захиалга · түүх',
      icon: Package,
      tint: 'ios-icon-tile-indigo',
    },
    {
      href: '/customer/track',
      title: 'Хүргэлт track',
      desc: trackCount > 0 ? `${trackCount} live` : 'Байршил · хүргэгч',
      icon: MapPinned,
      tint: 'ios-icon-tile-cyan',
    },
    {
      href: '/notifications',
      title: 'Мэдэгдэл',
      desc: 'Төлөв · хүргэгч',
      icon: Bell,
      tint: 'ios-icon-tile-brand',
    },
  ];

  return (
    <IOSScreen className="pb-28">
      <IOSLargeTitle eyebrow="Soyol Delivery" title="Профайл" />

      <div className="dl-card mx-4 mt-1 overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#fff4ef] via-white to-[#eef6ff] px-5 pb-5 pt-6 dark:from-[#2a1810] dark:via-[#151a22] dark:to-[#12202c]">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-40"
            style={{
              background:
                'radial-gradient(circle, rgba(255,69,0,0.35) 0%, transparent 70%)',
            }}
          />
          <div className="relative flex items-center gap-4">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-[28px] font-bold text-white shadow-[0_10px_28px_rgba(255,69,0,0.35)] ring-4 ring-white dark:ring-[#151a22]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[22px] font-bold tracking-tight">
                {user?.name || 'Хэрэглэгч'}
              </p>
              <p className="mt-0.5 text-[14px] font-medium text-[var(--ios-secondary)]">
                {user?.phone}
              </p>
              <span className="dl-chip dl-chip-brand mt-2.5">Хэрэглэгч</span>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-[16px] bg-white/80 px-3.5 py-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.08]">
              <p className="text-[24px] font-bold tabular-nums leading-none">{activeCount}</p>
              <p className="mt-1.5 text-[12px] font-semibold text-[var(--ios-secondary)]">
                Идэвхтэй
              </p>
            </div>
            <div className="rounded-[16px] bg-white/80 px-3.5 py-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.08]">
              <p className="text-[24px] font-bold tabular-nums leading-none text-[var(--ios-brand)]">
                {trackCount}
              </p>
              <p className="mt-1.5 text-[12px] font-semibold text-[var(--ios-secondary)]">
                Track хийх
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 px-4">
        <ThemeToggle />
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="dl-card flex items-center gap-3.5 p-4 transition-transform active:scale-[0.985]"
            >
              <div className={`ios-icon-tile ${item.tint} !h-11 !w-11 !rounded-[13px]`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{item.title}</p>
                <p className="mt-0.5 text-[12px] font-medium text-[var(--ios-secondary)]">
                  {item.desc}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--ios-tertiary)]" />
            </Link>
          );
        })}
      </div>

      <div className="dl-card mx-4 mt-4 flex items-start gap-3 p-4">
        <div className="ios-icon-tile ios-icon-tile-mint !h-10 !w-10 !rounded-[12px]">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[14px] font-bold">Аюулгүй хүлээн авалт</p>
          <p className="mt-1 text-[12px] leading-snug text-[var(--ios-secondary)]">
            Хүргэгч ирэхэд 4 оронтой кодыг хэлнэ үү. Код зөвхөн танд харагдана.
          </p>
        </div>
      </div>

      <div className="mt-3 px-4">
        <div className="flex items-center gap-3 rounded-[18px] px-3 py-3 text-[14px] font-semibold text-[var(--ios-secondary)]">
          <HelpCircle className="h-4 w-4" />
          Асуудал гарвал хүргэгчтэй чатлаарай
        </div>
      </div>

      <div className="mt-4 space-y-2 px-4 pb-2">
        <Link
          href="/terms"
          className="block text-center text-[13px] font-semibold text-[var(--ios-secondary)]"
        >
          Үйлчилгээний нөхцөл
        </Link>
        <Link
          href="/privacy"
          className="block text-center text-[13px] font-semibold text-[var(--ios-secondary)]"
        >
          Нууцлалын бодлого
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="ios-btn-secondary !text-[var(--ios-red)]"
        >
          Гарах
        </button>
        <DeleteAccountButton redirectTo="/welcome" />
      </div>
    </IOSScreen>
  );
}
