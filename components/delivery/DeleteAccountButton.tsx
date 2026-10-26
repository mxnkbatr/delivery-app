'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/clientAuth';

type Props = {
  /** Where to send user after successful delete */
  redirectTo?: string;
  className?: string;
};

export default function DeleteAccountButton({
  redirectTo = '/welcome',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const close = () => {
    setOpen(false);
    setConfirmText('');
  };

  const onDelete = async () => {
    if (confirmText !== 'УСТГА') {
      toast.error('Баталгаажуулах үг буруу байна');
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/api/user/delete', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Алдаа гарлаа');
        return;
      }
      toast.success('Бүртгэл амжилттай устгагдлаа');
      close();
      await logout();
      router.replace(redirectTo);
    } catch {
      toast.error('Сервертэй холбогдож чадсангүй');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'ios-btn-secondary mt-3 !border-[var(--ios-red)]/25 !text-[var(--ios-red)]'
        }
      >
        <span className="inline-flex items-center justify-center gap-2">
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          Бүртгэл устгах
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm space-y-5 rounded-[24px] bg-[var(--ios-bg-elevated)] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ios-red)]/12">
                  <AlertTriangle className="h-5 w-5 text-[var(--ios-red)]" strokeWidth={2} />
                </div>
                <h3 className="text-[17px] font-bold text-[var(--ios-label)]">Бүртгэл устгах</h3>
              </div>
              <button type="button" onClick={close} className="p-1 text-[var(--ios-tertiary)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 rounded-[16px] bg-[var(--ios-red)]/8 p-4">
              <p className="text-[13px] font-bold text-[var(--ios-red)]">Анхааруулга</p>
              <p className="text-[13px] leading-relaxed text-[var(--ios-secondary)]">
                Бүртгэл устгавал таны профайл, захиалгын холбоос, мэдэгдэл устана. Энэ үйлдлийг
                буцаах боломжгүй.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-bold text-[var(--ios-label)]">
                Баталгаажуулахын тулд{' '}
                <span className="text-[var(--ios-red)]">УСТГА</span> гэж бичнэ үү:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="УСТГА"
                autoCapitalize="characters"
                className="h-12 w-full rounded-[14px] border border-[var(--ios-separator)] bg-[var(--ios-fill)] px-3 text-[15px] font-bold text-[var(--ios-label)] outline-none focus:border-[var(--ios-red)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={close}
                className="flex h-12 flex-1 items-center justify-center rounded-[14px] bg-[var(--ios-fill)] text-[15px] font-bold text-[var(--ios-label)]"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={confirmText !== 'УСТГА' || loading}
                className="flex h-12 flex-1 items-center justify-center rounded-[14px] bg-[var(--ios-red)] text-[15px] font-bold text-white disabled:opacity-40"
              >
                {loading ? 'Устгаж байна…' : 'Устгах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
