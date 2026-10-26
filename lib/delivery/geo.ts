/** Geo helpers for courier distance / ETA / geofence */

export type LatLng = { lat: number; lng: number };

/** Approximate district centers in Ulaanbaatar (fallback when order has no coords) */
export const UB_DISTRICT_COORDS: Record<string, LatLng> = {
  сбд: { lat: 47.918, lng: 106.917 },
  'сүхбаатар': { lat: 47.918, lng: 106.917 },
  бзд: { lat: 47.93, lng: 106.94 },
  'баянзүрх': { lat: 47.93, lng: 106.94 },
  худ: { lat: 47.905, lng: 106.89 },
  'хан-уул': { lat: 47.905, lng: 106.89 },
  бгд: { lat: 47.91, lng: 106.87 },
  'баянгол': { lat: 47.91, lng: 106.87 },
  чд: { lat: 47.915, lng: 106.9 },
  'чингис': { lat: 47.915, lng: 106.9 },
  'чингилтэй': { lat: 47.925, lng: 106.905 },
  нсд: { lat: 47.95, lng: 106.92 },
  'налайх': { lat: 47.77, lng: 107.3 },
};

export const DEFAULT_UB: LatLng = { lat: 47.9184, lng: 106.9177 };

/** Geofence radius in meters — complete only within this distance */
export const ARRIVAL_GEOFENCE_M = 180;
export const COMPLETE_GEOFENCE_M = 250;

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateEtaMin(distanceM: number, vehicleType?: string): number {
  // rough city speeds km/h
  const speed =
    vehicleType === 'car' ? 28 : vehicleType === 'foot' ? 5 : 22;
  const hours = distanceM / 1000 / speed;
  return Math.max(3, Math.round(hours * 60));
}

export function resolveDropoffCoords(shipping: Record<string, unknown> | null | undefined): LatLng {
  if (!shipping) return DEFAULT_UB;
  const lat = Number(shipping.lat);
  const lng = Number(shipping.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng };
  }
  const district = String(shipping.district || shipping.city || '')
    .toLowerCase()
    .trim();
  for (const [key, coords] of Object.entries(UB_DISTRICT_COORDS)) {
    if (district.includes(key)) return coords;
  }
  return DEFAULT_UB;
}

/** True only when order shipping has real GPS — not district/UB fallback. */
export function hasPreciseDropoffCoords(
  shipping: Record<string, unknown> | null | undefined
): boolean {
  if (!shipping) return false;
  const lat = Number(shipping.lat);
  const lng = Number(shipping.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function mapsLinks(dropoff: LatLng, addressText?: string) {
  const q = addressText
    ? encodeURIComponent(addressText)
    : `${dropoff.lat},${dropoff.lng}`;
  const dest = `${dropoff.lat},${dropoff.lng}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    waze: `https://waze.com/ul?ll=${dest}&navigate=yes`,
    search: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

export const COURIER_STEPS = ['accepted', 'en_route', 'arrived', 'completing'] as const;
export type CourierFlowStep = (typeof COURIER_STEPS)[number];

export const STEP_MN: Record<CourierFlowStep, string> = {
  accepted: 'Олгосон',
  en_route: 'Замд',
  arrived: 'Ирсэн',
  completing: 'Дуусгах',
};

export const REJECT_REASONS = [
  { id: 'too_far', label: 'Хэт хол' },
  { id: 'low_pay', label: 'Орлого бага' },
  { id: 'vehicle', label: 'Тээвэр тохирохгүй' },
  { id: 'busy', label: 'Завгүй' },
  { id: 'other', label: 'Бусад' },
] as const;
