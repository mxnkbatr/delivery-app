'use client';

import { MapPin, Navigation, Share2, X } from 'lucide-react';

type Props = {
  role: 'customer' | 'courier';
  sharing: boolean;
  onStart: () => void;
  onStop?: () => void;
  distanceM: number | null;
  peerSharing: boolean;
  proximity?: boolean;
  error?: string | null;
  courierToDropoffM?: number | null;
};

function fmt(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

/** Share toggle + distance strip for live mutual tracking */
export function LiveLocationShareBar({
  role,
  sharing,
  onStart,
  onStop,
  distanceM,
  peerSharing,
  proximity,
  error,
  courierToDropoffM,
}: Props) {
  const peerLabel = role === 'customer' ? 'Хүргэгч' : 'Захиалагч';

  return (
    <div className="rounded-[16px] bg-[#f3f4f6] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            proximity ? 'bg-[#16a34a] text-white' : 'bg-white text-[var(--ios-brand)]'
          }`}
        >
          <Navigation className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-[#111827]">
            {distanceM != null
              ? proximity
                ? `${peerLabel} ойрхон · ${fmt(distanceM)}`
                : `${peerLabel} хүртэл ${fmt(distanceM)}`
              : sharing
                ? peerSharing
                  ? 'Байршил холбогдож байна…'
                  : `${peerLabel} байршил хүлээж байна`
                : 'Байршил хуваалцах'}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ios-secondary)]">
            {role === 'customer'
              ? sharing
                ? 'Таны байршил хүргэгчид харагдана · 200м дотор мэдэгдэнэ'
                : 'Хуваалцвал хоёулаа map дээр харагдана'
              : courierToDropoffM != null
                ? `Хаяг хүртэл ${fmt(courierToDropoffM)}`
                : 'Захиалагчийн байршил ирэхэд зай гарна'}
          </p>
        </div>
        {role === 'customer' &&
          (sharing ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#6b7280]"
              aria-label="Зогсоох"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--ios-brand)] px-3.5 text-[12px] font-bold text-white"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          ))}
        {role === 'courier' && sharing && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#16a34a]">
            <MapPin className="h-3 w-3" />
            Live
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] font-medium text-[#dc2626]">{error}</p>}
    </div>
  );
}
