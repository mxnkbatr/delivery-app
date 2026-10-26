'use client';

import { SWRConfig } from 'swr';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { LanguageProvider } from '@/context/LanguageContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import DeliveryBottomNav from '@/components/delivery/DeliveryBottomNav';
import CustomerBottomNav from '@/components/delivery/CustomerBottomNav';
import AppTopBar from '@/components/delivery/AppTopBar';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const swrDefaults = {
  revalidateOnFocus: false,
  dedupingInterval: 120000,
  errorRetryCount: 2,
};

function PushInit() {
  usePushNotifications();
  return null;
}

function hideChrome(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/courier/register') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/delivery/track')
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isCourier, isCustomer, isAdmin, isAuthenticated } = useAuth();
  const hide = hideChrome(pathname);
  const isShopAdmin = !!pathname && pathname.startsWith('/admin');
  const isDispatchRoute = !!pathname && pathname.startsWith('/delivery/admin');
  const onCustomerArea = !!pathname && pathname.startsWith('/customer');
  const onCourierArea =
    pathname === '/' ||
    !!pathname?.startsWith('/work') ||
    !!pathname?.startsWith('/board') ||
    !!pathname?.startsWith('/accepted') ||
    !!pathname?.startsWith('/active') ||
    !!pathname?.startsWith('/history') ||
    !!pathname?.startsWith('/earnings') ||
    !!pathname?.startsWith('/me');
  // /active/[id] = full-screen order detail (own bottom actions) — hide dock
  const onActiveDelivery = !!pathname?.startsWith('/active');

  const showTopBar =
    isAuthenticated && !hide && !isShopAdmin && !isDispatchRoute && !onActiveDelivery;
  const showCustomerNav = !hide && isAuthenticated && (isCustomer || isAdmin) && onCustomerArea;
  const showCourierNav =
    !hide &&
    isAuthenticated &&
    (isCourier || isAdmin) &&
    onCourierArea &&
    !onActiveDelivery;

  return (
    <>
      {showTopBar && <AppTopBar />}
      <main
        className={
          isShopAdmin || isDispatchRoute
            ? 'min-h-screen relative z-0 cap-admin-fullscreen'
            : hide
              ? 'min-h-screen relative z-0'
              : 'min-h-screen relative z-0 mobile-nav-pb'
        }
      >
        {children}
      </main>
      {showCustomerNav && <CustomerBottomNav />}
      {showCourierNav && <DeliveryBottomNav />}
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Интернет холболт сэргэлээ', {
        style: { borderRadius: '12px', background: '#1c1c1e', color: '#fff', fontWeight: '600' },
      });
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof navigator !== 'undefined' && !navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && !('ontouchstart' in window))
      return;

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (
        touchStartX <= 35 &&
        dx > 80 &&
        Math.abs(dy) < Math.abs(dx) * Math.tan((30 * Math.PI) / 180)
      ) {
        import('@capacitor/haptics')
          .then((m) => {
            m.Haptics.impact({ style: 'light' as any }).catch(() => {});
          })
          .catch(() => {});
        window.history.back();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.documentElement.classList.add('cap-native');
    return () => document.documentElement.classList.remove('cap-native');
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let Haptics: any = null;
    import('@capacitor/haptics')
      .then((m) => {
        Haptics = m.Haptics;
      })
      .catch(() => {});
    const handler = (e: Event) => {
      if (!Haptics) return;
      const el = (e.target as HTMLElement | null)?.closest?.(
        'button,a,[role="button"],[data-haptic]'
      );
      if (!el || (el as HTMLButtonElement).disabled) return;
      Haptics.impact({ style: 'medium' }).catch(() => {});
    };
    window.addEventListener('pointerup', handler, { capture: true });
    return () => window.removeEventListener('pointerup', handler, { capture: true } as any);
  }, []);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const appTree = (
    <SWRConfig value={swrDefaults}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <PushInit />
            <ErrorBoundary>
              <AnimatePresence>
                {isOffline && (
                  <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    className="fixed top-0 left-0 right-0 z-[9999] bg-[#FF3B30] text-white px-4 py-2.5 text-center text-[11px] font-bold shadow-md flex items-center justify-center gap-2"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Интернет холболт тасарлаа. Холболтоо шалгана уу!
                  </motion.div>
                )}
              </AnimatePresence>

              <AppShell>{children}</AppShell>
              <Toaster position="top-right" reverseOrder={false} />
            </ErrorBoundary>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SWRConfig>
  );

  if (!googleClientId) return appTree;

  return <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider>;
}
