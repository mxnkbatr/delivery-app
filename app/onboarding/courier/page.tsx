'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, MapPinned, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import RoleOnboarding from '@/components/delivery/onboarding/RoleOnboarding';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { markOnboardingSeen } from '@/lib/delivery/onboarding';
import { resolveCourierHomePath } from '@/lib/delivery/courierHome';

const SLIDES = [
  {
    id: 'accept',
    eyebrow: 'Ажил',
    title: 'Ойрхон бараа\nаваад эхлэ',
    body: 'Бэлэн захиалгуудыг хараад нэг товчоор авна. Авсан бол шууд хүргэлт рүү орно.',
    icon: Bike,
    accent: 'from-[#ff6a33] to-[#ff4500]',
  },
  {
    id: 'route',
    eyebrow: 'Зам',
    title: 'Газрын зураг\n· зай · ETA',
    body: 'Хүргэх хаяг руу замыг апп дотроо хараад, зай болон ETA-г тодорхой мэднэ.',
    icon: MapPinned,
    accent: 'from-[#0f172a] to-[#334155]',
  },
  {
    id: 'earn',
    eyebrow: 'Орлого',
    title: 'Хүргээд\nорлогоо ав',
    body: 'OTP баталгаажуулаад хүргэлтээ дуусгана — орлого, түүх тодорхой харагдана.',
    icon: Wallet,
    accent: 'from-[#16a34a] to-[#15803d]',
  },
] as const;

export default function CourierOnboardingPage() {
  const { isLoading, isAuthenticated, isCourier, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/sign-in?as=courier');
      return;
    }
    if (!isCourier && !isAdmin) {
      router.replace('/onboarding/customer');
    }
  }, [isLoading, isAuthenticated, isCourier, isAdmin, router]);

  const finish = async () => {
    markOnboardingSeen('courier');
    const path = await resolveCourierHomePath();
    router.replace(path);
  };

  if (isLoading || !isAuthenticated || (!isCourier && !isAdmin)) {
    return <IOSSpinnerScreen />;
  }

  return (
    <RoleOnboarding
      slides={SLIDES}
      brandLabel="Хүргэгч"
      finishLabel="Ажил руу"
      onFinish={() => {
        void finish();
      }}
    />
  );
}
