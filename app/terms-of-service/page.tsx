'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--soyol-canvas)] px-4 py-10 pb-24 text-[var(--soyol-ink)]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--soyol-brand-soft)] text-[var(--soyol-brand)]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Үйлчилгээний нөхцөл</h1>
            <p className="text-sm text-[var(--soyol-muted)]">Soyol Delivery · mn.delivery.app</p>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-[var(--soyol-muted)]">
          Бүрэн нөхцөлийг{' '}
          <Link href="/terms" className="font-bold text-[var(--soyol-brand)]">
            /terms
          </Link>{' '}
          хуудаснаас уншина уу. Энэхүү апп нь хүргэлтийн захиалга, хүргэгч, диспетчерийн үйлчилгээнд
          зориулагдсан.
        </p>

        <ul className="space-y-4 text-sm leading-relaxed text-[var(--soyol-muted)]">
          <li>
            <strong className="text-[var(--soyol-ink)]">Бүртгэл:</strong> Апп дотор бүртгүүлэх болон
            «Бүртгэл устгах» боломжтой.
          </li>
          <li>
            <strong className="text-[var(--soyol-ink)]">Зориулалт:</strong> Захиалга хянах, хүргэх,
            OTP-аар хүлээн авах, мэдэгдэл хүлээн авах.
          </li>
          <li>
            <strong className="text-[var(--soyol-ink)]">Нууцлал:</strong>{' '}
            <Link href="/privacy" className="font-bold text-[var(--soyol-brand)]">
              Нууцлалын бодлого
            </Link>
          </li>
        </ul>

        <p className="mt-8 text-xs text-[var(--soyol-soft)]">Сүүлд шинэчлэгдсэн: 2026.10.26</p>
      </div>
    </div>
  );
}
