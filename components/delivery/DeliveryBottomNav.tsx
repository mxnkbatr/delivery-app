'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, LayoutDashboard, Navigation, User } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import '@/app/delivery/delivery.css';

const tabs = [
  {
    href: '/work',
    label: 'Хүргэлт',
    icon: Navigation,
    match: (p: string) =>
      p.startsWith('/work') || p.startsWith('/active') || p.startsWith('/accepted'),
  },
  {
    href: '/history',
    label: 'Түүх',
    icon: History,
    match: (p: string) => p.startsWith('/history'),
  },
  {
    href: '/board',
    label: 'Самбар',
    icon: LayoutDashboard,
    match: (p: string) => p === '/board' || p === '/',
  },
  {
    href: '/me',
    label: 'Профайл',
    icon: User,
    match: (p: string) => p.startsWith('/me'),
  },
];

export default function DeliveryBottomNav() {
  const pathname = usePathname() || '/';

  return (
    <nav className="ios-root ios-tabbar-float" aria-label="Үндсэн цэс">
      <div className="flex h-full items-stretch gap-0.5">
        {tabs.map((item) => {
          const active = item.match(pathname);
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
              className={`ios-tab-item ${active ? 'ios-tab-item-active' : ''}`}
            >
              <Icon
                className="h-[20px] w-[20px]"
                strokeWidth={active ? 2.1 : 1.7}
                fill={active ? 'currentColor' : 'none'}
                fillOpacity={active ? 0.18 : 0}
              />
              <span className={`text-[10px] tracking-tight ${active ? 'font-bold' : 'font-semibold'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
