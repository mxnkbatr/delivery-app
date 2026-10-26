'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { IOSScreen } from '@/components/delivery/ios/primitives';

export default function CourierRegisterPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    vehicleType: 'motorbike',
    zone: 'Улаанбаатар',
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone || !form.password) {
      toast.error('Утас, нууц үг оруулна уу');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-courier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Бүртгэл амжилтгүй');
      login(data.user, data.token);
      toast.success(
        data.upgraded
          ? 'Soyol Shop бүртгэлээс хүргэгч эрх амжилттай авлаа'
          : 'Хүргэгчээр бүртгэгдлээ'
      );
      const { resolvePostAuthPath } = await import('@/lib/delivery/onboarding');
      router.push(await resolvePostAuthPath('courier'));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IOSScreen>
      <div
        className="px-4 pb-10"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <Link href="/welcome" className="text-[17px] text-[var(--ios-brand)] active:opacity-40">
          ← Буцах
        </Link>

        <h1 className="ios-large-title mt-4">Хүргэгч болох</h1>
        <p className="ios-subhead mt-2">
          Soyol Shop-д бүртгэлтэй бол <strong>ижил утас, нууц үг</strong>-ээр эрх авна.
          Шинэ хүргэгч бол нэрээ нэмж бөглөнө.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="ios-footnote mb-1.5 block px-1">Нэр</label>
            <input
              className="ios-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Бүтэн нэр"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="ios-footnote mb-1.5 block px-1">Утас (Shop бүртгэл)</label>
            <input
              className="ios-field"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="99112233"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="ios-footnote mb-1.5 block px-1">Нууц үг</label>
            <input
              className="ios-field"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="ios-footnote mb-1.5 block px-1">Тээврийн хэрэгсэл</label>
            <select
              className="ios-field appearance-none"
              value={form.vehicleType}
              onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            >
              <option value="motorbike">Мотоцикл</option>
              <option value="car">Машин</option>
              <option value="foot">Явган</option>
            </select>
          </div>
          <div>
            <label className="ios-footnote mb-1.5 block px-1">Бүс</label>
            <input
              className="ios-field"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              placeholder="Хан-Уул"
            />
          </div>

          <button type="submit" disabled={loading} className="ios-btn-primary mt-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Хүргэгч эрх авах'}
          </button>
        </form>

        <p className="ios-footnote mt-6 text-center">
          Аль хэдийн хүргэгч үү?{' '}
          <Link href="/sign-in?as=courier" className="font-semibold text-[var(--ios-brand)]">
            Нэвтрэх
          </Link>
        </p>
      </div>
    </IOSScreen>
  );
}
