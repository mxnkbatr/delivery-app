'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import AuthShell from '@/components/delivery/auth/AuthShell';
import { IOSSpinnerScreen } from '@/components/delivery/ios/primitives';
import { resolvePostAuthPath } from '@/lib/delivery/onboarding';

function SignInContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams.get('as');
  const portal: 'customer' | 'courier' | 'admin' =
    asParam === 'courier' ? 'courier' : asParam === 'admin' ? 'admin' : 'customer';

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const portalMeta = {
    customer: {
      eyebrow: 'Хэрэглэгч',
      title: 'Тавтай морил',
      subtitle: 'Утас эсвэл OTP-оор нэвтэрч захиалгаа удирдана.',
    },
    courier: {
      eyebrow: 'Хүргэгч',
      title: 'Ажилдаа оръё',
      subtitle: 'Хүргэгчийн эрхээр нэвтэрч бэлэн бараагаа авна.',
    },
    admin: {
      eyebrow: 'Админ',
      title: 'Удирдлага',
      subtitle: 'Админ эрхээр нэвтэрч хуваарилалт хийнэ.',
    },
  }[portal];

  const goAfterLogin = async (role?: string) => {
    const path = await resolvePostAuthPath(role || (portal === 'admin' ? 'admin' : portal));
    router.push(path);
    router.refresh();
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 8 || !password) {
      toast.error('Бүх талбарыг бөглөнө үү');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone,
          password,
          expectedRole:
            portal === 'courier' ? 'courier' : portal === 'admin' ? 'admin' : 'customer',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Нэвтрэх мэдээлэл буруу байна');

      toast.success('Амжилттай нэвтэрлээ');
      if (data.user) login(data.user, data.token);
      await goAfterLogin(data.user?.role);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow={portalMeta.eyebrow}
      title={portalMeta.title}
      subtitle={portalMeta.subtitle}
      footer={
        <p className="auth-footnote">
          {portal === 'courier' ? (
            <>
              Shop бүртгэлтэй → хүргэгч эрх авах?{' '}
              <Link href="/courier/register">Эрх авах</Link>
            </>
          ) : portal === 'admin' ? (
            <Link href="/welcome">Бусад үүрэг</Link>
          ) : (
            <>
              Шинэ хэрэглэгч? <Link href="/sign-up?as=customer">Бүртгүүлэх</Link>
            </>
          )}
        </p>
      }
    >
      <div className="auth-segment">
        <button
          type="button"
          data-active={mode === 'password'}
          onClick={() => setMode('password')}
        >
          Нууц үг
        </button>
        <button type="button" data-active={mode === 'otp'} onClick={() => setMode('otp')}>
          OTP код
        </button>
      </div>

      {mode === 'password' && (
        <form onSubmit={handlePasswordLogin} className="auth-panel mt-5 space-y-4">
          <div>
            <label className="auth-label">Утасны дугаар</label>
            <input
              className="auth-field"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="85552229"
              autoFocus
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="auth-label">Нууц үг</label>
            <input
              className="auth-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={isLoading} className="auth-btn-primary mt-1">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Нэвтрэх'}
          </button>
        </form>
      )}

      {mode === 'otp' && (
        <div className="auth-panel mt-5 space-y-4">
          {otpStep === 'phone' && (
            <>
              <div>
                <label className="auth-label">Утасны дугаар</label>
                <input
                  className="auth-field"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="85552229"
                />
              </div>
              <button
                type="button"
                disabled={otpLoading}
                onClick={async () => {
                  setOtpLoading(true);
                  try {
                    const res = await fetch('/api/auth/send-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone }),
                    });
                    if (res.ok) {
                      toast.success('OTP код илгээлээ');
                      setOtpStep('code');
                    } else {
                      const d = await res.json();
                      toast.error(d.error || 'Алдаа гарлаа');
                    }
                  } finally {
                    setOtpLoading(false);
                  }
                }}
                className="auth-btn-primary"
              >
                {otpLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'OTP код авах'}
              </button>
            </>
          )}

          {otpStep === 'code' && (
            <>
              <p className="text-center text-[14px] font-medium text-[var(--auth-muted)]">
                +976 {phone} руу код илгээлээ
              </p>
              <input
                className="auth-field text-center text-[22px] font-bold tracking-[0.35em]"
                type="number"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="000000"
              />
              <button
                type="button"
                disabled={otpLoading || otpCode.length !== 6}
                onClick={async () => {
                  setOtpLoading(true);
                  try {
                    const res = await fetch('/api/auth/verify-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ phone, code: otpCode }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      if (
                        portal === 'courier' &&
                        data.user?.role !== 'courier' &&
                        data.user?.role !== 'admin'
                      ) {
                        toast.error('Энэ бүртгэл хүргэгчийн эрхгүй');
                        return;
                      }
                      if (portal === 'customer' && data.user?.role === 'courier') {
                        toast.error('Хүргэгч бүртгэлээр энд нэвтрэх боломжгүй');
                        return;
                      }
                      login(data.user, data.token);
                      toast.success('Амжилттай нэвтэрлээ');
                      await goAfterLogin(data.user?.role);
                    } else {
                      toast.error(data.error || 'Код буруу байна');
                    }
                  } finally {
                    setOtpLoading(false);
                  }
                }}
                className="auth-btn-primary"
              >
                {otpLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Нэвтрэх'}
              </button>
              <button
                type="button"
                onClick={() => setOtpStep('phone')}
                className="w-full py-2 text-[15px] font-semibold text-[#ff4500]"
              >
                Дугаар өөрчлөх
              </button>
            </>
          )}
        </div>
      )}

    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<IOSSpinnerScreen />}>
      <SignInContent />
    </Suspense>
  );
}
