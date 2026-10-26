'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DEFAULT_UB } from '@/lib/delivery/geo';
import { getMapBearing, getMapPitch, getMapboxStyle } from '@/lib/delivery/mapStyle';
import { useTheme } from '@/context/ThemeContext';

type MapLatLng = { lat: number; lng: number };

type OrderMapPin = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  payLabel?: string;
  selected?: boolean;
};

type StreetMapProps = {
  className?: string;
  courierPos?: MapLatLng | null;
  customerPos?: MapLatLng | null;
  dropoffPos?: MapLatLng | null;
  orderPins?: OrderMapPin[];
  onOrderPinClick?: (id: string) => void;
  distanceM?: number | null;
  proximity?: boolean;
  viewerRole?: 'customer' | 'courier';
  light?: boolean;
  hideOverlay?: boolean;
  overlayTitle?: string;
  overlaySubtitle?: string;
};

/** Google Maps–like roads + parks (not flat gray light style) */
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
const ROUTE_BLUE = '#2563eb';
const ROUTE_NEAR = '#16a34a';
const FIT_PADDING = { top: 52, bottom: 52, left: 52, right: 52 };

function formatDistance(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

function createUserMarkerEl(badge = 'B') {
  const el = document.createElement('div');
  el.className = 'user-marker-wrap';
  el.innerHTML = `<span class="map-ab-badge map-ab-badge--b">${badge}</span><span class="user-marker"></span>`;
  return el;
}

function createDriverMarkerEl(badge = 'A') {
  const wrapper = document.createElement('div');
  wrapper.className = 'driver-marker-wrapper';

  const pulseOuter = document.createElement('div');
  pulseOuter.className = 'pulse-ring pulse-ring--outer';

  const pulse = document.createElement('div');
  pulse.className = 'pulse-ring';

  const badgeEl = document.createElement('span');
  badgeEl.className = 'map-ab-badge map-ab-badge--a';
  badgeEl.textContent = badge;

  const core = document.createElement('div');
  core.className = 'driver-marker';
  core.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="6.5" cy="16.5" r="2.4" stroke="white" stroke-width="2"/>
    <circle cx="17.5" cy="16.5" r="2.4" stroke="white" stroke-width="2"/>
    <path d="M6.5 16.5h4l2-5h3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.5 11.5V8.5h3" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  wrapper.appendChild(pulseOuter);
  wrapper.appendChild(pulse);
  wrapper.appendChild(badgeEl);
  wrapper.appendChild(core);
  return wrapper;
}

function createOrderMarkerEl(opts: {
  selected?: boolean;
  label?: string;
  onClick?: () => void;
}) {
  const wrap = document.createElement('div');
  wrap.className = `order-marker-wrapper${opts.selected ? ' is-selected' : ''}`;

  if (opts.label) {
    const label = document.createElement('span');
    label.className = 'order-marker-label';
    label.textContent = opts.label;
    wrap.appendChild(label);
  }

  if (opts.selected) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse-ring pulse-ring--brand';
    wrap.appendChild(pulse);
  }

  const pin = document.createElement('div');
  pin.className = 'order-marker-pin';
  pin.innerHTML = `<span class="order-marker-pin-head"></span><span class="order-marker-pin-point"></span>`;
  wrap.appendChild(pin);

  if (opts.onClick) {
    wrap.style.cursor = 'pointer';
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onClick?.();
    });
  }

  return wrap;
}

function straightLine(
  a?: MapLatLng | null,
  b?: MapLatLng | null
): [number, number][] | null {
  if (!a || !b) return null;
  return [
    [a.lng, a.lat],
    [b.lng, b.lat],
  ];
}

/** Road-following route via our Directions proxy (Mapbox) */
async function fetchDrivingRoute(
  a: MapLatLng,
  b: MapLatLng,
  signal?: AbortSignal
): Promise<[number, number][] | null> {
  const qs = new URLSearchParams({
    fromLng: String(a.lng),
    fromLat: String(a.lat),
    toLng: String(b.lng),
    toLat: String(b.lat),
  });
  try {
    const res = await fetch(`/api/delivery/directions?${qs}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.coordinates;
    return Array.isArray(coords) && coords.length >= 2 ? coords : null;
  } catch {
    return null;
  }
}

/** Soften city/POI labels — keep road names for Google-like feel */
function quietPlaceLabels(map: mapboxgl.Map) {
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    const id = layer.id.toLowerCase();
    const hide =
      id.includes('settlement') ||
      id.includes('country') ||
      id.includes('state') ||
      id.includes('continent') ||
      id.includes('poi-label') ||
      id.includes('airport') ||
      id.includes('transit');
    if (!hide) continue;
    try {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    } catch {
      // ignore
    }
  }
}

function add3dBuildings(map: mapboxgl.Map) {
  if (map.getLayer('add-3d-buildings')) return;
  // Some styles already ship extrusion layers
  const existing = (map.getStyle()?.layers || []).some(
    (l) => l.type === 'fill-extrusion' && /building/i.test(l.id)
  );
  if (existing) return;

  const layers = map.getStyle()?.layers || [];
  const labelLayer = layers.find(
    (layer) =>
      layer.type === 'symbol' &&
      !!(layer as mapboxgl.SymbolLayerSpecification).layout?.['text-field']
  );

  const layer: mapboxgl.FillExtrusionLayerSpecification = {
    id: 'add-3d-buildings',
    source: 'composite',
    'source-layer': 'building',
    filter: ['==', ['get', 'extrude'], 'true'],
    type: 'fill-extrusion',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': '#d9dee6',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.72,
    },
  };

  try {
    if (labelLayer?.id) map.addLayer(layer, labelLayer.id);
    else map.addLayer(layer);
  } catch (err) {
    console.warn('[map] 3d buildings', err);
  }
}

function ensureRouteLayers(map: mapboxgl.Map, isDark = false) {
  if (!map.getSource('route')) {
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] },
      },
    });
  }

  const casing = isDark ? '#0b1220' : '#ffffff';

  if (!map.getLayer('route-line-casing')) {
    map.addLayer({
      id: 'route-line-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': casing,
        'line-width': 12,
        'line-opacity': 0.95,
      },
    });
  } else {
    try {
      map.setPaintProperty('route-line-casing', 'line-color', casing);
    } catch {
      /* ignore */
    }
  }

  if (!map.getLayer('route-line')) {
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ROUTE_BLUE,
        'line-width': 6,
        'line-opacity': 1,
      },
    });
  }
}

function setRouteCoords(map: mapboxgl.Map, coords: [number, number][] | null) {
  const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords || [],
    },
  });
}

export default function StreetMap({
  className = '',
  courierPos = null,
  customerPos = null,
  dropoffPos = null,
  orderPins = [],
  onOrderPinClick,
  distanceM = null,
  proximity = false,
  viewerRole = 'customer',
  light = true,
  hideOverlay = false,
  overlayTitle = 'Улаанбаатар',
  overlaySubtitle = 'Live map',
}: StreetMapProps) {
  const { isDark } = useTheme();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const orderMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const onPinClickRef = useRef(onOrderPinClick);
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeKeyRef = useRef('');
  const styleRef = useRef(getMapboxStyle(isDark));
  const [styleEpoch, setStyleEpoch] = useState(0);
  onPinClickRef.current = onOrderPinClick;

  const destination = customerPos || dropoffPos;
  const distLabel = formatDistance(distanceM);

  useEffect(() => {
    if (!TOKEN || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const start = courierPos || destination || DEFAULT_UB;
    const dark = document.documentElement.classList.contains('dark');
    const style = getMapboxStyle(dark);
    styleRef.current = style;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style,
      center: [start.lng, start.lat],
      zoom: 14.2,
      pitch: getMapPitch(dark),
      bearing: getMapBearing(dark),
      attributionControl: false,
      antialias: true,
      fadeDuration: 0,
      trackResize: true,
      cooperativeGestures: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 60,
    });

    const canvas = map.getCanvas();
    canvas.style.touchAction = 'pan-x pan-y';
    (canvas.style as CSSStyleDeclaration & { webkitTransform?: string }).webkitTransform =
      'translateZ(0)';

    map.on('load', () => {
      const d = document.documentElement.classList.contains('dark');
      map.resize();
      map.easeTo({ pitch: getMapPitch(d), bearing: getMapBearing(d), duration: 600 });
      quietPlaceLabels(map);
      // Flat/readable map in dark UI — skip heavy 3D buildings (feels “game-like”)
      if (!d) add3dBuildings(map);
      ensureRouteLayers(map, d);
    });

    // Re-apply if style reloads (theme switch)
    map.on('style.load', () => {
      const d = document.documentElement.classList.contains('dark');
      quietPlaceLabels(map);
      if (!d) add3dBuildings(map);
      ensureRouteLayers(map, d);
      // Force route / pin redraw after basemap swap
      routeKeyRef.current = '';
      (map as mapboxgl.Map & { __fitKey?: string }).__fitKey = undefined;
      (map as mapboxgl.Map & { __orderPinKey?: string }).__orderPinKey = undefined;
      setStyleEpoch((n) => n + 1);
    });

    mapRef.current = map;

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.resize();
          })
        : null;
    if (shellRef.current && ro) ro.observe(shellRef.current);

    return () => {
      routeAbortRef.current?.abort();
      ro?.disconnect();
      driverMarkerRef.current?.remove();
      userMarkerRef.current?.remove();
      dropoffMarkerRef.current?.remove();
      orderMarkersRef.current.forEach((m) => m.remove());
      orderMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
      userMarkerRef.current = null;
      dropoffMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme: keep bright streets + flatter camera (less game-like)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = getMapboxStyle(isDark);
    if (styleRef.current !== next) {
      styleRef.current = next;
      routeKeyRef.current = '';
      map.setStyle(next);
    }
    map.easeTo({
      pitch: getMapPitch(isDark),
      bearing: getMapBearing(isDark),
      duration: 450,
    });
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      ensureRouteLayers(map, isDark);

      if (courierPos) {
        if (!driverMarkerRef.current) {
          driverMarkerRef.current = new mapboxgl.Marker({
            element: createDriverMarkerEl('A'),
            anchor: 'center',
          })
            .setLngLat([courierPos.lng, courierPos.lat])
            .addTo(map);
        } else {
          driverMarkerRef.current.setLngLat([courierPos.lng, courierPos.lat]);
        }
      } else if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }

      if (customerPos) {
        if (!userMarkerRef.current) {
          userMarkerRef.current = new mapboxgl.Marker({
            element: createUserMarkerEl('B'),
            anchor: 'center',
          })
            .setLngLat([customerPos.lng, customerPos.lat])
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat([customerPos.lng, customerPos.lat]);
        }
      } else if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      if (dropoffPos && !customerPos) {
        if (!dropoffMarkerRef.current) {
          dropoffMarkerRef.current = new mapboxgl.Marker({
            element: createUserMarkerEl('B'),
            anchor: 'center',
          })
            .setLngLat([dropoffPos.lng, dropoffPos.lat])
            .addTo(map);
        } else {
          dropoffMarkerRef.current.setLngLat([dropoffPos.lng, dropoffPos.lat]);
        }
      } else if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.remove();
        dropoffMarkerRef.current = null;
      }

      const pinKey = orderPins
        .map(
          (p) =>
            `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${p.selected ? 1 : 0}:${p.payLabel || ''}`
        )
        .join('|');
      const prevKey = (map as mapboxgl.Map & { __orderPinKey?: string }).__orderPinKey;
      if (pinKey !== prevKey) {
        (map as mapboxgl.Map & { __orderPinKey?: string }).__orderPinKey = pinKey;
        orderMarkersRef.current.forEach((m) => m.remove());
        orderMarkersRef.current.clear();
        const selected = orderPins.find((p) => p.selected) || orderPins[0];
        for (const pin of orderPins) {
          const isSelected = pin.id === selected?.id;
          const el = createOrderMarkerEl({
            selected: isSelected,
            label: isSelected ? pin.payLabel || pin.label : undefined,
            onClick: () => onPinClickRef.current?.(pin.id),
          });
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([pin.lng, pin.lat])
            .addTo(map);
          orderMarkersRef.current.set(pin.id, marker);
        }
      }

      const selected = orderPins.find((p) => p.selected) || orderPins[0];
      const routeTarget =
        customerPos ||
        (selected ? { lat: selected.lat, lng: selected.lng } : null) ||
        dropoffPos;

      // Clear air-line; only draw real road geometry from Directions
      if (!courierPos || !routeTarget) {
        setRouteCoords(map, null);
        routeKeyRef.current = '';
      } else {
        const rKey = `${courierPos.lat.toFixed(4)},${courierPos.lng.toFixed(4)}>${routeTarget.lat.toFixed(4)},${routeTarget.lng.toFixed(4)}`;
        if (rKey !== routeKeyRef.current) {
          routeKeyRef.current = rKey;
          routeAbortRef.current?.abort();
          const ac = new AbortController();
          routeAbortRef.current = ac;
          // Soft dashed placeholder while road loads (not a solid air line)
          setRouteCoords(map, straightLine(courierPos, routeTarget));
          if (map.getLayer('route-line')) {
            map.setPaintProperty('route-line', 'line-opacity', 0.25);
            map.setPaintProperty('route-line', 'line-dasharray', [1.2, 1.6]);
          }
          fetchDrivingRoute(courierPos, routeTarget, ac.signal).then((road) => {
            if (ac.signal.aborted || !mapRef.current) return;
            const m = mapRef.current;
            if (road) {
              setRouteCoords(m, road);
              if (m.getLayer('route-line')) {
                m.setPaintProperty('route-line', 'line-opacity', 1);
                m.setPaintProperty('route-line', 'line-dasharray', [1, 0]);
              }
            }
          });
        }
      }

      if (map.getLayer('route-line')) {
        map.setPaintProperty(
          'route-line',
          'line-color',
          proximity ? ROUTE_NEAR : ROUTE_BLUE
        );
      }

      const fitKey = [
        customerPos ? `${customerPos.lat.toFixed(4)},${customerPos.lng.toFixed(4)}` : '',
        dropoffPos ? `${dropoffPos.lat.toFixed(4)},${dropoffPos.lng.toFixed(4)}` : '',
        orderPins.map((p) => `${p.id}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(','),
        courierPos ? `${courierPos.lat.toFixed(3)},${courierPos.lng.toFixed(3)}` : '',
      ].join('|');
      const prevFit = (map as mapboxgl.Map & { __fitKey?: string }).__fitKey;
      const shouldFit =
        fitKey !== prevFit &&
        (orderPins.length > 0 || customerPos || dropoffPos || courierPos);

      if (shouldFit) {
        (map as mapboxgl.Map & { __fitKey?: string }).__fitKey = fitKey;
        const bounds = new mapboxgl.LngLatBounds();
        let has = false;
        const extend = (p?: MapLatLng | null) => {
          if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
          bounds.extend([p.lng, p.lat]);
          has = true;
        };
        extend(courierPos);
        extend(customerPos);
        extend(dropoffPos);
        for (const p of orderPins) extend(p);

        if (has) {
          if (
            orderPins.length === 0 &&
            !customerPos &&
            !dropoffPos &&
            courierPos
          ) {
            map.easeTo({
              center: [courierPos.lng, courierPos.lat],
              zoom: 14.5,
              pitch: getMapPitch(isDark),
              bearing: getMapBearing(isDark),
              duration: 550,
            });
          } else {
            map.fitBounds(bounds, {
              padding: FIT_PADDING,
              maxZoom: 15.5,
              duration: 750,
              pitch: getMapPitch(isDark),
              bearing: getMapBearing(isDark),
            });
          }
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [courierPos, customerPos, dropoffPos, orderPins, proximity, styleEpoch, isDark]);
  // isDark used for camera pitch/bearing when fitting bounds

  if (!TOKEN) {
    return (
      <div className={`delivery-map-card soyol-mbx-missing ${className}`}>
        <p className="text-[13px] font-semibold text-[var(--ios-label,#111827)]">Mapbox token хэрэгтэй</p>
        <p className="mt-1 max-w-[260px] text-center text-[12px] leading-relaxed text-[var(--ios-secondary,#6b7280)]">
          `.env.local` дээр `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` нэмээд серверээ дахин асаана уу.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`delivery-map-card ${isDark ? 'delivery-map-card--dark' : ''} ${className}`}
    >
      <div ref={mapContainerRef} className="delivery-map-canvas" />
      <div className="delivery-map-vignette" aria-hidden />
      <div className="delivery-map-shine" aria-hidden />

      {distLabel && courierPos && customerPos && (
        <div
          className={`delivery-map-chip delivery-map-chip--center ${
            proximity ? 'is-near' : ''
          }`}
        >
          {proximity ? `Ойрхон · ${distLabel}` : `${distLabel} хол`}
        </div>
      )}

      {orderPins.length > 0 && (
        <div className="delivery-map-chip delivery-map-chip--tr">
          <span className="delivery-map-chip-dot" />
          {orderPins.length} захиалга
        </div>
      )}

      {!hideOverlay && !light && (
        <div className="delivery-map-chip delivery-map-chip--bl">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">{overlayTitle}</p>
          <p className="text-[14px] font-bold text-white">{overlaySubtitle}</p>
        </div>
      )}

      <span className="sr-only">{viewerRole}</span>
    </div>
  );
}
