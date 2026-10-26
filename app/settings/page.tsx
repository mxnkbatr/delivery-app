'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, User, Lock, Phone, Globe, Moon, Bell, CheckCircle2, Link2, Loader2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { triggerHaptic } from '@/lib/haptics';

// Google icon
function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// Facebook icon
function FacebookIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

interface LinkedAccounts {
  google: { linked: boolean; email?: string };
  facebook: { linked: boolean; email?: string };
}

function GoogleLinkButton({ 
  isLinked, 
  email, 
  isBusy, 
  onConnect 
}: { 
  isLinked: boolean; 
  email?: string; 
  isBusy: boolean; 
  onConnect: () => void;
}) {
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('/api/user/link-social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'google', access_token: tokenResponse.access_token }),
        });

        const data = await res.json();
        if (res.ok) {
          toast.success('Амжилттай холбогдлоо!');
          window.location.reload();
        } else {
          toast.error(data.error || 'Холбоход алдаа гарлаа');
        }
      } catch (error) {
        toast.error('Сервертэй холбогдож чадсангүй');
      }
    },
    onError: () => {
      toast.error('Google-ээр холбоход алдаа гарлаа');
    },
  });

  if (isBusy) return <Loader2 className="w-3.5 h-3.5 animate-spin" />;

  return (
    <button
      onClick={() => googleLogin()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[12px] font-bold text-[#1A1A1A] transition-colors disabled:opacity-60"
    >
      <Link2 className="w-3.5 h-3.5" />
      Холбох
    </button>
  );
}

function ConnectedAccountsSection() {
  const { user } = useAuth();
  const [linked, setLinked] = useState<LinkedAccounts | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<'google' | 'facebook' | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    fetch('/api/user/link-social')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setLinked(data))
      .catch(() => {});
  }, []);

  const handleLink = async (provider: 'google' | 'facebook') => {
    if (provider === 'facebook') {
      toast.error('Удахгүй нэмэгдэх болно');
    }
  };


  return (
    <div>
      <h2 className="text-[11px] font-bold text-[#999999] uppercase tracking-wider ml-4 mb-2">
        Холбогдсон данс
      </h2>
      <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* Google */}
        <div className={`flex items-center justify-between px-4 h-[64px] border-b border-[#F5F5F5] ${!googleClientId && !linked?.google.linked ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-3">
            <GoogleIcon />
            <div>
              <p className="text-[15px] font-bold text-[#1A1A1A]">Google</p>
              {linked?.google.linked ? (
                <p className="text-[11px] text-[#999] mt-0.5">{linked.google.email}</p>
              ) : !googleClientId ? (
                <p className="text-[11px] text-[#BBBBBB] mt-0.5">Тохируулаагүй байна</p>
              ) : null}
            </div>
          </div>
          {linked?.google.linked ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[12px] font-bold">Холбогдсон</span>
            </div>
          ) : googleClientId ? (
            <GoogleLinkButton 
              isLinked={false} 
              isBusy={linkingProvider === 'google'} 
              onConnect={() => {}} 
            />
          ) : null}
        </div>

        {/* Facebook */}
        <div className="flex items-center justify-between px-4 h-[64px]">
          <div className="flex items-center gap-3">
            <FacebookIcon />
            <div>
              <p className="text-[15px] font-bold text-[#1A1A1A]">Facebook</p>
              {linked?.facebook.linked && (
                <p className="text-[11px] text-[#999] mt-0.5">{linked.facebook.email}</p>
              )}
            </div>
          </div>
          {linked?.facebook.linked ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[12px] font-bold">Холбогдсон</span>
            </div>
          ) : (
            <button
              onClick={() => handleLink('facebook')}
              disabled={!!linkingProvider}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[12px] font-bold text-[#1A1A1A] transition-colors disabled:opacity-60"
            >
              {linkingProvider === 'facebook' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Холбох
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { isDark, toggle } = useTheme();
  const [pushNotif, setPushNotif] = useState(true);

  return (
    <div className="min-h-screen bg-[var(--soyol-canvas)] font-sans pb-10 text-[var(--soyol-ink)]">
      {/* Header */}
      <div className="sticky top-0 z-50 flex h-[56px] items-center border-b border-[var(--soyol-line)] bg-[var(--soyol-surface)] px-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <Link href="/profile" className="-ml-2 p-2 text-[var(--soyol-ink)]">
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 pr-8 text-center text-[16px] font-bold text-[var(--soyol-ink)]">
          Тохиргоо
        </h1>
      </div>

      <div className="mt-2 space-y-6 p-4">
        {/* Дансны тохиргоо */}
        <div>
          <h2 className="mb-2 ml-4 text-[11px] font-bold uppercase tracking-wider text-[var(--soyol-muted)]">
            Дансны тохиргоо
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-[var(--soyol-line)] bg-[var(--soyol-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <Link
              href="/profile/edit"
              className="flex h-[64px] items-center justify-between border-b border-[var(--soyol-line)] px-4 transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
            >
              <div className="flex items-center gap-4">
                <User className="h-[22px] w-[22px] text-[var(--soyol-muted)]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[var(--soyol-ink)]">Профайл засах</span>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--soyol-soft)]" strokeWidth={2} />
            </Link>

            <Link
              href="/settings/security"
              className="flex h-[64px] items-center justify-between border-b border-[var(--soyol-line)] px-4 transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
            >
              <div className="flex items-center gap-4">
                <Lock className="h-[22px] w-[22px] text-[var(--soyol-muted)]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[var(--soyol-ink)]">Нууц үг солих</span>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--soyol-soft)]" strokeWidth={2} />
            </Link>

            <Link
              href="/profile/phone"
              className="flex h-[64px] items-center justify-between px-4 transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
            >
              <div className="flex items-center gap-4">
                <Phone className="h-[22px] w-[22px] text-[var(--soyol-muted)]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[var(--soyol-ink)]">Утасны дугаар</span>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--soyol-soft)]" strokeWidth={2} />
            </Link>
          </div>
        </div>

        <ConnectedAccountsSection />

        <div>
          <h2 className="mb-2 ml-4 text-[11px] font-bold uppercase tracking-wider text-[var(--soyol-muted)]">
            Апп тохиргоо
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-[var(--soyol-line)] bg-[var(--soyol-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <button
              type="button"
              className="flex h-[64px] w-full items-center justify-between border-b border-[var(--soyol-line)] px-4 transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
            >
              <div className="flex items-center gap-4">
                <Globe className="h-[22px] w-[22px] text-[var(--soyol-muted)]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[var(--soyol-ink)]">Хэл</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--soyol-muted)]">
                <span className="text-[14px] font-medium">Монгол</span>
                <ChevronRight className="h-5 w-5" strokeWidth={2} />
              </div>
            </button>

            <div className="flex h-[64px] items-center justify-between border-b border-[var(--soyol-line)] px-4">
              <div className="flex items-center gap-4">
                <Moon className="h-[22px] w-[22px] text-[var(--soyol-muted)]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[var(--soyol-ink)]">Харанхуй горим</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  toggle();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDark ? 'bg-[#FF6B00]' : 'bg-[#E5E5E5]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    isDark ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex h-[64px] items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <Bell className="h-[22px] w-[22px] text-[var(--soyol-muted)]" strokeWidth={1.5} />
                <span className="text-[15px] font-bold text-[var(--soyol-ink)]">Push мэдэгдэл</span>
              </div>
              <button
                type="button"
                onClick={() => setPushNotif(!pushNotif)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  pushNotif ? 'bg-[#FF6B00]' : 'bg-[#E5E5E5]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    pushNotif ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
