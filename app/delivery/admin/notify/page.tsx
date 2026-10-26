'use client';

import { useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { authFetch } from '@/lib/clientAuth';

export default function AdminNotifyPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('/customer');
  const [audience, setAudience] = useState<'all' | 'customers'>('customers');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult('');
    setSending(true);
    try {
      const res = await authFetch('/api/delivery/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, link, audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Илгээж чадсангүй');
        return;
      }
      setResult(
        audience === 'customers'
          ? `Илгээгдлээ · ${data.sent ?? 0}/${data.targeted ?? 0} хэрэглэгч`
          : 'Бүх хэрэглэгч рүү илгээлээ'
      );
      setTitle('');
      setMessage('');
    } catch {
      setError('Сүлжээний алдаа');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 py-5 lg:px-8 lg:py-8">
      <p className="text-[12px] font-semibold text-[var(--ios-brand)]">Communications</p>
      <h1 className="mt-1 text-[32px] font-bold tracking-tight">Мэдэгдэл</h1>
      <p className="mt-1 max-w-xl text-[14px] text-[var(--ios-secondary)]">
        Хэрэглэгчдийн апп руу push + in-app мэдэгдэл илгээнэ
      </p>

      <form
        onSubmit={onSend}
        className="mt-6 max-w-xl rounded-[20px] border border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)] p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#5BC4EF] to-[#007AFF] text-white">
            <Bell className="h-4 w-4" />
          </div>
          <p className="text-[16px] font-bold">Шинэ мэдэгдэл</p>
        </div>

        <div className="mt-5 flex gap-2">
          {(
            [
              { id: 'customers', label: 'Зөвхөн хэрэглэгчид' },
              { id: 'all', label: 'Бүх хэрэглэгч' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAudience(opt.id)}
              className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
                audience === opt.id
                  ? 'bg-[var(--ios-brand)] text-white'
                  : 'bg-[var(--ios-fill)] text-[var(--ios-secondary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Гарчиг</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] text-[var(--ios-label)] outline-none placeholder:text-[var(--ios-tertiary)] focus:border-[var(--ios-brand)]"
            placeholder="Жишээ: Хүргэлт удааширч байна"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Мессеж</span>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1.5 w-full resize-none rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 py-3 text-[15px] text-[var(--ios-label)] outline-none placeholder:text-[var(--ios-tertiary)] focus:border-[var(--ios-brand)]"
            placeholder="Дэлгэрэнгүй мэдээлэл…"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-[var(--ios-secondary)]">Линк (апп дотор)</span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] text-[var(--ios-label)] px-3 text-[15px] outline-none focus:border-[var(--ios-brand)]"
          />
        </label>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--ios-red)]">{error}</p>}
        {result && <p className="mt-3 text-[13px] font-medium text-[var(--ios-green)]">{result}</p>}

        <button type="submit" disabled={sending} className="ios-btn-primary mt-5 !h-12 gap-2">
          <Send className="h-4 w-4" />
          {sending ? 'Илгээж байна…' : 'Мэдэгдэл илгээх'}
        </button>
      </form>
    </div>
  );
}
