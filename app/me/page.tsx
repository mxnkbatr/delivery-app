'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ClipboardList, History, LayoutDashboard, Map, Navigation, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import DeleteAccountButton from '@/components/delivery/DeleteAccountButton';
import {
  IOSLargeTitle,
  IOSScreen,
  IOSSpinnerScreen,
} from '@/components/delivery/ios/primitives';

export default function CourierMePage() {
  const { user, isLoading, isAuthenticated, isCourier, isAdmin, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/sign-in?as=courier');
    else if (!isCourier && !isAdmin) router.replace('/customer');
  }, [isLoading, isAuthenticated, isCourier, isAdmin, router]);

  if (isLoading || !isAuthenticated || (!isCourier && !isAdmin)) {
    return <IOSSpinnerScreen />;
  }

  return (
    <IOSScreen className="pb-28">
      <IOSLargeTitle eyebrow="Soyol Delivery" title="Профайл" />

      <div className="dl-card mx-4 mt-2 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-[22px] font-bold text-white shadow-md">
            {(user?.name?.[0] || 'Т').toUpperCase()}
          </div>
          <div>
            <p className="text-[20px] font-bold">{user?.name || 'Хүргэгч'}</p>
            <p className="mt-0.5 text-[14px] text-[var(--ios-secondary)]">{user?.phone}</p>
            <span className="dl-chip dl-chip-brand mt-2">Хүргэгч</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 px-4">
        <ThemeToggle />
        <Link href="/board" className="dl-card flex items-center gap-3 p-4">
          <div className="ios-icon-tile ios-icon-tile-brand !h-10 !w-10 !rounded-[12px]">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <p className="flex-1 text-[15px] font-semibold">Dashboard</p>
          <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" />
        </Link>
        <Link href="/work" className="dl-card flex items-center gap-3 p-4">
          <div className="ios-icon-tile ios-icon-tile-cyan !h-10 !w-10 !rounded-[12px]">
            <Navigation className="h-4 w-4" />
          </div>
          <p className="flex-1 text-[15px] font-semibold">Ажил · бэлэн бараа</p>
          <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" />
        </Link>
        <Link href="/work?tab=mine" className="dl-card flex items-center gap-3 p-4">
          <div className="ios-icon-tile ios-icon-tile-brand !h-10 !w-10 !rounded-[12px]">
            <ClipboardList className="h-4 w-4" />
          </div>
          <p className="flex-1 text-[15px] font-semibold">Хүлээн авсан</p>
          <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" />
        </Link>
        <Link href="/earnings" className="dl-card flex items-center gap-3 p-4">
          <div className="ios-icon-tile ios-icon-tile-brand !h-10 !w-10 !rounded-[12px]">
            <Wallet className="h-4 w-4" />
          </div>
          <p className="flex-1 text-[15px] font-semibold">Орлого дэлгэрэнгүй</p>
          <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" />
        </Link>
        <Link href="/history" className="dl-card flex items-center gap-3 p-4">
          <div className="ios-icon-tile ios-icon-tile-indigo !h-10 !w-10 !rounded-[12px]">
            <History className="h-4 w-4" />
          </div>
          <p className="flex-1 text-[15px] font-semibold">Түүх</p>
          <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" />
        </Link>
        {isAdmin && (
          <Link href="/delivery/admin" className="dl-card flex items-center gap-3 p-4">
            <div className="ios-icon-tile ios-icon-tile-cyan !h-10 !w-10 !rounded-[12px]">
              <Map className="h-4 w-4" />
            </div>
            <p className="flex-1 text-[15px] font-semibold">Админ панел</p>
            <ChevronRight className="h-5 w-5 text-[var(--ios-tertiary)]" />
          </Link>
        )}
      </div>

      <div className="mt-8 space-y-2 px-4 pb-2">
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
        <button type="button" onClick={() => logout()} className="ios-btn-secondary !text-[var(--ios-red)]">
          Гарах
        </button>
        <DeleteAccountButton redirectTo="/welcome" />
      </div>
    </IOSScreen>
  );
}
