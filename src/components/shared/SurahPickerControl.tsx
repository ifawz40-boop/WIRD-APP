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
        <span className="block text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
          {label}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={ariaLabel || label || `اختيار السورة: ${selectedSurah.name}`}
          className={`min-h-11 flex-1 min-w-[180px] flex items-center justify-between gap-2 rounded-xl border bg-white dark:bg-[#111F36] border-[#1C4E46]/20 dark:border-[#E0A96D]/25 hover:border-[#C59B27] dark:hover:border-[#E0A96D] text-[#142421] dark:text-[#F5F1E8] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
            compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[#1C4E46]/10 dark:bg-[#1E4A47]/60 text-[#1C4E46] dark:text-[#E0A96D] text-xs font-mono tabular-nums flex items-center justify-center shrink-0">
              {selectedSurah.number}
            </span>
            <span className="truncate font-quran text-base">سورة {selectedSurah.name}</span>
            <span className="text-[11px] font-medium text-[#5B6F6B] dark:text-[#8B9E9B] hidden sm:inline tabular-nums">
              ({selectedSurah.versesCount} آية)
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] shrink-0" />
        </button>

        {ayahValue !== undefined && onAyahChange && (
          <div className="flex items-center gap-1 bg-[#F2EDE2] dark:bg-[#0E1A2F] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 rounded-xl p-1">
            <span className="px-2 text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">
              {ayahLabel}
            </span>
            <button
              type="button"
              onClick={() => onAyahChange(Math.max(minAyah, ayahValue - 1))}
              disabled={ayahValue <= minAyah}
              aria-label={`إنقاص ${ayahLabel}`}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-lg bg-white dark:bg-[#111F36] text-[#1C4E46] dark:text-[#E0A96D] disabled:opacity-40 hover:bg-[#1C4E46] hover:text-white transition-colors"
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
              className="w-12 text-center bg-transparent text-xs font-bold font-mono tabular-nums text-[#142421] dark:text-[#F5F1E8] outline-none"
            />
            <button
              type="button"
              onClick={() => onAyahChange(Math.min(effectiveMaxAyah, ayahValue + 1))}
              disabled={ayahValue >= effectiveMaxAyah}
              aria-label={`زيادة ${ayahLabel}`}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-lg bg-white dark:bg-[#111F36] text-[#1C4E46] dark:text-[#E0A96D] disabled:opacity-40 hover:bg-[#1C4E46] hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showQuickPopular && !compact && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar wird-scroll-rail py-0.5">
          <span className="text-[10px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B] shrink-0">سريع:</span>
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
                    ? 'opacity-35 cursor-not-allowed border-transparent bg-[#F2EDE2]/50 text-[#5B6F6B]'
                    : active
                    ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                    : 'bg-[#F2EDE2]/80 dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/10 dark:border-[#E0A96D]/15 hover:border-[#C59B27]'
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
            className="w-full max-w-xl max-h-[82vh] flex flex-col bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#C59B27]/40 dark:border-[#E0A96D]/35 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex items-center justify-between gap-3 bg-white dark:bg-[#111F36]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
                <h3 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">
                  {label || 'اختر السورة من المصحف الشريف'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق منتقي السور"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-white/70 dark:bg-[#111F36]/70 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <div className="relative">
                <Search className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث باسم السورة أو رقمها (مثال: البقرة، 67)..."
                  aria-label="بحث عن سورة"
                  className="w-full min-h-11 pr-10 pl-4 py-2 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-xs sm:text-sm text-[#142421] dark:text-[#F5F1E8] outline-none focus:ring-2 focus:ring-[#C59B27]"
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
                        ? 'opacity-40 cursor-not-allowed bg-[#F2EDE2]/50 dark:bg-[#111F36]/30 border-transparent'
                        : selected
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                        : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/18 hover:border-[#C59B27] dark:hover:border-[#E0A96D]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-8 h-8 rounded-lg text-xs font-bold font-mono tabular-nums flex items-center justify-center shrink-0 ${
                        selected
                          ? 'bg-[#C59B27] text-[#0B132B]'
                          : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#1C4E46] dark:text-[#E0A96D]'
                      }`}>
                        {surah.number}
                      </span>
                      <div className="min-w-0">
                        <div className="font-quran text-base font-bold truncate">سورة {surah.name}</div>
                        <div className={`text-[10px] tabular-nums ${selected ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                          {surah.revelationType} · ص {surah.pageStart} · الجزء {surah.juzStart}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold font-mono tabular-nums shrink-0 ${selected ? 'text-[#E0A96D]' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      {surah.versesCount} آية
                    </span>
                  </button>
                );
              })}
              {filteredSurahs.length === 0 && (
                <div className="col-span-full py-10 text-center text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
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
