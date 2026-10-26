'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { triggerHaptic } from '@/lib/haptics';

type Props = {
  /** card row (profile) | compact switch | sheet row (admin more) */
  variant?: 'card' | 'switch' | 'sheet';
  className?: string;
};

export default function ThemeToggle({ variant = 'card', className = '' }: Props) {
  const { isDark, toggle } = useTheme();

  const onToggle = () => {
    triggerHaptic();
    toggle();
  };

  if (variant === 'switch') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Харанхуй горим"
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          isDark ? 'bg-[var(--ios-brand)]' : 'bg-[#e5e5ea]'
        } ${className}`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            isDark ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    );
  }

  if (variant === 'sheet') {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-[16px] bg-[var(--ios-fill-secondary)] px-3.5 py-3.5 text-left active:opacity-90 ${className}`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--ios-bg-elevated)] text-[var(--ios-brand)] shadow-sm">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-[var(--ios-label)]">Харанхуй горим</p>
          <p className="text-[12px] font-medium text-[var(--ios-secondary)]">
            {isDark ? 'Асаалттай' : 'Унтраалттай'}
          </p>
        </div>
        <span
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            isDark ? 'bg-[var(--ios-brand)]' : 'bg-[#d1d5db]'
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
              isDark ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`dl-card flex w-full items-center gap-3.5 p-4 text-left transition-transform active:scale-[0.985] ${className}`}
    >
      <div className="ios-icon-tile ios-icon-tile-indigo !h-11 !w-11 !rounded-[13px]">
        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">Харанхуй горим</p>
        <p className="mt-0.5 text-[12px] font-medium text-[var(--ios-secondary)]">
          {isDark ? 'Асаалттай · цайвар руу шилжих' : 'Унтраалттай · харанхуй руу шилжих'}
        </p>
      </div>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          isDark ? 'bg-[var(--ios-brand)]' : 'bg-[#d1d5db]'
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            isDark ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
