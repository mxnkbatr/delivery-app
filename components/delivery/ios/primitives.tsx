'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import '@/app/delivery/delivery.css';

export function IOSScreen({
  children,
  className = '',
  canvas = true,
}: {
  children: ReactNode;
  className?: string;
  canvas?: boolean;
}) {
  return (
    <div className={`ios-root mx-auto min-h-[100dvh] max-w-lg ${canvas ? 'ios-canvas' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function IOSSpinnerScreen() {
  return (
    <div className="ios-root ios-canvas flex min-h-[100dvh] items-center justify-center">
      <div className="ios-spinner" aria-label="Ачаалж байна" />
    </div>
  );
}

export function IOSLargeTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="px-5 pb-3 pt-2">
      {eyebrow && (
        <p className="mb-1 inline-flex rounded-full bg-[rgba(255,69,0,0.1)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--ios-brand)]">
          {eyebrow}
        </p>
      )}
      <h1 className="ios-large-title mt-1">{title}</h1>
      {subtitle && <p className="ios-subhead mt-1.5 max-w-[22rem]">{subtitle}</p>}
    </header>
  );
}

export function IOSGroup({
  children,
  header,
  footer,
  className = '',
}: {
  children: ReactNode;
  header?: string;
  footer?: string;
  className?: string;
}) {
  return (
    <section className={`px-4 ${className}`}>
      {header && <p className="ios-section-header">{header}</p>}
      <div className="ios-group">{children}</div>
      {footer && <p className="ios-footnote px-5 pt-2">{footer}</p>}
    </section>
  );
}

export function IOSRowLink({
  href,
  icon,
  title,
  subtitle,
  trailing,
  destructive,
}: {
  href: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Link href={href} className="ios-row ios-row-press">
      {icon}
      <div className="min-w-0 flex-1 py-0.5">
        <p className={`ios-body ${destructive ? 'text-[var(--ios-red)]' : ''}`}>{title}</p>
        {subtitle && <p className="ios-footnote mt-0.5 truncate">{subtitle}</p>}
      </div>
      {trailing ?? (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--ios-tertiary)]" strokeWidth={2.2} />
      )}
    </Link>
  );
}

export function IOSNavBack({ href, label = 'Буцах' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[17px] font-medium text-[var(--ios-brand)] active:opacity-50"
      style={{ letterSpacing: '-0.41px' }}
    >
      <ChevronRight className="h-5 w-5 rotate-180" strokeWidth={2.4} />
      {label}
    </Link>
  );
}
