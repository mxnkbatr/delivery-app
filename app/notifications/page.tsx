'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronLeft } from 'lucide-react';
import { useUser } from '@/context/AuthContext';
import { IOSScreen, IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import '@/app/delivery/delivery.css';

type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  type?: string;
  orderId?: string;
};

export default function NotificationsPage() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    fetchAll();
  }, [isSignedIn, fetchAll, router]);

  const resolveLink = (n: Notification) => {
    if (n.link && typeof n.link === 'string' && n.link.trim()) {
      if (n.type === 'delivery_chat' && !n.link.includes('chat=')) {
        return `${n.link}${n.link.includes('?') ? '&' : '?'}chat=1`;
      }
      return n.link;
    }
    if (n.type === 'delivery_chat' && n.orderId) {
      return `/active/${n.orderId}?chat=1`;
    }
    return null;
  };

  const markRead = async (n: Notification) => {
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: n.id }),
    }).catch(console.error);

    const link = resolveLink(n);
    if (!link) return;

    try {
      const target = new URL(link, window.location.origin);
      const samePage = target.pathname === window.location.pathname;
      if (samePage && (n.type === 'delivery_chat' || target.searchParams.get('chat') === '1')) {
        const { openDeliveryChat } = await import('@/components/delivery/DeliveryContactBar');
        openDeliveryChat(n.orderId || target.pathname.split('/').pop());
        router.replace(link);
        return;
      }
    } catch {
      /* fall through */
    }
    router.push(link);
  };

  if (!isSignedIn) return <IOSSpinnerScreen />;

  return (
    <IOSScreen className="pb-10">
      <div
        className="sticky top-0 z-40 flex items-center gap-2 border-b border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/95 px-3 py-2.5 backdrop-blur-sm"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ios-brand)] active:bg-black/[0.04] dark:active:bg-white/[0.08]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="flex-1 pr-10 text-center text-[17px] font-bold text-[var(--ios-label)]">
          Мэдэгдэл
        </h1>
      </div>

      <div className="mt-4 space-y-3 px-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="ios-spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="dl-card px-5 py-14 text-center">
            <Bell className="mx-auto h-10 w-10 text-[var(--ios-tertiary)]" />
            <p className="mt-3 text-[15px] font-semibold text-[var(--ios-secondary)]">
              Мэдэгдэл байхгүй байна
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markRead(n)}
              className={`dl-card w-full p-4 text-left transition-transform active:scale-[0.99] ${
                !n.isRead ? 'ring-2 ring-[rgba(255,69,0,0.18)]' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
                    !n.isRead
                      ? 'bg-[rgba(255,69,0,0.12)] text-[var(--ios-brand)]'
                      : 'bg-[var(--ios-fill)] text-[var(--ios-secondary)]'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[15px] font-bold text-[var(--ios-label)]">{n.title}</h4>
                    {!n.isRead && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--ios-brand)]" />
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-[var(--ios-secondary)]">
                    {n.message}
                  </p>
                  <span className="mt-2 block text-[11px] font-medium text-[var(--ios-tertiary)]">
                    {new Date(n.createdAt).toLocaleString('mn-MN')}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </IOSScreen>
  );
}
