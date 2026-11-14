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
    <div className={`wird-card rounded-2xl border border-[#C59B27]/25 dark:border-[#E0A96D]/20 shadow-xs overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="min-h-11 inline-flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:text-[#1C4E46] dark:hover:text-[#E0A96D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
          <span>{title}</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B]" />
          )}
        </button>

        {summaryText && (
          <span className="text-[11px] font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B] bg-[#F2EDE2]/70 dark:bg-[#0B132B]/70 px-2.5 py-1 rounded-lg border border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
            {summaryText}
          </span>
        )}
      </div>

      {isOpen && (
        <div id={panelId} className="border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 px-4 py-4">
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
          className={`min-h-11 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
            isOpen
              ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
              : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>إعدادات العرض</span>
          {!compactTrigger && (
            <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
              isOpen ? 'bg-white/15 text-[#F5F1E8]' : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#5B6F6B] dark:text-[#8B9E9B]'
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
          className="wird-card rounded-2xl p-4 border border-[#C59B27]/30 dark:border-[#E0A96D]/25 space-y-4 shadow-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor={uiScaleId} className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8] whitespace-nowrap">
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
                className="min-h-11 w-full accent-[#1C4E46] dark:accent-[#E0A96D]"
              />
              <output htmlFor={uiScaleId} className="text-xs font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B] min-w-11 text-center">
                {preferences.uiScale}%
              </output>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor={fontSizeId} className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8] whitespace-nowrap">
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
                className="min-h-11 w-full accent-[#1C4E46] dark:accent-[#E0A96D]"
              />
              <output htmlFor={fontSizeId} className="text-xs font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B] min-w-11 text-center">
                {preferences.fontSize}px
              </output>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
            <div role="group" aria-label={`المسافات في ${viewLabel}`} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B] ml-1">المسافات:</span>
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
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                      : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div role="group" aria-label={`عرض مساحة ${viewLabel}`} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B] ml-1">عرض الصفحة:</span>
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
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                      : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onReset}
              className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 py-1.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] transition-colors"
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
