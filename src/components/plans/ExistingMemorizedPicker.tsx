import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckSquare,
  Download,
  Layers,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { RetentionService } from '../../services/retentionService';
import {
  ALL_JUZ_DEFINITIONS,
  extractMemorizedRangesFromPortions,
  getJuzAyahRanges,
  getJuzCoverageStatus,
  getSurahCoverageStatus,
  MemorizedAyahRange,
  mergeMemorizedRanges,
  subtractMemorizedRanges,
  summarizeMemorizedRanges,
} from '../../services/memorizedRangeService';
import { SurahPickerControl } from '../shared/SurahPickerControl';

interface ExistingMemorizedPickerProps {
  value: MemorizedAyahRange[];
  onChange: (next: MemorizedAyahRange[]) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

type PickerMode = 'surahs' | 'juzs' | 'range';
type SurahFilter = 'all' | 'mufassal' | 'selected';
type CustomRangeMode = 'first_n' | 'between';

export const ExistingMemorizedPicker: React.FC<ExistingMemorizedPickerProps> = ({
  value,
  onChange,
  onToast,
}) => {
  const [mode, setMode] = useState<PickerMode>('surahs');
  const [surahSearch, setSurahSearch] = useState('');
  const [surahFilter, setSurahFilter] = useState<SurahFilter>('all');

  // Custom single-Surah ayah range state
  const [rangeSurah, setRangeSurah] = useState<number>(2);
  const [customRangeMode, setCustomRangeMode] = useState<CustomRangeMode>('first_n');
  const [firstNAyahs, setFirstNAyahs] = useState<number>(20);
  const [fromAyah, setFromAyah] = useState<number>(1);
  const [toAyah, setToAyah] = useState<number>(20);

  const summary = useMemo(() => summarizeMemorizedRanges(value), [value]);

  const recordedRanges = useMemo(() => {
    return extractMemorizedRangesFromPortions(RetentionService.getPortions());
  }, []);

  const recordedVersesCount = useMemo(
    () => recordedRanges.reduce((sum, item) => sum + (item.endAyah - item.startAyah + 1), 0),
    [recordedRanges]
  );

  const filteredSurahs = useMemo(() => {
    const q = surahSearch.trim().toLowerCase();
    return ALL_SURAHS.filter(surah => {
      if (surahFilter === 'mufassal' && surah.number < 50) return false;
      if (surahFilter === 'selected' && getSurahCoverageStatus(value, surah.number) === 'none') {
        return false;
      }
      if (!q) return true;
      return (
        surah.name.includes(q) ||
        surah.englishName.toLowerCase().includes(q) ||
        String(surah.number) === q
      );
    });
  }, [surahSearch, surahFilter, value]);

  const selectedRangeSurahMeta = useMemo(
    () => ALL_SURAHS.find(item => item.number === rangeSurah) || ALL_SURAHS[1],
    [rangeSurah]
  );

  const handleToggleSurah = (surahNumber: number) => {
    const surah = ALL_SURAHS.find(item => item.number === surahNumber);
    if (!surah) return;
    const status = getSurahCoverageStatus(value, surahNumber);
    const fullSurahRange: MemorizedAyahRange = {
      surahNumber,
      startAyah: 1,
      endAyah: surah.versesCount,
    };
    if (status === 'full') {
      onChange(subtractMemorizedRanges(value, [fullSurahRange]));
    } else {
      onChange(mergeMemorizedRanges([...value, fullSurahRange]));
    }
  };

  const handleSelectAllFilteredSurahs = () => {
    if (filteredSurahs.length === 0) return;
    const additions: MemorizedAyahRange[] = filteredSurahs.map(surah => ({
      surahNumber: surah.number,
      startAyah: 1,
      endAyah: surah.versesCount,
    }));
    onChange(mergeMemorizedRanges([...value, ...additions]));
  };

  const handleClearFilteredSurahs = () => {
    if (filteredSurahs.length === 0) return;
    const removals: MemorizedAyahRange[] = filteredSurahs.map(surah => ({
      surahNumber: surah.number,
      startAyah: 1,
      endAyah: surah.versesCount,
    }));
    onChange(subtractMemorizedRanges(value, removals));
  };

  const handleToggleJuz = (juzNumber: number) => {
    const juzRanges = getJuzAyahRanges(juzNumber);
    if (juzRanges.length === 0) return;
    const status = getJuzCoverageStatus(value, juzNumber);
    if (status === 'full') {
      onChange(subtractMemorizedRanges(value, juzRanges));
    } else {
      onChange(mergeMemorizedRanges([...value, ...juzRanges]));
    }
  };

  const handleSelectRangeSurahChange = (nextSurah: number) => {
    setRangeSurah(nextSurah);
    const meta = ALL_SURAHS.find(item => item.number === nextSurah);
    const maxV = meta?.versesCount || 286;
    setFirstNAyahs(prev => Math.max(1, Math.min(maxV, prev)));
    setFromAyah(1);
    setToAyah(Math.min(maxV, 20));
  };

  const handleAddCustomRange = () => {
    const maxV = selectedRangeSurahMeta.versesCount;
    const startAyah = customRangeMode === 'first_n' ? 1 : Math.max(1, Math.min(maxV, fromAyah));
    const endAyah =
      customRangeMode === 'first_n'
        ? Math.max(1, Math.min(maxV, firstNAyahs))
        : Math.max(startAyah, Math.min(maxV, toAyah));

    const next = mergeMemorizedRanges([
      ...value,
      { surahNumber: selectedRangeSurahMeta.number, startAyah, endAyah },
    ]);
    onChange(next);
    onToast?.(
      `تمت إضافة سورة ${selectedRangeSurahMeta.name} (${startAyah} - ${endAyah}) إلى المحفوظ السابق.`,
      'success'
    );
  };

  const handleImportRecorded = () => {
    if (recordedRanges.length === 0) {
      onToast?.('لا توجد مقاطع محفوظة مسجلة في حسابك بعد للاستيراد.', 'info');
      return;
    }
    const merged = mergeMemorizedRanges([...value, ...recordedRanges]);
    onChange(merged);
    onToast?.(
      `تم استيراد ودمج ${recordedVersesCount} آية من سجل حفظك بنجاح.`,
      'success'
    );
  };

  const handleRemoveItem = (item: MemorizedAyahRange) => {
    onChange(subtractMemorizedRanges(value, [item]));
  };

  const customPreviewStart =
    customRangeMode === 'first_n'
      ? 1
      : Math.max(1, Math.min(selectedRangeSurahMeta.versesCount, fromAyah));
  const customPreviewEnd =
    customRangeMode === 'first_n'
      ? Math.max(1, Math.min(selectedRangeSurahMeta.versesCount, firstNAyahs))
      : Math.max(
          customPreviewStart,
          Math.min(selectedRangeSurahMeta.versesCount, toAyah)
        );
  const customPreviewCount = customPreviewEnd - customPreviewStart + 1;

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Mode Switcher + Recorded Import */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="أوضاع تحديد المحفوظ السابق"
          className="wird-segmented-track inline-flex flex-wrap items-center gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'surahs'}
            onClick={() => setMode('surahs')}
            className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              mode === 'surahs'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-2xs'
                : 'text-[#5B6F6B] dark:text-[#CBD5E1] hover:text-[#142421] dark:hover:text-white'
            }`}
          >
            <ListChecks className="w-4 h-4 shrink-0" />
            <span>سور متعددة (114)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'juzs'}
            onClick={() => setMode('juzs')}
            className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              mode === 'juzs'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-2xs'
                : 'text-[#5B6F6B] dark:text-[#CBD5E1] hover:text-[#142421] dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>أجزاء كاملة (30)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'range'}
            onClick={() => setMode('range')}
            className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              mode === 'range'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-2xs'
                : 'text-[#5B6F6B] dark:text-[#CBD5E1] hover:text-[#142421] dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>آيات محددة من سورة</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleImportRecorded}
          disabled={recordedRanges.length === 0}
          title={
            recordedRanges.length === 0
              ? 'لا توجد مقاطع مسجلة في سجل الحفظ حتى الآن'
              : `استيراد ${recordedVersesCount} آية مسجلة في حسابك`
          }
          className="min-h-11 px-3.5 py-2 rounded-xl border border-[#C59B27]/40 dark:border-[#E0A96D]/35 bg-[#C59B27]/10 dark:bg-[#E0A96D]/12 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] shrink-0" />
          <span>
            {recordedRanges.length > 0
              ? `استيراد محفوظك المسجل (${recordedVersesCount} آية)`
              : 'لا يوجد محفوظ مسجل للاستيراد'}
          </span>
        </button>
      </div>

      {/* MODE 1: Multi-Select Surahs Grid */}
      {mode === 'surahs' && (
        <div className="space-y-3 rounded-2xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 bg-[#F9F6EE]/70 dark:bg-[#0B132B]/55 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={surahSearch}
                onChange={e => setSurahSearch(e.target.value)}
                placeholder="ابحث عن سورة بالاسم أو الرقم..."
                aria-label="ابحث عن سورة للتحديد المتعدد"
                className="w-full min-h-11 pl-8 pr-9 py-2 bg-white dark:bg-[#111F36] border border-[#1C4E46]/18 dark:border-[#E0A96D]/22 rounded-xl text-xs text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
              {surahSearch && (
                <button
                  type="button"
                  aria-label="مسح البحث"
                  onClick={() => setSurahSearch('')}
                  className="min-h-10 min-w-10 flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all' as const, label: 'الكل (114)' },
                  { id: 'mufassal' as const, label: 'المفصل (50–114)' },
                  { id: 'selected' as const, label: `المحددة (${summary.items.length})` },
                ] as const
              ).map(filterOpt => (
                <button
                  key={filterOpt.id}
                  type="button"
                  aria-pressed={surahFilter === filterOpt.id}
                  onClick={() => setSurahFilter(filterOpt.id)}
                  className={`min-h-11 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors ${
                    surahFilter === filterOpt.id
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                      : 'bg-white dark:bg-[#111F36] text-[#5B6F6B] dark:text-[#CBD5E1] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                  }`}
                >
                  {filterOpt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] pt-1">
            <span className="tabular-nums">
              انقر على أي سورة لتحديدها أو إلغائها مباشرة ({filteredSurahs.length} سورة معروضة)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFilteredSurahs}
                disabled={filteredSurahs.length === 0}
                className="min-h-10 px-2.5 py-1 rounded-lg font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#1C4E46]/10 dark:hover:bg-[#E0A96D]/15 disabled:opacity-40 transition-colors inline-flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>تحديد المطابق</span>
              </button>
              <button
                type="button"
                onClick={handleClearFilteredSurahs}
                disabled={filteredSurahs.length === 0}
                className="min-h-10 px-2.5 py-1 rounded-lg font-semibold text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-40 transition-colors"
              >
                إلغاء المطابق
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pl-1">
            {filteredSurahs.map(surah => {
              const coverage = getSurahCoverageStatus(value, surah.number);
              return (
                <button
                  key={surah.number}
                  type="button"
                  aria-pressed={coverage !== 'none'}
                  onClick={() => handleToggleSurah(surah.number)}
                  className={`min-h-12 px-3 py-2 rounded-xl border text-right flex items-center justify-between gap-2 transition-colors ${
                    coverage === 'full'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                      : coverage === 'partial'
                      ? 'bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 text-[#142421] dark:text-[#F5F1E8] border-[#C59B27] dark:border-[#E0A96D]'
                      : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/14 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg font-mono text-[11px] font-bold tabular-nums flex items-center justify-center shrink-0 ${
                        coverage === 'full'
                          ? 'bg-white/15 text-white'
                          : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#1C4E46] dark:text-[#E0A96D]'
                      }`}
                    >
                      {surah.number}
                    </span>
                    <span className="truncate font-bold text-xs font-quran">
                      سورة {surah.name}
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 shrink-0 text-[11px] tabular-nums">
                    <span className={coverage === 'full' ? 'text-white/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}>
                      {coverage === 'partial' ? 'جزئي' : `${surah.versesCount} آية`}
                    </span>
                    {coverage !== 'none' && (
                      <Check
                        className={`w-3.5 h-3.5 ${
                          coverage === 'full' ? 'text-[#E0A96D]' : 'text-[#C59B27] dark:text-[#E0A96D]'
                        }`}
                      />
                    )}
                  </span>
                </button>
              );
            })}
            {filteredSurahs.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                لا توجد سور مطابقة للتصفية الحالية.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: Exact 30-Juz Multi-Select */}
      {mode === 'juzs' && (
        <div className="space-y-3 rounded-2xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 bg-[#F9F6EE]/70 dark:bg-[#0B132B]/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
            <span>
              يُحتسب كل جزء بحدوده الدقيقة وفق رسم حفص دون إضافة آيات زائدة من السور المشتركة.
            </span>
            <button
              type="button"
              onClick={() => {
                const juz29And30 = [...getJuzAyahRanges(29), ...getJuzAyahRanges(30)];
                onChange(mergeMemorizedRanges([...value, ...juz29And30]));
              }}
              className="min-h-10 px-2.5 py-1 rounded-lg font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#1C4E46]/10 dark:hover:bg-[#E0A96D]/15 transition-colors whitespace-nowrap"
            >
              تحديد جزء تبارك وعمّ (29–30)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pl-1">
            {ALL_JUZ_DEFINITIONS.map(def => {
              const coverage = getJuzCoverageStatus(value, def.juzNumber);
              return (
                <button
                  key={def.juzNumber}
                  type="button"
                  aria-pressed={coverage !== 'none'}
                  onClick={() => handleToggleJuz(def.juzNumber)}
                  className={`min-h-14 p-3 rounded-xl border text-right flex items-center justify-between gap-2 transition-colors ${
                    coverage === 'full'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                      : coverage === 'partial'
                      ? 'bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 text-[#142421] dark:text-[#F5F1E8] border-[#C59B27] dark:border-[#E0A96D]'
                      : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/14 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                          coverage === 'full'
                            ? 'bg-white/15 text-white'
                            : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#1C4E46] dark:text-[#E0A96D]'
                        }`}
                      >
                        ج{def.juzNumber}
                      </span>
                      <span className="font-bold text-xs truncate">{def.name}</span>
                    </div>
                    <p
                      className={`text-[10px] truncate tabular-nums ${
                        coverage === 'full' ? 'text-white/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'
                      }`}
                    >
                      {def.startSurahName} {def.startAyah} ← {def.endSurahName} {def.endAyah} · {def.totalVerses} آية
                    </p>
                  </div>

                  <span className="shrink-0">
                    {coverage === 'full' ? (
                      <Check className="w-4 h-4 text-[#E0A96D]" />
                    ) : coverage === 'partial' ? (
                      <span className="text-[10px] font-bold text-[#9A7512] dark:text-[#E0A96D]">جزئي</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 3: Custom Verse Count or Range from Specific Surah */}
      {mode === 'range' && (
        <div className="space-y-4 rounded-2xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 bg-[#F9F6EE]/70 dark:bg-[#0B132B]/55 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <SurahPickerControl
              label="اختر السورة"
              ariaLabel="اختر السورة لتحديد نطاق آياتها"
              value={rangeSurah}
              onChange={handleSelectRangeSurahChange}
              showQuickPopular={false}
              compact
            />

            <div className="space-y-3">
              <div>
                <span className="block font-semibold text-[#142421] dark:text-[#F5F1E8] mb-1.5">
                  طريقة التحديد داخل السورة:
                </span>
                <div className="wird-segmented-track inline-flex w-full gap-1">
                  <button
                    type="button"
                    aria-pressed={customRangeMode === 'first_n'}
                    onClick={() => setCustomRangeMode('first_n')}
                    className={`flex-1 min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      customRangeMode === 'first_n'
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white'
                        : 'text-[#5B6F6B] dark:text-[#CBD5E1]'
                    }`}
                  >
                    أول عدد آيات
                  </button>
                  <button
                    type="button"
                    aria-pressed={customRangeMode === 'between'}
                    onClick={() => setCustomRangeMode('between')}
                    className={`flex-1 min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      customRangeMode === 'between'
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white'
                        : 'text-[#5B6F6B] dark:text-[#CBD5E1]'
                    }`}
                  >
                    من آية .. إلى آية
                  </button>
                </div>
              </div>

              {customRangeMode === 'first_n' ? (
                <div className="space-y-2">
                  <label
                    htmlFor="wird-first-n-ayahs"
                    className="block font-semibold text-[#142421] dark:text-[#F5F1E8]"
                  >
                    أول كم آية حفظت من سورة {selectedRangeSurahMeta.name}؟ (الحد الأقصى {selectedRangeSurahMeta.versesCount})
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="wird-first-n-ayahs"
                      type="number"
                      min={1}
                      max={selectedRangeSurahMeta.versesCount}
                      value={firstNAyahs}
                      onChange={e =>
                        setFirstNAyahs(
                          Math.max(1, Math.min(selectedRangeSurahMeta.versesCount, Number(e.target.value) || 1))
                        )
                      }
                      className="w-28 min-h-11 px-3 py-2 bg-white dark:bg-[#111F36] border border-[#1C4E46]/18 dark:border-[#E0A96D]/22 rounded-xl font-mono font-bold tabular-nums text-[#142421] dark:text-[#F5F1E8]"
                    />
                    {[10, 20, 50, 100]
                      .filter(n => n <= selectedRangeSurahMeta.versesCount)
                      .map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFirstNAyahs(preset)}
                          className={`min-h-11 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold tabular-nums transition-colors ${
                            firstNAyahs === preset
                              ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                              : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="wird-range-from-ayah"
                      className="block font-semibold text-[#142421] dark:text-[#F5F1E8] mb-1"
                    >
                      من الآية:
                    </label>
                    <input
                      id="wird-range-from-ayah"
                      type="number"
                      min={1}
                      max={selectedRangeSurahMeta.versesCount}
                      value={fromAyah}
                      onChange={e => {
                        const val = Math.max(
                          1,
                          Math.min(selectedRangeSurahMeta.versesCount, Number(e.target.value) || 1)
                        );
                        setFromAyah(val);
                        if (toAyah < val) setToAyah(val);
                      }}
                      className="w-full min-h-11 px-3 py-2 bg-white dark:bg-[#111F36] border border-[#1C4E46]/18 dark:border-[#E0A96D]/22 rounded-xl font-mono font-bold tabular-nums text-[#142421] dark:text-[#F5F1E8]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="wird-range-to-ayah"
                      className="block font-semibold text-[#142421] dark:text-[#F5F1E8] mb-1"
                    >
                      إلى الآية:
                    </label>
                    <input
                      id="wird-range-to-ayah"
                      type="number"
                      min={fromAyah}
                      max={selectedRangeSurahMeta.versesCount}
                      value={toAyah}
                      onChange={e => {
                        const val = Math.max(
                          fromAyah,
                          Math.min(selectedRangeSurahMeta.versesCount, Number(e.target.value) || fromAyah)
                        );
                        setToAyah(val);
                      }}
                      className="w-full min-h-11 px-3 py-2 bg-white dark:bg-[#111F36] border border-[#1C4E46]/18 dark:border-[#E0A96D]/22 rounded-xl font-mono font-bold tabular-nums text-[#142421] dark:text-[#F5F1E8]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
            <span className="text-xs text-[#5B6F6B] dark:text-[#CBD5E1] tabular-nums">
              سيُضاف: <strong className="text-[#1C4E46] dark:text-[#E0A96D]">سورة {selectedRangeSurahMeta.name} · الآيات {customPreviewStart} – {customPreviewEnd}</strong> ({customPreviewCount} آية)
            </span>
            <button
              type="button"
              onClick={handleAddCustomRange}
              className="wird-btn-primary min-h-11 px-4 py-2 text-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة النطاق للقائمة</span>
            </button>
          </div>
        </div>
      )}

      {/* Consolidated Selected Memorized Ranges Summary */}
      <div className="rounded-2xl border border-[#1C4E46]/14 dark:border-[#E0A96D]/20 bg-white dark:bg-[#111F36]/75 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <BookOpen className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D] shrink-0" />
            <span className="font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums">
              المحفوظ المضاف للمراجعة الكبرى ({summary.totalVerses} آية · {summary.items.length} نطاق)
            </span>
            {summary.completeJuzs.length > 0 && (
              <span className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                · أجزاء مكتملة: {summary.completeJuzs.map(j => `ج${j}`).join('، ')}
              </span>
            )}
          </div>

          {summary.items.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="min-h-10 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح المحدد</span>
            </button>
          )}
        </div>

        {summary.items.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {summary.items.map(item => (
              <button
                key={`${item.surahNumber}_${item.startAyah}_${item.endAyah}`}
                type="button"
                aria-label={`إزالة سورة ${item.surahName} من المحفوظ`}
                onClick={() => handleRemoveItem(item)}
                className="min-h-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#C59B27]/35 dark:border-[#E0A96D]/35 bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] hover:border-rose-400 text-xs font-semibold transition-colors"
              >
                <span className="font-quran font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                  سورة {item.surahName}
                </span>
                <span className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                  {item.isFullSurah
                    ? `كاملة (${item.versesCount})`
                    : `${item.startAyah}–${item.endAyah} (${item.versesCount})`}
                </span>
                <X className="w-3.5 h-3.5 text-[#5B6F6B] hover:text-rose-600" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] leading-relaxed">
            لم تُضف سوراً أو أجزاء محفوظة بعد. يمكنك تحديد عدة سور معاً، أو اختيار أجزاء كاملة، أو تحديد عدد آيات معين من أي سورة، أو استيراد محفوظك المسجل.
          </p>
        )}
      </div>
    </div>
  );
};
