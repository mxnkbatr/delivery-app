/** Resolve courier pay from order fields (admin payout, else customer shipping fee). */

export function orderCourierPayout(o: Record<string, unknown> | null | undefined): number {
  const src = o || {};
  const explicit = Number(src.courierPayout);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const fee = Number(src.shippingCost ?? src.shippingFee);
  if (Number.isFinite(fee) && fee > 0) return Math.round(fee);
  return 0;
}

export function orderCourierTotal(o: Record<string, unknown> | null | undefined): number {
  const src = o || {};
  return (
    orderCourierPayout(src) +
    Math.max(0, Math.round(Number(src.courierTip) || 0)) +
    Math.max(0, Math.round(Number(src.courierBonus) || 0))
  );
}

export function formatMoneyMNT(n: number | null | undefined, empty = '—') {
  if (n == null || !Number.isFinite(n)) return empty;
  if (n <= 0) return empty;
  return `₮${Math.round(n).toLocaleString('mn-MN')}`;
}
