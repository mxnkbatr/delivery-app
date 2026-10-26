'use client';

import Link from 'next/link';
import { Bike, ChevronLeft } from 'lucide-react';
import '@/app/delivery/delivery.css';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backHref?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Cream auth layout — splash/login/signup/onboarding surfaces */
export default function AuthShell({
  title,
  subtitle,
  eyebrow,
  backHref = '/welcome',
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="auth-cream ios-root min-h-[100dvh]">
      <div
        className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="auth-back"
            aria-label="Буцах"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.8} />
          </Link>
          <div className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#ff4500] text-white shadow-[0_6px_16px_rgba(255,69,0,0.28)]">
              <Bike className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <span className="text-[14px] font-extrabold tracking-tight text-[var(--auth-ink)]">
              Soyol <span className="text-[#ff4500]">Delivery</span>
            </span>
          </div>
          <div className="h-10 w-10" aria-hidden />
        </div>

        <header className="mt-8">
          {eyebrow && <p className="auth-eyebrow">{eyebrow}</p>}
          <h1 className="auth-title mt-2">{title}</h1>
          {subtitle && <p className="auth-subtitle mt-2">{subtitle}</p>}
        </header>

        <div className="mt-7 flex flex-1 flex-col">{children}</div>

        {footer && <div className="mt-8 pb-2">{footer}</div>}
      </div>
    </div>
  );
}
