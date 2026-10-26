/** Courier-facing formatting helpers (address, phone, contact, package). */

const JUNK = new Set(['', '-', '—', '.', ',', 'k', 'K', 'null', 'undefined', 'n/a', 'N/A']);

function cleanPart(v: unknown): string {
  const t = String(v ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .trim();
  if (!t || JUNK.has(t)) return '';
  // lone punctuation / 1-char junk often from empty door fields
  if (t.length <= 1 && !/\d/.test(t)) return '';
  return t;
}

type ShippingLike = Record<string, unknown> | null | undefined;

/** Build a readable dropoff line; skip empty door/floor leftovers. */
export function formatDropoffText(shipping: ShippingLike, fallbackAddress?: string): string {
  const s = shipping || {};
  const district = cleanPart(s.district);
  const city = cleanPart(s.city);
  const khorooRaw = cleanPart(s.khoroo);
  const khoroo = khorooRaw
    ? /\bхороо\b|\bбаг\b/i.test(khorooRaw)
      ? khorooRaw
      : `${khorooRaw}-р хороо`
    : '';
  const street = cleanPart(s.street);
  const entrance = cleanPart(s.entrance);
  const floor = cleanPart(s.floor);
  const door = cleanPart(s.door);
  const apartment = cleanPart(s.apartment);

  const details: string[] = [];
  if (street) details.push(street);
  if (entrance) details.push(`Орц ${entrance}`);
  if (floor) details.push(`${floor} давхар`);
  if (door) details.push(`Хаалга ${door}`);
  if (apartment && apartment !== door) details.push(`Байр ${apartment}`);

  const structured = [city && city !== 'Улаанбаатар' ? city : '', district, khoroo, ...details]
    .filter(Boolean)
    .join(', ');

  if (structured) return structured;

  // Fall back to prebuilt address string, but scrub trailing junk commas
  const raw = cleanPart(s.address) || cleanPart(fallbackAddress);
  if (!raw) return '';
  return raw
    .replace(/(,\s*)+/g, ', ')
    .replace(/,\s*(Орц|Давхар|Хаалга):\s*(,|$)/gi, '$2')
    .replace(/,\s*$/g, '')
    .replace(/^\s*,\s*/g, '')
    .trim();
}

export function formatCustomerName(shipping: ShippingLike, orderPhone?: unknown): string {
  const s = shipping || {};
  const name = cleanPart(s.fullName) || cleanPart(s.name);
  const phone = normalizePhone(s.phone) || normalizePhone(orderPhone);
  if (name && phone && digitsOnly(name) === phone) return 'Захиалагч';
  return name || 'Захиалагч';
}

export function formatCustomerPhone(shipping: ShippingLike, orderPhone?: unknown): string {
  const s = shipping || {};
  return normalizePhone(s.phone) || normalizePhone(orderPhone) || '';
}

/** "Name · phone" without duplicating when name is the phone. */
export function formatContactLine(name: string, phone: string): string {
  const n = cleanPart(name);
  const p = normalizePhone(phone);
  if (!n && !p) return '';
  if (!p) return n;
  if (!n || n === 'Захиалагч') return p;
  if (digitsOnly(n) === p) return p;
  return `${n} · ${p}`;
}

function digitsOnly(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export function normalizePhone(v: unknown): string {
  const d = digitsOnly(v);
  if (d.length < 8) return '';
  return d;
}

export function formatTime24(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

const SIZE_MN: Record<string, string> = {
  small: 'Жижиг багц',
  medium: 'Дунд багц ~5кг',
  large: 'Том багц',
  xl: 'Маш том багц',
};

export type PackageCategory = 'general' | 'food' | 'electronics' | 'fragile';

export type PackageSafeInfo = {
  title: string;
  sizeLabel: string;
  qty: number;
  qtyLabel: string;
  category: PackageCategory;
  privacyNote: string;
  badges: { id: string; label: string; tone: 'neutral' | 'warn' | 'cold' | 'ok' }[];
};

function normalizeCategory(v: unknown): PackageCategory {
  const s = String(v || '').toLowerCase();
  if (s.includes('food') || s.includes('хүнс') || s === 'grocery') return 'food';
  if (s.includes('electro') || s.includes('device') || s.includes('gadget')) return 'electronics';
  if (s.includes('fragile') || s.includes('glass')) return 'fragile';
  return 'general';
}

export function formatPackageTag(o: Record<string, unknown> | null | undefined): string {
  const info = buildPackageSafeInfo(o || {});
  return info.title;
}

/** Courier-safe package summary — no product names. */
export function buildPackageSafeInfo(
  o: Record<string, unknown> | null | undefined
): PackageSafeInfo {
  const src = o || {};
  const handling = (src.packageHandling || {}) as {
    fragile?: boolean;
    upright?: boolean;
    horizontal?: boolean;
    coldChain?: boolean;
    nonBreakable?: boolean;
  };
  const items = Array.isArray(src.items) ? src.items : [];
  const qty =
    Number(src.packageCount) ||
    items.reduce((s: number, it: any) => s + (Number(it.quantity || it.qty) || 1), 0) ||
    1;
  const sizeKey = String(src.packageSize || '').toLowerCase();
  let sizeLabel = SIZE_MN[sizeKey] || '';
  if (!sizeLabel) {
    if (qty >= 5) sizeLabel = 'Том багц';
    else if (qty >= 2) sizeLabel = 'Дунд багц';
    else sizeLabel = String(src.packageLabel || 'Жижиг багц');
  }

  const category = normalizeCategory(src.packageCategory || (handling as any).category);
  const fragile = !!(handling.fragile ?? src.fragile);
  const upright = !!(handling.upright ?? src.upright);
  const horizontal = !!handling.horizontal;
  const coldChain = !!(handling.coldChain ?? src.coldChain) || category === 'food';
  const nonBreakable = !!handling.nonBreakable && !fragile;

  const badges: PackageSafeInfo['badges'] = [
    { id: 'qty', label: `${qty} ширхэг`, tone: 'neutral' },
  ];
  if (fragile || category === 'fragile' || category === 'electronics') {
    badges.push({ id: 'fragile', label: 'Болгоомжтой', tone: 'warn' });
  } else if (nonBreakable) {
    badges.push({ id: 'sturdy', label: 'Эвдрэхгүй', tone: 'ok' });
  }
  if (upright) badges.push({ id: 'upright', label: 'Босоо байрлалтай', tone: 'neutral' });
  if (horizontal) badges.push({ id: 'flat', label: 'Хэвтээ байрлалтай', tone: 'neutral' });
  if (coldChain) badges.push({ id: 'cold', label: 'Хүйтэн гинж', tone: 'cold' });

  return {
    title: `${sizeLabel} · ${qty} ширхэг`,
    sizeLabel,
    qty,
    qtyLabel: `${qty} ширхэг`,
    category,
    privacyNote: 'Захиалагчийн нууцлалын дагуу зөвхөн хэмжээ, тоо харагдана',
    badges,
  };
}
