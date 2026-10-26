'use client';

import Link from 'next/link';
import { Bike, MessageCircle, Phone, UserRound } from 'lucide-react';
import { DeliveryContactBar } from '@/components/delivery/DeliveryContactBar';

export type CustomerCourierInfo = {
  id: string;
  name: string;
  phone: string;
  vehicleLabel?: string | null;
  flowStepLabel?: string | null;
  pickedUp?: boolean;
};

/** Compact courier row for lists (no chat sheet). */
export function CourierSnippet({
  courier,
  statusLabel,
}: {
  courier: CustomerCourierInfo | null | undefined;
  statusLabel?: string;
}) {
  if (!courier) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-[#f3f4f6] px-3 py-2.5">
        <UserRound className="h-4 w-4 text-[#9ca3af]" />
        <p className="text-[12px] font-semibold text-[#6b7280]">
          {statusLabel || 'Хүргэгч томилогдоогүй'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-[rgba(255,69,0,0.06)] px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ios-brand)] text-[13px] font-bold text-white">
        {(courier.name || 'Х').slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#111827]">{courier.name}</p>
        <p className="truncate text-[11px] font-medium text-[#6b7280]">
          {[courier.vehicleLabel, courier.flowStepLabel || statusLabel, courier.pickedUp ? 'Бараа авсан' : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {courier.phone ? (
        <a
          href={`tel:${courier.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--ios-brand)] shadow-sm"
          aria-label="Залгах"
        >
          <Phone className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}

/** Full courier card with chat/call for detail & track. */
export function CustomerCourierPanel({
  orderId,
  courier,
  statusLabel,
  autoOpenChat = false,
}: {
  orderId: string;
  courier: CustomerCourierInfo | null | undefined;
  statusLabel?: string;
  autoOpenChat?: boolean;
}) {
  if (!courier) {
    return (
      <div className="dl-card p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
          Хүргэгч
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f4f6]">
            <Bike className="h-5 w-5 text-[#9ca3af]" />
          </div>
          <div>
            <p className="text-[15px] font-bold">Томилогдоогүй</p>
            <p className="mt-0.5 text-[12px] text-[var(--ios-secondary)]">
              {statusLabel || 'Админ хүргэгч олгоход энд харагдана'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dl-card overflow-hidden p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ios-secondary)]">
        Таны хүргэгч
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a45] to-[#ff4500] text-[16px] font-bold text-white">
          {(courier.name || 'Х').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{courier.name}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--ios-secondary)]">
            {[courier.vehicleLabel, courier.flowStepLabel, courier.pickedUp ? 'Бараа авсан' : null]
              .filter(Boolean)
              .join(' · ') || 'Хүргэлтэнд'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <DeliveryContactBar
          orderId={orderId}
          peerName={courier.name}
          peerPhone={courier.phone}
          peerRoleLabel="Хүргэгч"
          avatarLetter={(courier.name || 'Х').slice(0, 1)}
          autoOpen={autoOpenChat}
        />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[#9ca3af]">
        <MessageCircle className="h-3 w-3" />
        Чат · залгалтаар хүргэгчтэй шууд холбогдоно
      </p>
    </div>
  );
}

export function TrackCta({ orderId }: { orderId: string }) {
  return (
    <Link
      href={`/delivery/track/${orderId}?token=demo`}
      className="dl-cta"
    >
      Live map · байршил
    </Link>
  );
}
