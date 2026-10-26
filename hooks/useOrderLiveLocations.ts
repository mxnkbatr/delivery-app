'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/clientAuth';
import { hapticSuccess, triggerHaptic } from '@/lib/haptics';
import { ImpactStyle } from '@capacitor/haptics';

export type LivePoint = { lat: number; lng: number; updatedAt?: string | null };

export type OrderLiveLocations = {
  courier: LivePoint | null;
  customer: LivePoint | null;
  dropoff: LivePoint | null;
  distanceM: number | null;
  courierToDropoffM: number | null;
  customerToDropoffM: number | null;
  proximity: boolean;
  proximityM: number;
  courierAssigned: boolean;
};

type Role = 'customer' | 'courier';

function playProximitySound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* ignore */
  }
}

async function browserNotify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body, silent: false });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Share + poll mutual GPS for an active delivery order.
 * Triggers vibrate / sound / toast when parties get within proximity.
 */
export function useOrderLiveLocations(
  orderId: string | null | undefined,
  role: Role,
  enabled: boolean
) {
  const [data, setData] = useState<OrderLiveLocations | null>(null);
  const [sharing, setSharing] = useState(role === 'courier');
  const [myCoords, setMyCoords] = useState<LivePoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSent = useRef(0);
  const alerted = useRef(false);

  const postLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!orderId) return;
      const now = Date.now();
      if (now - lastSent.current < 8000) return;
      lastSent.current = now;
      try {
        await authFetch(`/api/delivery/orders/${orderId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, sharing: true }),
        });
      } catch {
        /* ignore */
      }
    },
    [orderId]
  );

  const stopSharing = useCallback(async () => {
    if (!orderId || role !== 'customer') return;
    setSharing(false);
    try {
      await authFetch(`/api/delivery/orders/${orderId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharing: false }),
      });
    } catch {
      /* ignore */
    }
  }, [orderId, role]);

  const startSharing = useCallback(() => {
    setSharing(true);
    triggerHaptic();
  }, []);

  const fetchLive = useCallback(async () => {
    if (!orderId || !enabled) return;
    try {
      const res = await authFetch(`/api/delivery/orders/${orderId}/location`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'fail');
      setData({
        courier: json.courier,
        customer: json.customer,
        dropoff: json.dropoff,
        distanceM: json.distanceM ?? null,
        courierToDropoffM: json.courierToDropoffM ?? null,
        customerToDropoffM: json.customerToDropoffM ?? null,
        proximity: !!json.proximity,
        proximityM: json.proximityM || 200,
        courierAssigned: !!json.courierAssigned,
      });
      setError(null);

      if (json.proximity && !alerted.current) {
        alerted.current = true;
        const key = `soyol_prox_${orderId}`;
        try {
          if (sessionStorage.getItem(key) === '1') return;
          sessionStorage.setItem(key, '1');
        } catch {
          /* ignore */
        }
        hapticSuccess();
        triggerHaptic(ImpactStyle.Heavy);
        playProximitySound();
        const msg =
          role === 'customer'
            ? `Хүргэгч ойрхон! ~${json.distanceM}м`
            : `Захиалагч ойрхон! ~${json.distanceM}м`;
        toast.success(msg, {
          duration: 6000,
          icon: '📍',
          style: {
            borderRadius: '14px',
            background: '#111827',
            color: '#fff',
            fontWeight: 700,
          },
        });
        browserNotify('Soyol Delivery', msg);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
      }
      if (!json.proximity) {
        alerted.current = false;
        try {
          sessionStorage.removeItem(`soyol_prox_${orderId}`);
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Байршил уншигдсангүй');
    }
  }, [orderId, enabled, role]);

  // Watch device GPS when sharing
  useEffect(() => {
    if (!enabled || !orderId || !sharing) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('GPS дэмжигдэхгүй');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyCoords(next);
        postLocation(next.lat, next.lng);
      },
      () => setError('Байршлын зөвшөөрөл хэрэгтэй'),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, orderId, sharing, postLocation]);

  // Poll peer locations
  useEffect(() => {
    if (!enabled || !orderId) return;
    fetchLive();
    const t = setInterval(fetchLive, 5000);
    return () => clearInterval(t);
  }, [enabled, orderId, fetchLive]);

  return {
    data,
    myCoords,
    sharing,
    startSharing,
    stopSharing,
    error,
    refresh: fetchLive,
  };
}
