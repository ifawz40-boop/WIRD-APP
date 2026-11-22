import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/* ==========================================================================
   WIRD UI Primitives — Hand-Crafted RTL-First Component Layer
   Inspired by Noor UI (RTL logical CSS, accessibility) & Shadcn (composability)
   Zero heavy third-party UI dependencies.
   ========================================================================== */

export interface WirdButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const WirdButton = React.forwardRef<HTMLButtonElement, WirdButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className = '',
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<NonNullable<WirdButtonProps['variant']>, string> = {
      primary:
        'bg-[var(--wird-primary)] text-white hover:bg-[var(--wird-primary-hover)] border border-transparent',
      secondary:
        'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border)] hover:border-[var(--wird-border-strong)]',
      accent:
        'bg-[var(--wird-accent)] text-[#0C1412] hover:bg-[var(--wird-accent-hover)] border border-transparent',
      ghost:
        'bg-transparent text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] border border-transparent',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 border border-transparent',
    };

    const sizeStyles: Record<NonNullable<WirdButtonProps['size']>, string> = {
      sm: 'min-h-9 px-3 py-1.5 text-xs gap-1.5',
      md: 'min-h-11 px-4 py-2 text-xs sm:text-sm gap-2',
      lg: 'min-h-12 px-5 py-2.5 text-sm gap-2',
      icon: 'min-h-11 min-w-11 p-2',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center rounded-[var(--wird-radius-control)] font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none wird-focus-ring ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
WirdButton.displayName = 'WirdButton';

export interface WirdCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  subtle?: boolean;
  accent?: boolean;
}

export const WirdCard: React.FC<WirdCardProps> = ({
  padded = true,
  subtle = false,
  accent = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-[var(--wird-radius-card)] border ${
        accent ? 'border-[var(--wird-border-gold)]' : 'border-[var(--wird-border)]'
      } transition-colors duration-150 ${
        subtle
          ? 'bg-[var(--wird-surface-muted)]'
          : 'bg-[var(--wird-surface)] shadow-[var(--wird-shadow)]'
      } ${padded ? 'p-[var(--wird-card-pad)]' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface WirdCardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const WirdCardHeader: React.FC<WirdCardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 ${className}`}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-base sm:text-lg font-bold text-[var(--wird-text)] wird-headline-balance leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export interface WirdMetadataRowProps {
  items: Array<string | number | null | undefined | false>;
  className?: string;
}

/** Zero-Pill metadata row: unboxed text with subtle typographic separators. */
export const WirdMetadataRow: React.FC<WirdMetadataRowProps> = ({
  items,
  className = '',
}) => {
  const cleanItems = items.filter(
    (item): item is string | number =>
      item !== null && item !== undefined && item !== false && String(item).trim() !== ''
  );
  if (cleanItems.length === 0) return null;

  return (
    <div className={`wird-metadata-row ${className}`}>
      {cleanItems.map((item, idx) => (
        <React.Fragment key={`${idx}-${String(item)}`}>
          {idx > 0 && (
            <span aria-hidden="true" className="opacity-55">
              ·
            </span>
          )}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

export interface SegmentedTabOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

export interface WirdSegmentedTabsProps<T extends string> {
  options: ReadonlyArray<SegmentedTabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function WirdSegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: WirdSegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`wird-segmented-track inline-flex items-center gap-1 max-w-full overflow-x-auto no-scrollbar ${className}`}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={`min-h-9 px-3 py-1.5 rounded-[calc(var(--wird-radius-control)-3px)] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 wird-focus-ring ${
              isActive
                ? 'bg-[var(--wird-surface)] text-[var(--wird-text)] shadow-2xs border border-[var(--wird-border)]'
                : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)] border border-transparent'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{option.label}</span>
            {typeof option.count === 'number' && (
              <span className="text-[11px] opacity-75 wird-tabular">
                ({option.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface WirdEmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const WirdEmptyState: React.FC<WirdEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`wird-surface-editorial p-8 text-center flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm sm:text-base font-bold text-[var(--wird-text)]">
          {title}
        </h3>
        <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};

export const WirdViewSkeleton: React.FC<{ label?: string }> = ({
  label = 'جارٍ تجهيز القسم القرآني...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="space-y-6 py-2 wird-view-enter"
    >
      <div className="wird-surface-editorial p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1 max-w-md">
            <div className="wird-skeleton h-5 w-44" />
            <div className="wird-skeleton h-3.5 w-72 max-w-full" />
          </div>
          <div className="wird-skeleton h-10 w-28 shrink-0" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="wird-skeleton h-20" />
          <div className="wird-skeleton h-20" />
          <div className="wird-skeleton h-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 wird-surface-editorial p-5 space-y-3">
          <div className="wird-skeleton h-4 w-36" />
          <div className="wird-skeleton h-28 w-full" />
          <div className="wird-skeleton h-24 w-full" />
        </div>
        <div className="lg:col-span-4 wird-surface-editorial p-5 space-y-3">
          <div className="wird-skeleton h-4 w-28" />
          <div className="wird-skeleton h-16 w-full" />
          <div className="wird-skeleton h-16 w-full" />
          <div className="wird-skeleton h-16 w-full" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
};

export interface WirdSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Accessible RTL slide-over Sheet (closes on Escape & backdrop click, restores focus). */
export const WirdSheet: React.FC<WirdSheetProps> = ({
  open,
  onClose,
  title,
  description,
  children,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" dir="rtl">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md h-full bg-[var(--wird-surface)] text-[var(--wird-text)] border-s border-[var(--wird-border)] shadow-2xl flex flex-col wird-view-enter"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--wird-border)]">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-bold text-[var(--wird-text)]">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl text-[var(--wird-muted)] hover:text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] transition-colors wird-focus-ring shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};
