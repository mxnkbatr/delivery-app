'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/clientAuth';
import { flushOfflineQueue, peekOfflineQueue } from '@/lib/delivery/offlineQueue';

/** Report GPS + flush offline queue while courier is working */
export function useCourierLocation(enabled: boolean) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingOffline, setPendingOffline] = useState(0);
  const lastSent = useRef(0);

  const refreshQueueCount = useCallback(() => {
    setPendingOffline(peekOfflineQueue().length);
  }, []);

  const sendLocation = useCallback(
    async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastSent.current < 12000) return;
      lastSent.current = now;
      try {
        await authFetch('/api/delivery/courier/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });
      } catch {
        /* ignore */
      }
    },
    []
  );

  useEffect(() => {
    refreshQueueCount();
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        sendLocation(next.lat, next.lng);
      },
      () => {
        /* permission denied — keep null */
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    const onOnline = async () => {
      const r = await flushOfflineQueue(authFetch);
      refreshQueueCount();
      if (r.flushed > 0) {
        window.dispatchEvent(new Event('sync-notifications'));
      }
    };
    window.addEventListener('online', onOnline);
    // Flush if already online (cold start with queued actions)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void onOnline();
    }

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, sendLocation, refreshQueueCount]);

  return { coords, pendingOffline, refreshQueueCount };
}
