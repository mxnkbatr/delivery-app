'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bike, ChevronRight, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SplashScreen from '@/components/delivery/SplashScreen';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { resolvePostAuthPath } from '@/lib/delivery/onboarding';
import '@/app/delivery/delivery.css';

const SPLASH_KEY = 'soyol_splash_session';

type Phase = 'splash' | 'roles';

function splashAlreadyShown() {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === '1';
  } catch {
    return false;
  }
}

function markSplashShown() {
  try {
    sessionStorage.setItem(SPLASH_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function WelcomePage() {
  const { isLoading, isAuthenticated, isCourier, isCustomer, isAdmin, user } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      let cancelled = false;
      (async () => {
        const role = isAdmin && !isCourier ? 'admin' : isCourier ? 'courier' : isCustomer ? 'customer' : user?.role;
        const path = await resolvePostAuthPath(role);
        if (!cancelled) router.replace(path);
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!splashAlreadyShown()) setPhase('splash');
    else setPhase('roles');
  }, [isLoading, isAuthenticated, isCourier, isCustomer, isAdmin, user?.role, router]);

  const finishSplash = () => {
    markSplashShown();
    try {
      void import('@capacitor/core').then(async ({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) return;
        const { SplashScreen: CapSplash } = await import('@capacitor/splash-screen');
        await CapSplash.hide({ fadeOutDuration: 280 });
      });
    } catch {
      /* ignore */
    }
    setPhase('roles');
  };

  if (isLoading || phase === null || isAuthenticated) return <IOSSpinnerScreen />;

  return (
    <div className="auth-cream ios-root relative min-h-[100dvh] overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 'splash' && <SplashScreen key="splash" onDone={finishSplash} />}

        {phase === 'roles' && (
          <motion.div
            key="roles"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5"
            style={{
              paddingTop: 'max(28px, env(safe-area-inset-top))',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex flex-1 flex-col justify-center pb-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mb-6 inline-flex items-center gap-2.5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#ff4500] text-white shadow-[0_10px_24px_rgba(255,69,0,0.3)]">
                  <Bike className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[16px] font-extrabold tracking-tight text-[var(--auth-ink)]">
                    Soyol <span className="text-[#ff4500]">Delivery</span>
                  </p>
                  <p className="text-[12px] font-semibold text-[var(--auth-muted)]">Үүрэг сонгоно уу</p>
                </div>
              </motion.div>

              <h1 className="auth-title">
                Таны
                <br />
                <span className="text-[#ff4500]">зам эндээс</span>
                <br />
                эхэлнэ
              </h1>
              <p className="auth-subtitle mt-3">
                Хэрэглэгч эсвэл хүргэгчээр нэвтэрч эхлээрэй.
              </p>

              <div className="mt-9 space-y-3">
                <Link href="/sign-in?as=customer" className="auth-btn-ghost">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#0f172a] text-white dark:bg-[#ff4500]">
                    <Package className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[16px] font-bold text-[var(--auth-ink)]">Хэрэглэгч</p>
                    <p className="mt-0.5 text-[13px] font-medium text-[var(--auth-muted)]">
                      Захиалга · live tracking
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[var(--auth-muted)]" strokeWidth={2.2} />
                </Link>

                <Link href="/sign-in?as=courier" className="auth-btn-dark">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15 text-white">
                    <Bike className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[16px] font-bold text-white">Хүргэгч</p>
                    <p className="mt-0.5 text-[13px] font-medium text-white/80">
                      Бэлэн бараа · ажил эхлэх
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/50" strokeWidth={2.2} />
                </Link>
              </div>

              <div className="mt-10 space-y-3 text-center">
                <p className="text-[13px] font-medium text-[var(--auth-muted)]">
                  Шинэ хэрэглэгч?{' '}
                  <Link href="/sign-up?as=customer" className="font-bold text-[#ff4500]">
                    Бүртгүүлэх
                  </Link>
                </p>
                <p className="text-[13px] font-medium text-[var(--auth-muted)]">
                  Shop-д бүртгэлтэй → хүргэгч болох?{' '}
                  <Link href="/courier/register" className="font-bold text-[#ff4500]">
                    Эрх авах
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
