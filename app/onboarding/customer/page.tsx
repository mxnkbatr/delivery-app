'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPinned, PackageCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import RoleOnboarding from '@/components/delivery/onboarding/RoleOnboarding';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { markOnboardingSeen } from '@/lib/delivery/onboarding';

const SLIDES = [
  {
    id: 'order',
    eyebrow: 'Захиалга',
    title: 'Хүргэлтээ\nамархан захиал',
    body: 'Хаяг, бараагаа оруулаад захиалгаа баталгаажуулна — бүх алхам нэг апп дээр.',
    icon: PackageCheck,
    accent: 'from-[#ff6a33] to-[#ff4500]',
  },
  {
    id: 'track',
    eyebrow: 'Live map',
    title: 'Хүргэгчээ\nшууд харна',
    body: 'Хүргэгч хаана явж байгааг газрын зураг дээр харж, ойртоход мэдэгдэл авна.',
    icon: MapPinned,
    accent: 'from-[#0f172a] to-[#334155]',
  },
  {
    id: 'receive',
    eyebrow: 'Хүлээн авалт',
    title: 'OTP-оор\nнайдвартай ав',
    body: 'Хүргэлт ирэхэд OTP код, чат, залгалтаар баталгаажуулж аюулгүй авна.',
    icon: ShieldCheck,
    accent: 'from-[#16a34a] to-[#15803d]',
  },
] as const;

export default function CustomerOnboardingPage() {
  const { isLoading, isAuthenticated, isCustomer, isCourier, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/sign-in?as=customer');
      return;
    }
    if (isCourier && !isCustomer) {
      router.replace('/onboarding/courier');
    }
  }, [isLoading, isAuthenticated, isCustomer, isCourier, router]);

  const finish = () => {
    markOnboardingSeen('customer');
    router.replace('/customer');
  };

  if (isLoading || !isAuthenticated || (isCourier && !isCustomer && !isAdmin)) {
    return <IOSSpinnerScreen />;
  }

  return (
    <RoleOnboarding
      slides={SLIDES}
      brandLabel="Хэрэглэгч"
      finishLabel="Захиалга руу"
      onFinish={finish}
    />
  );
}
