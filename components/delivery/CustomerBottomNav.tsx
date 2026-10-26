'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPinned, Package, User } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import '@/app/delivery/delivery.css';

const tabs = [
  {
    href: '/customer',
    label: 'Захиалга',
    icon: Package,
    match: (p: string) => p === '/customer' || p.startsWith('/customer/orders'),
  },
  {
    href: '/customer/track',
    label: 'Хүргэлт',
    icon: MapPinned,
    match: (p: string) => p.startsWith('/customer/track'),
  },
  {
    href: '/customer/me',
    label: 'Профайл',
    icon: User,
    match: (p: string) => p.startsWith('/customer/me'),
  },
];

export default function CustomerBottomNav() {
  const pathname = usePathname() || '/customer';

  return (
    <nav className="ios-root ios-tabbar-float" aria-label="Үндсэн цэс">
      <div className="flex h-full items-stretch gap-1">
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
                className="h-[22px] w-[22px]"
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
