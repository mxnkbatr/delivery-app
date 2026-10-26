'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Phone, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/clientAuth';
import { triggerHaptic } from '@/lib/haptics';

type ChatMsg = {
  id: string;
  text: string;
  senderName: string;
  createdAt: string;
  mine: boolean;
};

export const OPEN_DELIVERY_CHAT_EVENT = 'open-delivery-chat';

export function openDeliveryChat(orderId?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OPEN_DELIVERY_CHAT_EVENT, { detail: { orderId: orderId || null } })
  );
}

export function DeliveryContactBar({
  orderId,
  peerName,
  peerPhone,
  peerRoleLabel = 'Хүргэгч',
  avatarLetter,
  autoOpen = false,
}: {
  orderId: string;
  peerName: string;
  peerPhone?: string | null;
  peerRoleLabel?: string;
  avatarLetter?: string;
  /** Open chat sheet immediately (e.g. from notification ?chat=1) */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const phone = (peerPhone || '').replace(/[^\d+]/g, '');

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/delivery/orders/${orderId}/chat`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen, orderId]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ orderId?: string | null }>).detail;
      if (!detail?.orderId || detail.orderId === orderId) {
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_DELIVERY_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DELIVERY_CHAT_EVENT, onOpen);
  }, [orderId]);

  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/delivery/orders/${orderId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Илгээж чадсангүй');
      setText('');
      triggerHaptic();
      setMessages((prev) => [...prev, data.message]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-[999px] bg-[#1c1c1e] px-2 py-2 pr-2 shadow-lg">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7A45] to-[#FF4500] text-[15px] font-bold text-white">
          {(avatarLetter || peerName?.[0] || 'S').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-[15px] font-semibold text-white">{peerName}</p>
          <p className="text-[12px] text-white/50">{peerRoleLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setOpen(true);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Мессеж"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={() => triggerHaptic()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2BBBAD] text-white"
            aria-label="Залгах"
          >
            <Phone className="h-5 w-5" />
          </a>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/30">
            <Phone className="h-5 w-5" />
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/40">
          <button type="button" className="flex-1" aria-label="Хаах" onClick={() => setOpen(false)} />
          <div
            className="mx-auto flex h-[70vh] w-full max-w-lg flex-col rounded-t-[28px] bg-white"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <div>
                <p className="text-[16px] font-bold">{peerName}</p>
                <p className="text-[12px] text-[var(--ios-secondary)]">{peerRoleLabel} · чат</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {loading && messages.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="ios-spinner" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-[14px] text-[var(--ios-secondary)]">
                  Мессеж байхгүй. Эхлээд бичнэ үү.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-[18px] px-3.5 py-2.5 text-[14px] leading-snug ${
                        m.mine
                          ? 'rounded-br-md bg-[var(--ios-brand)] text-white'
                          : 'rounded-bl-md bg-[#f2f2f7] text-black'
                      }`}
                    >
                      {!m.mine && (
                        <p className="mb-0.5 text-[11px] font-semibold opacity-60">{m.senderName}</p>
                      )}
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-black/[0.06] px-3 py-2.5">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                placeholder="Мессеж бичих…"
                className="h-11 flex-1 rounded-[14px] bg-[#f5f5f7] px-3.5 text-[15px] outline-none"
              />
              <button
                type="button"
                disabled={sending || !text.trim()}
                onClick={send}
                className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--ios-brand)] text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
