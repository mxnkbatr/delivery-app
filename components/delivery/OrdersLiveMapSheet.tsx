'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ChevronLeft, ChevronRight, List, Navigation, X } from 'lucide-react';
import { DEFAULT_UB } from '@/lib/delivery/geo';
import { getMapBearing, getMapPitch, getMapboxStyle } from '@/lib/delivery/mapStyle';
import { triggerHaptic } from '@/lib/haptics';
import { useTheme } from '@/context/ThemeContext';

export type LiveMapOrder = {
  id: string;
  index: number;
  lat: number;
  lng: number;
  code: string;
  payLabel?: string;
  dropoffText?: string;
  district?: string | null;
  distanceM?: number | null;
  etaMin?: number | null;
  googleMapsUrl?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  orders: LiveMapOrder[];
  courierPos?: { lat: number; lng: number } | null;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onOpenList?: () => void;
  onContinue?: (id: string) => void;
  continueLabel?: string;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

function formatRouteKm(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} км`;
}

function formatRouteEta(sec: number | null | undefined, fallbackMin?: number | null) {
  if (sec != null && Number.isFinite(sec) && sec > 0) {
    const min = Math.max(1, Math.round(sec / 60));
    return `~${min} мин`;
  }
  if (fallbackMin != null) return `~${fallbackMin} мин`;
  return '—';
}

function createNumberedPin(n: number, selected: boolean) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `live-num-pin${selected ? ' is-selected' : ''}`;
  el.setAttribute('aria-label', `Захиалга ${n}`);
  el.innerHTML = `<span class="live-num-pin-head">${n}</span><span class="live-num-pin-point"></span>`;
  return el;
}

function createCourierDot() {
  const wrap = document.createElement('div');
  wrap.className = 'live-courier-pin';
  wrap.innerHTML = `
    <span class="live-courier-pulse"></span>
    <span class="live-courier-core">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6.5" cy="16.5" r="2.4" stroke="white" stroke-width="2"/>
        <circle cx="17.5" cy="16.5" r="2.4" stroke="white" stroke-width="2"/>
        <path d="M6.5 16.5h4l2-5h3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12.5 11.5V8.5h3" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </span>
  `;
  return wrap;
}

function hideClutterLabels(map: mapboxgl.Map) {
  for (const layer of map.getStyle()?.layers || []) {
    if (layer.type !== 'symbol') continue;
    const id = layer.id.toLowerCase();
    if (
      id.includes('settlement') ||
      id.includes('place') ||
      id.includes('poi') ||
      id.includes('airport') ||
      id.includes('transit') ||
      id.includes('country') ||
      id.includes('state')
    ) {
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      } catch {
        /* ignore */
      }
    }
  }
}

function add3dBuildings(map: mapboxgl.Map) {
  if (map.getLayer('add-3d-buildings')) return;
  const layers = map.getStyle()?.layers || [];
  if (layers.some((l) => l.type === 'fill-extrusion' && /building/i.test(l.id))) return;
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
      'fill-extrusion-color': '#d4dae3',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.7,
    },
  };
  try {
    if (labelLayer?.id) map.addLayer(layer, labelLayer.id);
    else map.addLayer(layer);
  } catch {
    /* ignore */
  }
}

export default function OrdersLiveMapSheet({
  open,
  onClose,
  orders,
  courierPos = null,
  selectedId = null,
  onSelect,
  onOpenList,
  onContinue,
  continueLabel = 'Үргэлжлүүлэх',
}: Props) {
  const { isDark } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const courierRef = useRef<mapboxgl.Marker | null>(null);
  const fitKeyRef = useRef('');
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeKeyRef = useRef('');
  const styleRef = useRef(getMapboxStyle(isDark));
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [routeDurationSec, setRouteDurationSec] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);

  const selectedIndex = useMemo(() => {
    if (!orders.length) return -1;
    const i = orders.findIndex((o) => o.id === selectedId);
    return i >= 0 ? i : 0;
  }, [orders, selectedId]);

  const selected = selectedIndex >= 0 ? orders[selectedIndex] : null;

  const goPrev = () => {
    if (!orders.length) return;
    const next = (selectedIndex - 1 + orders.length) % orders.length;
    onSelect(orders[next].id);
  };

  const goNext = () => {
    if (!orders.length) return;
    const next = (selectedIndex + 1) % orders.length;
    onSelect(orders[next].id);
  };

  // Lock scroll + hide tab bar while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('live-map-open');
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove('live-map-open');
    };
  }, [open]);

  useEffect(() => {
    if (!open || !TOKEN || !mapContainerRef.current) return;

    mapboxgl.accessToken = TOKEN;
    const center = selected || courierPos || orders[0] || DEFAULT_UB;
    const style = getMapboxStyle(isDark);
    styleRef.current = style;

    const ensureLayers = (map: mapboxgl.Map) => {
      const dark = document.documentElement.classList.contains('dark');
      hideClutterLabels(map);
      if (!dark) add3dBuildings(map);
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
      if (!map.getLayer('route-casing')) {
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': dark ? '#0f172a' : '#fff',
            'line-width': 11,
            'line-opacity': 0.95,
          },
        });
      } else {
        try {
          map.setPaintProperty('route-casing', 'line-color', dark ? '#0f172a' : '#fff');
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
          paint: { 'line-color': '#2563eb', 'line-width': 5.5, 'line-opacity': 1 },
        });
      }
    };

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style,
      center: [center.lng, center.lat],
      zoom: 13,
      pitch: getMapPitch(isDark),
      bearing: getMapBearing(isDark),
      attributionControl: false,
      antialias: true,
      fadeDuration: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    map.on('load', () => {
      map.resize();
      ensureLayers(map);
    });

    map.on('style.load', () => {
      ensureLayers(map);
      routeKeyRef.current = '';
      fitKeyRef.current = '';
      setStyleEpoch((n) => n + 1);
    });

    mapRef.current = map;
    fitKeyRef.current = '';
    routeKeyRef.current = '';
    const t = window.setTimeout(() => map.resize(), 120);

    return () => {
      window.clearTimeout(t);
      routeAbortRef.current?.abort();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      courierRef.current?.remove();
      courierRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Theme → flatter camera + bright streets (readable, not “game dark”)
  useEffect(() => {
    if (!open) return;
    const map = mapRef.current;
    if (!map) return;
    const next = getMapboxStyle(isDark);
    if (styleRef.current !== next) {
      styleRef.current = next;
      routeKeyRef.current = '';
      fitKeyRef.current = '';
      map.setStyle(next);
    }
    map.easeTo({
      pitch: getMapPitch(isDark),
      bearing: getMapBearing(isDark),
      duration: 450,
    });
  }, [isDark, open]);

  // Markers
  useEffect(() => {
    if (!open) return;
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      const activeId = selected?.id;
      const seen = new Set<string>();

      for (const order of orders) {
        seen.add(order.id);
        const isSelected = order.id === activeId;
        markersRef.current.get(order.id)?.remove();
        const el = createNumberedPin(order.index, isSelected);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(order.id);
        });
        markersRef.current.set(
          order.id,
          new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([order.lng, order.lat])
            .addTo(map)
        );
      }

      for (const [id, m] of markersRef.current) {
        if (!seen.has(id)) {
          m.remove();
          markersRef.current.delete(id);
        }
      }

      if (courierPos) {
        if (!courierRef.current) {
          courierRef.current = new mapboxgl.Marker({
            element: createCourierDot(),
            anchor: 'center',
          })
            .setLngLat([courierPos.lng, courierPos.lat])
            .addTo(map);
        } else {
          courierRef.current.setLngLat([courierPos.lng, courierPos.lat]);
        }
      }

      // Road route: courier → selected order + distance/ETA
      const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
      if (courierPos && selected && source) {
        const rKey = `${courierPos.lat.toFixed(4)},${courierPos.lng.toFixed(4)}>${selected.lat.toFixed(4)},${selected.lng.toFixed(4)}`;
        if (rKey !== routeKeyRef.current) {
          routeKeyRef.current = rKey;
          routeAbortRef.current?.abort();
          const ac = new AbortController();
          routeAbortRef.current = ac;
          setRouteLoading(true);
          setRouteDistanceM(selected.distanceM ?? null);
          setRouteDurationSec(
            selected.etaMin != null ? selected.etaMin * 60 : null
          );
          const qs = new URLSearchParams({
            fromLng: String(courierPos.lng),
            fromLat: String(courierPos.lat),
            toLng: String(selected.lng),
            toLat: String(selected.lat),
          });
          fetch(`/api/delivery/directions?${qs}`, { signal: ac.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (ac.signal.aborted) return;
              if (data?.coordinates) {
                source.setData({
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates: data.coordinates },
                });
              }
              if (typeof data?.distanceM === 'number') setRouteDistanceM(data.distanceM);
              if (typeof data?.durationSec === 'number') setRouteDurationSec(data.durationSec);
            })
            .catch(() => {})
            .finally(() => {
              if (!ac.signal.aborted) setRouteLoading(false);
            });
        }
      } else if (source) {
        routeKeyRef.current = '';
        setRouteDistanceM(null);
        setRouteDurationSec(null);
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        });
      }

      const setKey = orders.map((o) => o.id).join(',') + (courierPos ? ':c' : '');
      if (setKey !== fitKeyRef.current) {
        fitKeyRef.current = setKey;
        const bounds = new mapboxgl.LngLatBounds();
        let has = false;
        for (const o of orders) {
          bounds.extend([o.lng, o.lat]);
          has = true;
        }
        if (courierPos) {
          bounds.extend([courierPos.lng, courierPos.lat]);
          has = true;
        }
        if (has) {
          map.fitBounds(bounds, {
            padding: { top: 88, bottom: 220, left: 44, right: 44 },
            maxZoom: 14.2,
            duration: 700,
            pitch: getMapPitch(document.documentElement.classList.contains('dark')),
            bearing: getMapBearing(document.documentElement.classList.contains('dark')),
          });
        }
      } else if (selected) {
        map.easeTo({
          center: [selected.lng, selected.lat],
          zoom: Math.max(map.getZoom(), 13.5),
          duration: 450,
          pitch: getMapPitch(document.documentElement.classList.contains('dark')),
        });
      }
    };

    if (map.isStyleLoaded()) sync();
    else map.once('load', sync);
  }, [open, orders, selected, courierPos, styleEpoch]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="live-map-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="live-map-sheet-map">
            {!TOKEN ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-[13px] font-semibold text-[#6b7280]">
                Mapbox token хэрэгтэй
              </div>
            ) : (
              <div ref={mapContainerRef} className="h-full w-full" />
            )}

            {/* Top chrome — clear exit */}
            <div className="live-map-top">
              <button
                type="button"
                className="live-map-exit-btn"
                onClick={onClose}
                aria-label="Гарах"
              >
                <X className="h-5 w-5" strokeWidth={2.6} />
                <span>Гарах</span>
              </button>
              <div className="live-map-title-pill">
                <span className="live-map-live-dot" />
                {orders.length} захиалга
              </div>
              <button
                type="button"
                className="live-map-icon-btn"
                onClick={() => {
                  onOpenList?.();
                  onClose();
                }}
                aria-label="Жагсаалт"
              >
                <List className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Floating order card */}
            {selected && (
              <motion.div
                key={selected.id}
                className="live-map-float-card"
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="live-map-float-head">
                  <button
                    type="button"
                    className="live-map-nav-btn"
                    onClick={goPrev}
                    aria-label="Өмнөх"
                    disabled={orders.length < 2}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[11px] font-bold text-[#ff4500]">
                      {selected.index}/{orders.length} · {selected.code}
                    </p>
                    <p className="mt-0.5 truncate text-[17px] font-extrabold tracking-tight text-[#111827]">
                      {selected.district ||
                        selected.dropoffText?.split(',')[0] ||
                        'Хүргэх хаяг'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="live-map-nav-btn"
                    onClick={goNext}
                    aria-label="Дараах"
                    disabled={orders.length < 2}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <p className="mt-2 line-clamp-2 text-center text-[12px] leading-snug text-[#6b7280]">
                  {selected.dropoffText || '—'}
                </p>

                <div className="live-map-route-stats">
                  <div className="live-map-route-stat">
                    <p className="live-map-route-stat-value">
                      {routeLoading && routeDistanceM == null
                        ? '…'
                        : formatRouteKm(routeDistanceM ?? selected.distanceM)}
                    </p>
                    <p className="live-map-route-stat-label">ЗАЙ</p>
                  </div>
                  <div className="live-map-route-stat">
                    <p className="live-map-route-stat-value">
                      {routeLoading && routeDurationSec == null
                        ? '…'
                        : formatRouteEta(routeDurationSec, selected.etaMin)}
                    </p>
                    <p className="live-map-route-stat-label">ETA</p>
                  </div>
                  {selected.payLabel && (
                    <div className="live-map-route-stat">
                      <p className="live-map-route-stat-value text-[#ff4500]">
                        {selected.payLabel}
                      </p>
                      <p className="live-map-route-stat-label">ОРЛОГО</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {selected.googleMapsUrl && (
                    <a
                      href={selected.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="live-map-ext-nav"
                      onClick={() => triggerHaptic()}
                    >
                      <Navigation className="h-4 w-4" />
                      Google
                    </a>
                  )}
                  {onContinue && (
                    <button
                      type="button"
                      className="live-map-cta"
                      onClick={() => onContinue(selected.id)}
                    >
                      {continueLabel}
                    </button>
                  )}
                </div>
                <button type="button" className="live-map-card-close" onClick={onClose}>
                  Хаах
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
