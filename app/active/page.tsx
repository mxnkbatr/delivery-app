'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { resolveCourierHomePath } from '@/lib/delivery/courierHome';

/** Legacy /active → идэвхтэй хүргэлт эсвэл /work */
export default function ActiveRedirectPage() {
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
