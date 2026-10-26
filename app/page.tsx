'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { resolvePostAuthPath } from '@/lib/delivery/onboarding';

/** App root → post-auth path (onboarding or role home). */
export default function HomeRedirect() {
  const { isLoading, isAuthenticated, isCourier, isCustomer, isAdmin, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/welcome');
      return;
    }
    let cancelled = false;
    (async () => {
      const role =
        isAdmin && !isCourier
          ? 'admin'
          : isCourier
            ? 'courier'
            : isCustomer
              ? 'customer'
              : user?.role;
      const path = await resolvePostAuthPath(role);
      if (!cancelled) router.replace(path);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, isCourier, isCustomer, isAdmin, user?.role, router]);

  return <IOSSpinnerScreen />;
}
