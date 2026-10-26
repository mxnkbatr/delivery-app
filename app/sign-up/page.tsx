'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Loader2, Lock, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/delivery/auth/AuthShell';
import { resolvePostAuthPath } from '@/lib/delivery/onboarding';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.age || !formData.password) {
      toast.error('Бүх талбарыг бөглөнө үү');
      return;
    }

    if (formData.phone.length < 8) {
      toast.error('Утасны дугаар буруу байна');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Бүртгэл үүсгэхэд алдаа гарлаа');
      }

      toast.success('Бүртгэл амжилттай үүслээ');

      if (data.user) {
        login(data.user, data.token);
        const path = await resolvePostAuthPath(data.user?.role || 'customer');
        router.push(path);
      } else {
        router.push('/sign-in?as=customer');
      }
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Шинэ бүртгэл"
      title="Эхлэхэд бэлэн үү?"
      subtitle="Хэдхэн мэдээллээр бүртгүүлээд захиалгаа эхлүүлнэ."
      footer={
        <p className="auth-footnote">
          Аль хэдийн бүртгэлтэй юу? <Link href="/sign-in?as=customer">Нэвтрэх</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="auth-panel space-y-4">
        <div>
          <label className="auth-label">Нэр</label>
          <div className="auth-field-icon">
            <User />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Таны нэр"
              className="auth-field"
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <label className="auth-label">Утас</label>
          <div className="auth-field-icon">
            <Phone />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="85552229"
              className="auth-field"
              autoComplete="tel"
            />
          </div>
        </div>

        <div>
          <label className="auth-label">Нас</label>
          <div className="auth-field-icon">
            <Calendar />
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="25"
              className="auth-field"
            />
          </div>
        </div>

        <div>
          <label className="auth-label">Нууц үг</label>
          <div className="auth-field-icon">
            <Lock />
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              className="auth-field"
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="auth-btn-primary mt-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Бүртгүүлэх'}
        </button>
      </form>
    </AuthShell>
  );
}
