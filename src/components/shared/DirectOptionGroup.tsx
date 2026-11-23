import React from 'react';

export interface DirectOptionItem<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  badge?: string | number;
  disabled?: boolean;
}

interface DirectOptionGroupProps<T extends string | number> {
  ariaLabel: string;
  options: DirectOptionItem<T>[];
  value: T;
  onChange: (value: T) => void;
  layout?: 'wrap' | 'scroll' | 'grid-2' | 'grid-3' | 'grid-4';
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Tactile direct selection buttons replacing native dropdown menus for 2-8 choices.
 * Ensures min 44px touch target, aria-pressed state, and WIRD Day/Night tokens.
 */
export function DirectOptionGroup<T extends string | number>({
  ariaLabel,
  options,
  value,
  onChange,
  layout = 'wrap',
  size = 'md',
  className = ''
}: DirectOptionGroupProps<T>) {
  const containerClass =
    layout === 'scroll'
      ? 'flex items-center gap-2 overflow-x-auto no-scrollbar wird-scroll-rail py-0.5'
      : layout === 'grid-2'
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
      : layout === 'grid-3'
      ? 'grid grid-cols-2 sm:grid-cols-3 gap-2'
      : layout === 'grid-4'
      ? 'grid grid-cols-2 sm:grid-cols-4 gap-2'
      : 'flex flex-wrap items-center gap-2';

  return (
    <div role="group" aria-label={ariaLabel} className={`${containerClass} ${className}`}>
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={opt.disabled}
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`min-h-11 shrink-0 snap-start rounded-xl border font-bold transition-all flex items-center justify-center gap-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
              size === 'sm' ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-xs sm:text-sm'
            } ${
              opt.disabled
                ? 'opacity-40 cursor-not-allowed bg-[var(--wird-surface-muted)] border-transparent text-[var(--wird-muted)]'
                : isActive
                ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs ring-1 ring-[var(--wird-border-gold)]'
                : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)]/50 dark:hover:border-[#E0A96D]/50'
            }`}
          >
            <span className="truncate">{opt.label}</span>
            {opt.hint && (
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#F5F1E8]/80' : 'text-[var(--wird-muted)]'}`}>
                {opt.hint}
              </span>
            )}
            {opt.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                isActive ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]' : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
              }`}>
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
