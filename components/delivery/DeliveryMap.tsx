'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';

type MapMode = 'track' | 'courier' | 'admin';

export type MapLatLng = { lat: number; lng: number };

export type OrderMapPin = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  payLabel?: string;
  selected?: boolean;
};

interface DeliveryMapProps {
  mode?: MapMode;
  className?: string;
  courierProgress?: number;
  markers?: { id: string; x: number; y: number; live?: boolean; label?: string }[];
  /** Light street-map look like consumer tracking apps */
  light?: boolean;
  hideOverlay?: boolean;
  /** Live GPS pins */
  courierPos?: MapLatLng | null;
  customerPos?: MapLatLng | null;
  dropoffPos?: MapLatLng | null;
  /** Nearby / ready order pins on courier live map */
  orderPins?: OrderMapPin[];
  onOrderPinClick?: (id: string) => void;
  overlayTitle?: string;
  overlaySubtitle?: string;
  /** Distance between courier ↔ customer in meters */
  distanceM?: number | null;
  proximity?: boolean;
  /** Whose screen — pin labels */
  viewerRole?: 'customer' | 'courier';
  /** Force stylized SVG (skip real street map) */
  stylizedOnly?: boolean;
}

const StreetMap = dynamic(() => import('./StreetMap'), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

function MapLoadingPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--ios-fill,#eef1f4)] text-[12px] font-semibold text-[var(--ios-secondary,#6b7280)]">
      Газрын зураг ачаалж байна…
    </div>
  );
}

function project(
  points: { key: string; lat: number; lng: number }[]
): Record<string, { x: number; y: number }> {
  if (points.length === 0) return {};
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.45, 0.004);
  const padLng = Math.max((maxLng - minLng) * 0.45, 0.004);
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;
  const dLat = maxLat - minLat || 0.01;
  const dLng = maxLng - minLng || 0.01;
  const out: Record<string, { x: number; y: number }> = {};
  for (const p of points) {
    out[p.key] = {
      x: 28 + ((p.lng - minLng) / dLng) * 344,
      y: 28 + ((maxLat - p.lat) / dLat) * 224,
    };
  }
  return out;
}

function formatDistance(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

function StylizedMap({
  mode = 'track',
  className = '',
  courierProgress = 0.62,
  markers = [],
  light = false,
  hideOverlay = false,
  courierPos = null,
  customerPos = null,
  dropoffPos = null,
  orderPins = [],
  onOrderPinClick,
  overlayTitle = 'Улаанбаатар',
  overlaySubtitle = 'Live route',
  distanceM = null,
  proximity = false,
  viewerRole = 'customer',
}: DeliveryMapProps) {
  const { isDark } = useTheme();
  const customerLabel = viewerRole === 'customer' ? 'Та' : 'Захиалагч';
  const courierLabel = viewerRole === 'courier' ? 'Та' : 'Хүргэгч';
  const pinX = 40 + courierProgress * 140;
  const pinY = 150 - courierProgress * 70;
  // Follow app theme: dark mode → dark stylized map (ignore forced light prop)
  const isLight = !isDark && (light || mode === 'track');
  const hasOrderPins = orderPins.length > 0;
  const liveMode = !!(courierPos || customerPos) && !hasOrderPins;

  const projected = hasOrderPins
    ? project(
        [
          courierPos ? { key: 'courier', ...courierPos } : null,
          ...orderPins.map((p) => ({ key: `o-${p.id}`, lat: p.lat, lng: p.lng })),
        ].filter(Boolean) as { key: string; lat: number; lng: number }[]
      )
    : liveMode
      ? project(
          [
            courierPos ? { key: 'courier', ...courierPos } : null,
            customerPos ? { key: 'customer', ...customerPos } : null,
            dropoffPos ? { key: 'dropoff', ...dropoffPos } : null,
          ].filter(Boolean) as { key: string; lat: number; lng: number }[]
        )
      : {};

  const cxy = projected.courier;
  const uxy = projected.customer;
  const dxy = projected.dropoff;
  const distLabel = formatDistance(distanceM);
  const selectedPin = orderPins.find((p) => p.selected) || orderPins[0];
  const selectedXy = selectedPin ? projected[`o-${selectedPin.id}`] : null;

  const road = isLight ? 'rgba(210, 214, 220, 0.95)' : 'rgba(238,241,239,0.14)';
  const road2 = isLight ? 'rgba(225, 228, 234, 0.9)' : 'rgba(238,241,239,0.1)';
  const grid = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(238,241,239,0.06)';
  const bg = isLight ? '#e8eaef' : undefined;
  const route = isLight ? '#1c1c1e' : 'rgba(255,69,0,0.9)';
  const showStaticRoute = !liveMode && !hasOrderPins;

  return (
    <div
      className={`dl-map-surface relative overflow-hidden ${className}`}
      style={bg ? { background: bg } : undefined}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 280"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden={!onOrderPinClick}
      >
        <defs>
          <pattern id="dl-grid-light" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke={grid} strokeWidth="1" />
          </pattern>
          <filter id="glow-drop" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="400" height="280" fill={isLight ? '#e8eaef' : 'url(#dl-grid-light)'} />
        {isLight && <rect width="400" height="280" fill="url(#dl-grid-light)" />}

        <path
          d="M-20 210 C 80 190, 120 140, 200 150 S 320 200, 430 160"
          fill="none"
          stroke={road}
          strokeWidth={isLight ? 22 : 18}
        />
        <path
          d="M40 -10 C 90 80, 110 120, 180 160 S 280 220, 360 290"
          fill="none"
          stroke={road2}
          strokeWidth={isLight ? 16 : 12}
        />
        <path d="M-10 80 H 420" fill="none" stroke={road2} strokeWidth={isLight ? 14 : 10} />

        {showStaticRoute && (
          <>
            <path
              d="M72 188 C 120 170, 150 140, 190 120 S 260 90, 312 78"
              fill="none"
              stroke={route}
              strokeWidth={isLight ? 4.5 : 3}
              strokeLinecap="round"
              className={isLight ? undefined : 'dl-route-dash'}
            />
            <circle
              cx="72"
              cy="188"
              r="8"
              fill={isLight ? '#fff' : '#eef1ef'}
              stroke={isLight ? '#ccc' : 'none'}
              strokeWidth="2"
            />
            <circle
              cx="312"
              cy="78"
              r="18"
              fill="rgba(255,69,0,0.25)"
              filter={isLight ? 'url(#glow-drop)' : undefined}
            />
            <circle cx="312" cy="78" r="10" fill="#FF4500" />
            <circle cx="312" cy="78" r="4" fill="#fff" />
            {mode !== 'admin' && (
              <g>
                <circle cx={pinX} cy={pinY} r="22" fill="rgba(255,255,255,0.95)" />
                <circle cx={pinX} cy={pinY} r="18" fill="#fff" stroke="#e5e5ea" strokeWidth="2" />
                <circle cx={pinX - 5} cy={pinY + 4} r="3.2" fill="#FFB800" />
                <circle cx={pinX + 6} cy={pinY + 4} r="3.2" fill="#FFB800" />
                <path
                  d={`M ${pinX - 5} ${pinY + 4} L ${pinX + 2} ${pinY + 4} L ${pinX + 1} ${pinY - 4} L ${pinX - 2} ${pinY - 4} Z`}
                  fill="#1c1c1e"
                />
                <rect x={pinX - 1} y={pinY - 8} width="3" height="5" rx="1" fill="#FF4500" />
              </g>
            )}
          </>
        )}

        {hasOrderPins && cxy && selectedXy && (
          <path
            d={`M ${cxy.x} ${cxy.y} Q ${(cxy.x + selectedXy.x) / 2} ${Math.min(cxy.y, selectedXy.y) - 28} ${selectedXy.x} ${selectedXy.y}`}
            fill="none"
            stroke="rgba(255,69,0,0.95)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="7 6"
            className="dl-route-dash"
          />
        )}

        {liveMode && cxy && uxy && (
          <line
            x1={cxy.x}
            y1={cxy.y}
            x2={uxy.x}
            y2={uxy.y}
            stroke={proximity ? '#16a34a' : '#FF4500'}
            strokeWidth="3"
            strokeDasharray="8 6"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}

        {liveMode && dxy && (
          <g>
            <circle cx={dxy.x} cy={dxy.y} r="16" fill="rgba(255,69,0,0.2)" />
            <circle cx={dxy.x} cy={dxy.y} r="9" fill="#FF4500" />
            <circle cx={dxy.x} cy={dxy.y} r="3.5" fill="#fff" />
          </g>
        )}

        {liveMode && uxy && (
          <g>
            <circle cx={uxy.x} cy={uxy.y} r="18" fill="rgba(37,99,235,0.22)" className="dl-pulse" />
            <circle cx={uxy.x} cy={uxy.y} r="12" fill="#fff" stroke="#2563eb" strokeWidth="2.5" />
            <circle cx={uxy.x} cy={uxy.y} r="5" fill="#2563eb" />
            <text
              x={uxy.x}
              y={uxy.y - 20}
              textAnchor="middle"
              fill="#1e3a8a"
              fontSize="11"
              fontWeight="700"
            >
              {customerLabel}
            </text>
          </g>
        )}

        {(liveMode || hasOrderPins) && cxy && (
          <g>
            <circle cx={cxy.x} cy={cxy.y} r="20" fill="rgba(255,255,255,0.18)" className="dl-pulse" />
            <circle cx={cxy.x} cy={cxy.y} r="15" fill="#fff" />
            <circle cx={cxy.x - 4} cy={cxy.y + 3} r="2.6" fill="#FFB800" />
            <circle cx={cxy.x + 5} cy={cxy.y + 3} r="2.6" fill="#FFB800" />
            <path
              d={`M ${cxy.x - 4} ${cxy.y + 3} L ${cxy.x + 2} ${cxy.y + 3} L ${cxy.x + 1} ${cxy.y - 3} L ${cxy.x - 1.5} ${cxy.y - 3} Z`}
              fill="#1c1c1e"
            />
            {!hasOrderPins && (
              <text
                x={cxy.x}
                y={cxy.y - 22}
                textAnchor="middle"
                fill={isLight ? '#9a3412' : '#fff'}
                fontSize="11"
                fontWeight="700"
              >
                {courierLabel}
              </text>
            )}
          </g>
        )}

        {hasOrderPins &&
          orderPins.map((p) => {
            const xy = projected[`o-${p.id}`];
            if (!xy) return null;
            const selected = !!p.selected || p.id === selectedPin?.id;
            return (
              <g
                key={p.id}
                className={onOrderPinClick ? 'cursor-pointer' : undefined}
                onClick={() => onOrderPinClick?.(p.id)}
                style={{ pointerEvents: onOrderPinClick ? 'auto' : 'none' }}
              >
                <circle
                  cx={xy.x}
                  cy={xy.y}
                  r={selected ? 22 : 14}
                  fill="rgba(255,69,0,0.28)"
                  className={selected ? 'dl-pulse' : undefined}
                />
                <circle cx={xy.x} cy={xy.y} r={selected ? 11 : 8} fill="#FF4500" />
                <circle cx={xy.x} cy={xy.y} r={selected ? 4.5 : 3} fill="#fff" />
                {selected && p.payLabel && (
                  <g>
                    <rect
                      x={xy.x - 28}
                      y={xy.y - 34}
                      width="56"
                      height="18"
                      rx="9"
                      fill="rgba(11,18,16,0.82)"
                    />
                    <text
                      x={xy.x}
                      y={xy.y - 21}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="10"
                      fontWeight="700"
                    >
                      {p.payLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        {mode === 'admin' &&
          markers.map((m) => (
            <g key={m.id}>
              {m.live && (
                <circle cx={m.x} cy={m.y} r="14" fill="rgba(15,122,90,0.28)" className="dl-pulse" />
              )}
              <circle cx={m.x} cy={m.y} r="7" fill={m.live ? '#0f7a5a' : 'rgba(120,120,128,0.35)'} />
            </g>
          ))}
      </svg>

      {distLabel && liveMode && (
        <div
          className={`pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[13px] font-bold shadow-md ${
            proximity ? 'bg-[#16a34a] text-white' : 'bg-white/95 text-[#111827]'
          }`}
        >
          {proximity ? `Ойрхон · ${distLabel}` : `${distLabel} хол`}
        </div>
      )}

      {hasOrderPins && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          {orderPins.length} захиалга
        </div>
      )}

      {!hideOverlay && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between"
        >
          {!isLight && (
            <div className="rounded-xl bg-[rgba(11,18,16,0.55)] px-3 py-2 text-[#eef1ef] backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">{overlayTitle}</p>
              <p className="text-lg font-bold text-white">{overlaySubtitle}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function DeliveryMap(props: DeliveryMapProps) {
  const {
    className = '',
    light = false,
    hideOverlay = false,
    courierPos = null,
    customerPos = null,
    dropoffPos = null,
    orderPins = [],
    onOrderPinClick,
    overlayTitle = 'Улаанбаатар',
    overlaySubtitle = 'Live map',
    distanceM = null,
    proximity = false,
    viewerRole = 'customer',
    stylizedOnly = false,
    mode = 'track',
    markers = [],
  } = props;

  const hasGeo =
    !!(courierPos || customerPos || dropoffPos) ||
    orderPins.some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  // Admin pixel markers without GPS → keep stylized map
  const adminFakeOnly = mode === 'admin' && markers.length > 0 && !hasGeo;

  if (!stylizedOnly && hasGeo && !adminFakeOnly) {
    return (
      <StreetMap
        className={className}
        light={light || mode === 'track'}
        hideOverlay={hideOverlay}
        courierPos={courierPos}
        customerPos={customerPos}
        dropoffPos={dropoffPos}
        orderPins={orderPins}
        onOrderPinClick={onOrderPinClick}
        overlayTitle={overlayTitle}
        overlaySubtitle={overlaySubtitle}
        distanceM={distanceM}
        proximity={proximity}
        viewerRole={viewerRole}
      />
    );
  }

  return <StylizedMap {...props} />;
}
