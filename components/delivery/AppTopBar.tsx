'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Bike,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { triggerHaptic } from '@/lib/haptics';
import ThemeToggle from '@/components/ThemeToggle';
import '@/app/delivery/delivery.css';

type Portal = 'customer' | 'courier' | 'admin';

function detectPortal(pathname: string | null, role?: string | null): Portal {
  if (pathname?.startsWith('/delivery/admin') || pathname?.startsWith('/admin')) return 'admin';
  if (pathname?.startsWith('/customer')) return 'customer';
  if (role === 'courier' || role === 'admin') {
    if (
      pathname === '/' ||
      pathname?.startsWith('/work') ||
      pathname?.startsWith('/board') ||
      pathname?.startsWith('/active') ||
      pathname?.startsWith('/accepted') ||
      pathname?.startsWith('/history') ||
      pathname?.startsWith('/me')
    ) {
      return 'courier';
    }
  }
  return role === 'admin' ? 'admin' : role === 'courier' ? 'courier' : 'customer';
}

const PORTAL_META: Record<
  Portal,
  { label: string; color: string; icon: typeof Package; home: string }
> = {
  customer: {
    label: 'Хэрэглэгч',
    color: 'from-[#0f172a] to-[#334155]',
    icon: Package,
    home: '/customer',
  },
  courier: {
    label: 'Хүргэгч',
    color: 'from-[#ff6a33] to-[#ff4500]',
    icon: Bike,
    home: '/work',
  },
  admin: {
    label: 'Админ',
    color: 'from-[#0284c7] to-[#0369a1]',
    icon: Shield,
    home: '/delivery/admin',
  },
};

function IconBtn({
  label,
  onClick,
  href,
  children,
  badge,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  badge?: number;
}) {
  const className =
    'relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--ios-label)] active:bg-black/[0.06] dark:active:bg-white/[0.08]';
  const inner = (
    <>
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ios-brand)] px-1 text-[9px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className} onClick={() => triggerHaptic()}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={() => {
        triggerHaptic();
        onClick?.();
      }}
    >
      {inner}
    </button>
  );
}

export default function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isCourier, isCustomer, isAdmin, logout } = useAuth();
  const { unreadCount } = useNotificationCount(user?.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const portal = detectPortal(pathname, user?.role);
  const meta = PORTAL_META[portal];
  const Icon = meta.icon;

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  if (!isAuthenticated) return null;

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    if (portal === 'courier') {
      router.push(`/active?q=${encodeURIComponent(q)}`);
    } else if (portal === 'customer') {
      router.push(`/customer?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/delivery/admin/orders?q=${encodeURIComponent(q)}`);
    }
    setQuery('');
  }

  return (
    <header
      className="app-topbar ios-root sticky top-0 z-[90] px-3 pb-2"
      style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
    >
      <div className="ios-chrome relative mx-auto flex max-w-lg items-center gap-1 rounded-[18px] px-2.5 py-2">
        <Link href={meta.home} className="flex min-w-0 flex-1 items-center gap-2.5 pl-0.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br ${meta.color} text-white`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-[var(--ios-label)]">
              Soyol <span className="text-[var(--ios-brand)]">Delivery</span>
            </p>
            <p className="truncate text-[11px] font-semibold text-[var(--ios-secondary)]">{meta.label}</p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center">
          <IconBtn label="Хайлт" onClick={() => setSearchOpen((v) => !v)}>
            {searchOpen ? (
              <X className="h-5 w-5" strokeWidth={1.8} />
            ) : (
              <Search className="h-5 w-5" strokeWidth={1.8} />
            )}
          </IconBtn>
          <IconBtn label="Мэдэгдэл" href="/notifications" badge={unreadCount}>
            <Bell className="h-5 w-5" strokeWidth={1.8} />
          </IconBtn>
          <div className="relative" ref={menuRef}>
            <IconBtn label="Цэс" onClick={() => setMenuOpen((v) => !v)}>
              <Menu className="h-5 w-5" strokeWidth={1.8} />
            </IconBtn>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[220px] overflow-hidden rounded-[18px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] py-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                {portal === 'customer' && (
                  <>
                    <Link
                      href="/customer"
                      className="block px-3.5 py-2.5 text-[14px] font-semibold active:bg-black/[0.04]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Миний захиалга
                    </Link>
                    <Link
                      href="/customer/track"
                      className="block px-3.5 py-2.5 text-[14px] font-semibold active:bg-black/[0.04]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Хүргэлт track
                    </Link>
                    <Link
                      href="/customer/me"
                      className="block px-3.5 py-2.5 text-[14px] font-semibold active:bg-black/[0.04]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Профайл
                    </Link>
                    <div className="my-1 h-px bg-black/[0.06]" />
                  </>
                )}
                {isCustomer && portal !== 'customer' && (
                  <Link
                    href="/customer"
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold active:bg-black/[0.04]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Package className="h-4 w-4 text-[#5856D6]" /> Хэрэглэгч
                  </Link>
                )}
                {(isCourier || isAdmin) && (
                  <Link
                    href="/work"
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold active:bg-black/[0.04]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Bike className="h-4 w-4 text-[var(--ios-brand)]" /> Хүргэгч
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/delivery/admin"
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold active:bg-black/[0.04]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4 text-[#007AFF]" /> Админ
                  </Link>
                )}
                {/* Pure customers: no «Үүрэг солих» — only staff can switch portals */}
                {!isCourier && isCustomer && (
                  <Link
                    href="/courier/register"
                    className="block px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ios-brand)] active:bg-black/[0.04]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Хүргэгч болох
                  </Link>
                )}
                <div className="my-1 h-px bg-[var(--ios-separator)]" />
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="text-[13px] font-semibold text-[var(--ios-label)]">
                    Харанхуй горим
                  </span>
                  <ThemeToggle variant="switch" />
                </div>
                <div className="my-1 h-px bg-[var(--ios-separator)]" />
                <button
                  type="button"
                  className="block w-full px-3.5 py-2.5 text-left text-[13px] font-semibold text-[var(--ios-red)] active:bg-black/[0.04]"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  Гарах
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {searchOpen && (
        <form
          onSubmit={onSearchSubmit}
          className="ios-chrome mx-auto mt-2 flex max-w-lg items-center gap-2 rounded-[16px] px-3 py-2"
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--ios-secondary)]" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              portal === 'courier'
                ? 'Захиалгын код хайх…'
                : portal === 'admin'
                  ? 'Захиалга / утас хайх…'
                  : 'Захиалга хайх…'
            }
            className="h-9 w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--ios-tertiary)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-black px-3 py-1.5 text-[12px] font-bold text-white"
          >
            Хайх
          </button>
        </form>
      )}
    </header>
  );
}
