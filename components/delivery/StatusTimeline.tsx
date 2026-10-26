'use client';

import { STATUS_LABEL, type DeliveryStatus } from './mock-data';

interface StatusTimelineProps {
  items: { status: DeliveryStatus; at: string }[];
  current: DeliveryStatus;
}

const ORDER: DeliveryStatus[] = [
  'CREATED',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
];

export default function StatusTimeline({ items, current }: StatusTimelineProps) {
  const currentIdx = ORDER.indexOf(current);
  const timeByStatus = Object.fromEntries(items.map((i) => [i.status, i.at]));

  return (
    <ol className="space-y-0">
      {ORDER.map((status, idx) => {
        const done = idx <= currentIdx;
        const active = status === current;
        return (
          <li key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1.5 h-2.5 w-2.5 rounded-full ${
                  active
                    ? 'bg-[var(--ios-brand,#FF4500)] ring-[3px] ring-[rgba(255,69,0,0.18)]'
                    : done
                      ? 'bg-[var(--ios-green,#34C759)]'
                      : 'bg-[rgba(120,120,128,0.2)]'
                }`}
              />
              {idx < ORDER.length - 1 && (
                <span
                  className={`w-px flex-1 min-h-[22px] ${
                    idx < currentIdx ? 'bg-[var(--ios-green,#34C759)]' : 'bg-[rgba(120,120,128,0.18)]'
                  }`}
                />
              )}
            </div>
            <div className="flex flex-1 items-baseline justify-between gap-3 pb-3.5">
              <p
                className={`text-[15px] tracking-[-0.24px] ${
                  active
                    ? 'font-semibold text-black'
                    : done
                      ? 'text-black/80'
                      : 'text-[rgba(60,60,67,0.3)]'
                }`}
              >
                {STATUS_LABEL[status]}
              </p>
              <span className="text-[13px] tabular-nums text-[rgba(60,60,67,0.45)]">
                {timeByStatus[status] || '—'}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
