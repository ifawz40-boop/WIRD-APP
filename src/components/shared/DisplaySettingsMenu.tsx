import React, { useEffect, useId, useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  DEFAULT_READING_DISPLAY_PREFERENCES,
  getReadingDisplayPreferences,
  saveReadingDisplayPreferences,
  type ReadingDisplayPreferences,
  type ReadingPageWidth,
  type ReadingSpacing,
  type ReadingViewId,
} from '../../services/readingDisplayPreferences';

interface DisplaySettingsCollapsibleCardProps {
  title?: string;
  summaryText?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable collapsible wrapper for per-page display settings ("إعدادات العرض").
 * Preserves inner region/group semantics while letting users tuck controls away cleanly.
 */
export const DisplaySettingsCollapsibleCard: React.FC<DisplaySettingsCollapsibleCardProps> = ({
  title = 'إعدادات العرض',
  summaryText,
  defaultOpen = true,
  storageKey,
  children,
  className = '',
}) => {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (!storageKey || typeof localStorage === 'undefined') return defaultOpen;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === 'true';
    } catch {
      return defaultOpen;
    }
  });

  const handleToggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          // Non-blocking fallback when storage is unavailable
        }
      }
      return next;
    });
  };

  return (
    <div className={`wird-card rounded-2xl border border-[var(--wird-border-gold)] shadow-xs overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="min-h-11 inline-flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-bold text-[var(--wird-text)] hover:text-[var(--wird-primary)] dark:text-[var(--wird-accent)] dark:hover:text-[var(--wird-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          <span>{title}</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--wird-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--wird-muted)]" />
          )}
        </button>

        {summaryText && (
          <span className="text-[11px] font-mono tabular-nums text-[var(--wird-muted)] bg-[var(--wird-surface-muted)] px-2.5 py-1 rounded-lg border border-[var(--wird-border)]">
            {summaryText}
          </span>
        )}
      </div>

      {isOpen && (
        <div id={panelId} className="border-t border-[var(--wird-border)] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
};

export function useReadingDisplayPreferences(viewId: ReadingViewId) {
  const [preferences, setPreferences] = useState<ReadingDisplayPreferences>(() =>
    getReadingDisplayPreferences(viewId)
  );

  useEffect(() => {
    saveReadingDisplayPreferences(viewId, preferences);
  }, [viewId, preferences]);

  const updatePreferences = (updates: Partial<ReadingDisplayPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    setPreferences({ ...DEFAULT_READING_DISPLAY_PREFERENCES });
  };

  return { preferences, updatePreferences, resetPreferences };
}

interface ReadingDisplaySettingsBarProps {
  viewLabel: string;
  preferences: ReadingDisplayPreferences;
  onUpdate: (updates: Partial<ReadingDisplayPreferences>) => void;
  onReset: () => void;
  defaultOpen?: boolean;
  fontLabel?: string;
  compactTrigger?: boolean;
}

export const ReadingDisplaySettingsMenu: React.FC<ReadingDisplaySettingsBarProps> = ({
  viewLabel,
  preferences,
  onUpdate,
  onReset,
  defaultOpen = false,
  fontLabel = 'حجم خط الآيات والنصوص',
  compactTrigger = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();
  const uiScaleId = useId();
  const fontSizeId = useId();

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={`min-h-11 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
            isOpen
              ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
              : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>إعدادات العرض</span>
          {!compactTrigger && (
            <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
              isOpen ? 'bg-white/15 text-[#F5F1E8]' : 'bg-[var(--wird-surface-muted)] text-[var(--wird-muted)]'
            }`}>
              {preferences.uiScale}% · {preferences.fontSize}px
            </span>
          )}
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <section
          id={panelId}
          aria-label={`إعدادات عرض ${viewLabel}`}
          className="wird-card rounded-2xl p-4 border border-[var(--wird-border-gold)] space-y-4 shadow-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor={uiScaleId} className="text-xs font-bold text-[var(--wird-text)] whitespace-nowrap">
                حجم الواجهة
              </label>
              <input
                id={uiScaleId}
                aria-label={`حجم واجهة ${viewLabel}`}
                type="range"
                min={85}
                max={115}
                step={5}
                value={preferences.uiScale}
                aria-valuetext={`${preferences.uiScale}%`}
                onChange={e => onUpdate({ uiScale: Number(e.target.value) })}
                className="min-h-11 w-full accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)]"
              />
              <output htmlFor={uiScaleId} className="text-xs font-mono tabular-nums text-[var(--wird-muted)] min-w-11 text-center">
                {preferences.uiScale}%
              </output>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor={fontSizeId} className="text-xs font-bold text-[var(--wird-text)] whitespace-nowrap">
                {fontLabel}
              </label>
              <input
                id={fontSizeId}
                aria-label={`${fontLabel} في ${viewLabel}`}
                type="range"
                min={18}
                max={40}
                step={2}
                value={preferences.fontSize}
                aria-valuetext={`${preferences.fontSize} بكسل`}
                onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
                className="min-h-11 w-full accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)]"
              />
              <output htmlFor={fontSizeId} className="text-xs font-mono tabular-nums text-[var(--wird-muted)] min-w-11 text-center">
                {preferences.fontSize}px
              </output>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--wird-border)]">
            <div role="group" aria-label={`المسافات في ${viewLabel}`} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--wird-muted)] ml-1">المسافات:</span>
              {([
                { value: 'compact', label: 'متقاربة' },
                { value: 'comfortable', label: 'مريحة' },
                { value: 'relaxed', label: 'واسعة' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={preferences.spacing === opt.value}
                  onClick={() => onUpdate({ spacing: opt.value as ReadingSpacing })}
                  className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    preferences.spacing === opt.value
                      ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
                      : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div role="group" aria-label={`عرض مساحة ${viewLabel}`} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--wird-muted)] ml-1">عرض الصفحة:</span>
              {([
                { value: 'comfortable', label: 'مريح' },
                { value: 'wide', label: 'واسع' },
                { value: 'full', label: 'ملء العرض' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={preferences.pageWidth === opt.value}
                  onClick={() => onUpdate({ pageWidth: opt.value as ReadingPageWidth })}
                  className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    preferences.pageWidth === opt.value
                      ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
                      : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onReset}
              className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] px-3 py-1.5 text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-border-gold)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط العرض</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
