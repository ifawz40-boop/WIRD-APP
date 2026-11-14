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
            className={`min-h-11 shrink-0 snap-start rounded-xl border font-bold transition-all flex items-center justify-center gap-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              size === 'sm' ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-xs sm:text-sm'
            } ${
              opt.disabled
                ? 'opacity-40 cursor-not-allowed bg-[#F2EDE2]/60 dark:bg-[#0E1A2F]/60 border-transparent text-[#5B6F6B]'
                : isActive
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs ring-1 ring-[#C59B27]/40 dark:ring-[#E0A96D]/40'
                : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:bg-[#F2EDE2] dark:hover:bg-[#162744] hover:border-[#C59B27]/50 dark:hover:border-[#E0A96D]/50'
            }`}
          >
            <span className="truncate">{opt.label}</span>
            {opt.hint && (
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                {opt.hint}
              </span>
            )}
            {opt.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                isActive ? 'bg-[#C59B27] text-[#0B132B]' : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#1C4E46] dark:text-[#E0A96D]'
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
