import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, BookOpen, ChevronDown, Minus, Plus } from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import type { SurahMeta } from '../../types/quran';

interface SurahPickerControlProps {
  value: number;
  onChange: (surahNumber: number) => void;
  label?: string;
  ariaLabel?: string;
  disabledSurahs?: number[];
  showQuickPopular?: boolean;
  ayahValue?: number;
  onAyahChange?: (ayah: number) => void;
  ayahLabel?: string;
  minAyah?: number;
  maxAyah?: number;
  compact?: boolean;
}

const POPULAR_SURAH_NUMBERS = [1, 2, 18, 36, 55, 67, 78, 112];

function normalizeArabicSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
    .toLowerCase();
}

/**
 * Searchable 114-Surah Picker replacing massive <select> menus with instant search,
 * popular surah quick-buttons, and optional +/- Ayah stepper controls.
 */
export const SurahPickerControl: React.FC<SurahPickerControlProps> = ({
  value,
  onChange,
  label,
  ariaLabel,
  disabledSurahs = [],
  showQuickPopular = true,
  ayahValue,
  onAyahChange,
  ayahLabel = 'الآية',
  minAyah = 1,
  maxAyah,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const selectedSurah: SurahMeta = useMemo(
    () => ALL_SURAHS.find(s => s.number === value) || ALL_SURAHS[0],
    [value]
  );

  const effectiveMaxAyah = maxAyah ?? selectedSurah.versesCount;

  const filteredSurahs = useMemo(() => {
    const q = normalizeArabicSearch(query);
    if (!q) return ALL_SURAHS;
    return ALL_SURAHS.filter(s => {
      const ar = normalizeArabicSearch(s.name);
      const en = s.englishName.toLowerCase();
      return ar.includes(q) || en.includes(q) || String(s.number) === q;
    });
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const handleSelectSurah = (surahNum: number) => {
    if (disabledSurahs.includes(surahNum)) return;
    onChange(surahNum);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="space-y-2 text-right">
      {label && (
        <span className="block text-xs font-bold text-[var(--wird-text)]">
          {label}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={ariaLabel || label || `اختيار السورة: ${selectedSurah.name}`}
          className={`min-h-11 flex-1 min-w-[180px] flex items-center justify-between gap-2 rounded-xl border bg-[var(--wird-surface)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] dark:hover:border-[#E0A96D] text-[var(--wird-text)] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
            compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/40 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] text-xs font-mono tabular-nums flex items-center justify-center shrink-0">
              {selectedSurah.number}
            </span>
            <span className="truncate font-quran text-base">سورة {selectedSurah.name}</span>
            <span className="text-[11px] font-medium text-[var(--wird-muted)] hidden sm:inline tabular-nums">
              ({selectedSurah.versesCount} آية)
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
        </button>

        {ayahValue !== undefined && onAyahChange && (
          <div className="flex items-center gap-1 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl p-1">
            <span className="px-2 text-[11px] font-bold text-[var(--wird-muted)]">
              {ayahLabel}
            </span>
            <button
              type="button"
              onClick={() => onAyahChange(Math.max(minAyah, ayahValue - 1))}
              disabled={ayahValue <= minAyah}
              aria-label={`إنقاص ${ayahLabel}`}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-lg bg-[var(--wird-surface)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] disabled:opacity-40 hover:bg-[var(--wird-primary)] hover:text-[var(--wird-primary-ink)] transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={minAyah}
              max={effectiveMaxAyah}
              value={ayahValue}
              aria-label={ayahLabel}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  onAyahChange(Math.max(minAyah, Math.min(effectiveMaxAyah, parsed)));
                }
              }}
              className="w-12 text-center bg-transparent text-xs font-bold font-mono tabular-nums text-[var(--wird-text)] outline-none"
            />
            <button
              type="button"
              onClick={() => onAyahChange(Math.min(effectiveMaxAyah, ayahValue + 1))}
              disabled={ayahValue >= effectiveMaxAyah}
              aria-label={`زيادة ${ayahLabel}`}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-lg bg-[var(--wird-surface)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] disabled:opacity-40 hover:bg-[var(--wird-primary)] hover:text-[var(--wird-primary-ink)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showQuickPopular && !compact && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar wird-scroll-rail py-0.5">
          <span className="text-[10px] font-bold text-[var(--wird-muted)] shrink-0">سريع:</span>
          {POPULAR_SURAH_NUMBERS.map(num => {
            const surah = ALL_SURAHS.find(s => s.number === num);
            if (!surah) return null;
            const disabled = disabledSurahs.includes(num);
            const active = value === num;
            return (
              <button
                key={num}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectSurah(num)}
                className={`min-h-9 shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  disabled
                    ? 'opacity-35 cursor-not-allowed border-transparent bg-[var(--wird-surface-muted)] text-[var(--wird-muted)]'
                    : active
                    ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
                    : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                }`}
              >
                {surah.name}
              </button>
            );
          })}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || label || 'اختيار السورة'}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[82vh] flex flex-col bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--wird-border)] flex items-center justify-between gap-3 bg-[var(--wird-surface)]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <h3 className="text-sm font-bold text-[var(--wird-text)]">
                  {label || 'اختر السورة من المصحف الشريف'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق منتقي السور"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:hover:text-white hover:bg-[var(--wird-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-white/70 dark:bg-[var(--wird-surface)] border-b border-[var(--wird-border)]">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث باسم السورة أو رقمها (مثال: البقرة، 67)..."
                  aria-label="بحث عن سورة"
                  className="w-full min-h-11 pr-10 pl-4 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs sm:text-sm text-[var(--wird-text)] outline-none focus:ring-2 focus:ring-[#C59B27]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredSurahs.map(surah => {
                const disabled = disabledSurahs.includes(surah.number);
                const selected = surah.number === value;
                return (
                  <button
                    key={surah.number}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectSurah(surah.number)}
                    className={`min-h-12 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-right transition-all ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed bg-[var(--wird-surface-muted)] dark:bg-[var(--wird-surface)] border-transparent'
                        : selected
                        ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs'
                        : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] dark:hover:border-[#E0A96D]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-8 h-8 rounded-lg text-xs font-bold font-mono tabular-nums flex items-center justify-center shrink-0 ${
                        selected
                          ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                          : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                      }`}>
                        {surah.number}
                      </span>
                      <div className="min-w-0">
                        <div className="font-quran text-base font-bold truncate">سورة {surah.name}</div>
                        <div className={`text-[10px] tabular-nums ${selected ? 'text-[#F5F1E8]/80' : 'text-[var(--wird-muted)]'}`}>
                          {surah.revelationType} · ص {surah.pageStart} · الجزء {surah.juzStart}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold font-mono tabular-nums shrink-0 ${selected ? 'text-[#E0A96D]' : 'text-[var(--wird-muted)]'}`}>
                      {surah.versesCount} آية
                    </span>
                  </button>
                );
              })}
              {filteredSurahs.length === 0 && (
                <div className="col-span-full py-10 text-center text-xs text-[var(--wird-muted)]">
                  لا توجد سورة مطابقة للبحث «{query}»
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
