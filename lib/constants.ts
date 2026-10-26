/**
 * Site-wide constants: branding, nav links, filter options, animation variants.
 * Import from here instead of scattering magic strings/numbers.
 */

export const SITE_CONFIG = {
  name: 'Soyol Delivery',
  description: 'Хурдан, найдвартай хүргэлт',
  phone: '77-181818',
  email: 'info@soyolvideoshop.mn',
} as const;

export const NAV_LINKS = [
  { id: 'home', label: 'Ажил', href: '/' },
  { id: 'history', label: 'Түүх', href: '/history' },
  { id: 'me', label: 'Профайл', href: '/me' },
  { id: 'dispatch', label: 'Dispatch', href: '/delivery/admin' },
  { id: 'track', label: 'Tracking', href: '/delivery/track/ord_88421?token=demo' },
] as const;

export const FILTER_OPTIONS = [
  { id: 'all', label: 'Бүгд', icon: 'Grid' },
  { id: 'today', label: 'Өнөөдөр', icon: 'Sparkles' },
  { id: 'new', label: 'Шинэ', icon: 'TrendingUp' },
  { id: 'featured', label: 'Онцлох', icon: 'Star' },
  { id: 'sale', label: 'Хямдрал', icon: 'Flame' },
] as const;

export const ANIMATION_VARIANTS = {
  fadeIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideIn: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
} as const;
