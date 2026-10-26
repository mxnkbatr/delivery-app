'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Bike,
  LayoutDashboard,
  Map,
  MoreHorizontal,
  Package,
  Radio,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { triggerHaptic } from '@/lib/haptics';
import ThemeToggle from '@/components/ThemeToggle';
import '@/app/delivery/delivery.css';

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  hint?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: 'Үйл ажиллагаа',
    items: [
      {
        href: '/delivery/admin',
        label: 'Самбар',
        short: 'Самбар',
        icon: LayoutDashboard,
        hint: 'Тойм',
      },
      {
        href: '/delivery/admin/orders',
        label: 'Хүргэлт гаргах',
        short: 'Гаргах',
        icon: Package,
        hint: 'Release · queue',
      },
      {
        href: '/delivery/admin/live',
        label: 'Live хяналт',
        short: 'Live',
        icon: Map,
        hint: 'Map · GPS',
      },
    ],
  },
  {
    title: 'Хүмүүс',
    items: [
      {
        href: '/delivery/admin/couriers',
        label: 'Хүргэгчид',
        short: 'Хүргэгч',
        icon: Bike,
        hint: 'Бүртгэл',
      },
    ],
  },
  {
    title: 'Харилцаа · тайлан',
    items: [
      {
        href: '/delivery/admin/notify',
        label: 'Мэдэгдэл',
        short: 'Мэдэгдэл',
        icon: Bell,
        hint: 'Push',
      },
      {
        href: '/delivery/admin/analytics',
        label: 'Ашиг / статистик',
        short: 'Тайлан',
        icon: BarChart3,
        hint: 'Тайлан',
      },
    ],
  },
];

const flatNav = navSections.flatMap((s) => s.items);

const mobileTabs = [
  flatNav[0], // Самбар
  flatNav[1], // Гаргах
  flatNav[2], // Live
  flatNav[3], // Хүргэгч
] as const;

const moreItems = [flatNav[4], flatNav[5]]; // Мэдэгдэл, Тайлан

function isActive(pathname: string | null, href: string) {
  return href === '/delivery/admin' ? pathname === href : !!pathname?.startsWith(href);
}

function currentLabel(pathname: string | null) {
  return flatNav.find((n) => isActive(pathname, n.href))?.label || 'Панел';
}

export default function DeliveryAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const isLive = !!pathname?.startsWith('/delivery/admin/live');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((n) => isActive(pathname, n.href));

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/sign-in?as=admin');
      return;
    }
    if (!isAdmin) {
      router.replace('/work');
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return <IOSSpinnerScreen />;
  }

  return (
    <div className={`ios-root min-h-screen ${isLive ? 'bg-[#0c0f14]' : 'ios-canvas'}`}>
      <div
        className={`mx-auto flex min-h-screen ${
          isLive ? 'max-w-none' : 'max-w-7xl'
        } flex-col lg:flex-row`}
      >
        {/* Desktop sidebar */}
        <aside
          className={`hidden shrink-0 p-4 lg:block ${isLive ? 'w-[232px] bg-[#0c0f14]' : 'w-[272px]'}`}
        >
          <div
            className={`sticky top-4 p-4 ${
              isLive
                ? 'rounded-[20px] border border-white/[0.08] bg-[#12161e]'
                : 'dl-card'
            }`}
          >
            {!isLive && <div className="dl-card-accent -mx-4 -mt-4 mb-4" />}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#ff6a33] to-[#ff4500] text-white shadow-md">
                <Radio className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <div>
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                    isLive ? 'text-[#ff6a33]' : 'text-[var(--ios-brand)]'
                  }`}
                >
                  Soyol Delivery
                </p>
                <h1
                  className={`text-[16px] font-bold tracking-tight ${
                    isLive ? 'text-white' : 'text-[var(--ios-label)]'
                  }`}
                >
                  Админ панел
                </h1>
              </div>
            </div>

            <nav className="mt-5 space-y-4">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p
                    className={`mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      isLive ? 'text-white/35' : 'text-[var(--ios-tertiary)]'
                    }`}
                  >
                    {section.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map(({ href, label, icon: Icon, hint }) => {
                      const active = isActive(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors ${
                            active
                              ? 'bg-gradient-to-r from-[#FF6B2C] to-[#FF4500] text-white shadow-md'
                              : isLive
                                ? 'text-white/45 hover:bg-white/[0.06] hover:text-white'
                                : 'text-[var(--ios-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold leading-tight">
                              {label}
                            </span>
                            {hint && !active && (
                              <span
                                className={`mt-0.5 block text-[10px] font-medium ${
                                  isLive ? 'text-white/25' : 'text-[var(--ios-tertiary)]'
                                }`}
                              >
                                {hint}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div
              className={`mt-6 space-y-2 border-t pt-4 ${
                isLive ? 'border-white/[0.08]' : 'border-[var(--ios-separator)]'
              }`}
            >
              {!isLive && <ThemeToggle variant="sheet" />}
              <Link
                href="/work"
                className={`block rounded-[12px] px-3 py-2.5 text-center text-[12px] font-bold ${
                  isLive
                    ? 'bg-white/[0.06] text-[#ff8a55]'
                    : 'bg-[rgba(255,69,0,0.08)] text-[var(--ios-brand)]'
                }`}
              >
                Хүргэгч горим →
              </Link>
            </div>
          </div>
        </aside>

        <div
          className={`flex min-w-0 flex-1 flex-col ${
            isLive ? 'h-[100dvh] max-h-[100dvh] overflow-hidden lg:h-screen lg:max-h-screen' : ''
          }`}
        >
          {/* Mobile compact top */}
          <header
            className={`sticky top-0 z-40 border-b px-3 lg:hidden ${
              isLive
                ? 'border-white/[0.06] bg-[#12161e]'
                : 'border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/92 backdrop-blur-xl'
            }`}
            style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
          >
            <div className="flex h-12 items-center justify-between gap-2 pb-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#ff6a33] to-[#ff4500] text-white shadow-sm">
                  <Radio className="h-4 w-4" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p
                    className={`truncate text-[11px] font-bold ${
                      isLive ? 'text-[#ff6a33]' : 'text-[var(--ios-brand)]'
                    }`}
                  >
                    Админ
                  </p>
                  <p
                    className={`truncate text-[15px] font-bold leading-tight ${
                      isLive ? 'text-white' : 'text-[var(--ios-label)]'
                    }`}
                  >
                    {currentLabel(pathname)}
                  </p>
                </div>
              </div>
              <Link
                href="/work"
                onClick={() => triggerHaptic()}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  isLive
                    ? 'bg-white/10 text-[#ff8a55]'
                    : 'bg-[rgba(255,69,0,0.1)] text-[var(--ios-brand)]'
                }`}
              >
                Хүргэгч
              </Link>
            </div>
          </header>

          <div
            className={`flex-1 ${isLive ? 'min-h-0 overflow-hidden' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0'}`}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar — hidden on live (full-screen map) */}
      {!isLive && (
        <nav
          className="admin-mobile-tabbar lg:hidden"
          aria-label="Админ цэс"
        >
          <div className="flex h-full items-stretch gap-0.5">
            {mobileTabs.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={() => {
                    triggerHaptic();
                    if (active) window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`admin-mobile-tab ${active ? 'is-active' : ''}`}
                >
                  <Icon
                    className="h-[20px] w-[20px]"
                    strokeWidth={active ? 2.2 : 1.7}
                    fill={active ? 'currentColor' : 'none'}
                    fillOpacity={active ? 0.16 : 0}
                  />
                  <span>{item.short}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setMoreOpen(true);
              }}
              className={`admin-mobile-tab ${moreActive ? 'is-active' : ''}`}
            >
              <MoreHorizontal
                className="h-[20px] w-[20px]"
                strokeWidth={moreActive ? 2.2 : 1.7}
              />
              <span>Бусад</span>
            </button>
          </div>
        </nav>
      )}

      {/* Live mobile: floating home chip */}
      {isLive && (
        <Link
          href="/delivery/admin"
          onClick={() => triggerHaptic()}
          className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--ios-bg-elevated)] px-4 py-2.5 text-[13px] font-bold text-[var(--ios-label)] shadow-[0_12px_32px_rgba(0,0,0,0.35)] lg:hidden"
        >
          <LayoutDashboard className="h-4 w-4 text-[var(--ios-brand)]" />
          Самбар
        </Link>
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Хаах"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[24px] bg-[var(--ios-bg-elevated)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--ios-tertiary)]/40" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[16px] font-bold text-[var(--ios-label)]">Бусад цэс</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ios-fill)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 pb-2">
              {moreItems.map(({ href, label, icon: Icon, hint }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => {
                      triggerHaptic();
                      setMoreOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-[16px] px-3.5 py-3.5 ${
                      active
                        ? 'bg-[rgba(255,69,0,0.1)]'
                        : 'bg-[var(--ios-fill-secondary)] active:opacity-90'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${
                        active
                          ? 'bg-gradient-to-br from-[#ff6a33] to-[#ff4500] text-white'
                          : 'bg-[var(--ios-bg-elevated)] text-[var(--ios-brand)] shadow-sm'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-[var(--ios-label)]">{label}</p>
                      {hint && (
                        <p className="text-[12px] font-medium text-[var(--ios-secondary)]">
                          {hint}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
              <ThemeToggle variant="sheet" />
              <Link
                href="/work"
                onClick={() => {
                  triggerHaptic();
                  setMoreOpen(false);
                }}
                className="flex items-center gap-3 rounded-[16px] bg-[#0f172a] px-3.5 py-3.5 text-white dark:bg-[#1e293b]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/10">
                  <Bike className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[15px] font-bold">Хүргэгч горим</p>
                  <p className="text-[12px] font-medium text-white/55">Ажиллах дэлгэц рүү</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
