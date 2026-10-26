import { resolveCourierHomePath } from '@/lib/delivery/courierHome';

export type OnboardRole = 'customer' | 'courier';

const KEYS: Record<OnboardRole, string> = {
  customer: 'soyol_onboard_customer_v1',
  courier: 'soyol_onboard_courier_v1',
};

export function hasSeenOnboarding(role: OnboardRole): boolean {
  try {
    return localStorage.getItem(KEYS[role]) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingSeen(role: OnboardRole): void {
  try {
    localStorage.setItem(KEYS[role], '1');
  } catch {
    /* ignore */
  }
}

/** After login/signup: onboarding if needed, else role home */
export async function resolvePostAuthPath(
  role: string | undefined | null
): Promise<string> {
  if (role === 'admin') return '/delivery/admin';
  if (role === 'courier') {
    if (!hasSeenOnboarding('courier')) return '/onboarding/courier';
    return resolveCourierHomePath();
  }
  if (!hasSeenOnboarding('customer')) return '/onboarding/customer';
  return '/customer';
}

export function onboardingPathForRole(role: OnboardRole): string {
  return role === 'courier' ? '/onboarding/courier' : '/onboarding/customer';
}
