'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { resolveCourierHomePath } from '@/lib/delivery/courierHome';

/** Авсан захиалга байвал шууд хүргэлтийн дэлгэц рүү */
export default function AcceptedRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = await resolveCourierHomePath();
      if (!cancelled) router.replace(path);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  return <IOSSpinnerScreen />;
}
