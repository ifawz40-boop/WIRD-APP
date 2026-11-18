import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import {
  getOfflineTafsirDownloadStatus,
  getOfflineTafsirForSurah,
  OFFLINE_TAFSIR_SOURCE,
  type QuranEncTafsirRow
} from '../../services/tafsirOfflineLibrary';
import { TafsirOfflineDownloadPanel } from './TafsirOfflineDownloadPanel';
import { AyahNavigationControls } from '../shared/AyahNavigationControls';

interface TafsirMushafPageProps {
  pageNumber: number;
  sourcePageNumber: number;
  sourceSideLabel: 'الصفحة اليمنى' | 'الصفحة اليسرى' | 'الصفحة';
  ayahs: Ayah[];
  selectedAyah: Ayah | null;
  onNavigate: (surahNumber: number, ayahNumber: number) => void;
}

function getFootnoteLines(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : [];
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (typeof item === 'string') return item ? [item] : [];
      if (typeof item === 'number') return [String(item)];
      if (item && typeof item === 'object') {
        return Object.values(item as Record<string, unknown>).filter(part => typeof part === 'string' || typeof part === 'number').map(String);
      }
      return [];
    });
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).filter(part => typeof part === 'string' || typeof part === 'number').map(String);
  }
  return [];
}

export const TafsirMushafPage: React.FC<TafsirMushafPageProps> = ({
  pageNumber,
  sourcePageNumber,
  sourceSideLabel,
  ayahs,
  selectedAyah,
  onNavigate
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [rowsByCoordinate, setRowsByCoordinate] = useState<Map<string, QuranEncTafsirRow>>(new Map());
  const [error, setError] = useState('');

  const surahNumbers = useMemo(
    () => [...new Set(ayahs.map(ayah => ayah.surahNumber))],
    [ayahs]
  );

  const loadOfflineTafsir = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const status = await getOfflineTafsirDownloadStatus();
      if (!status.isComplete) {
        setIsOfflineReady(false);
        setRowsByCoordinate(new Map());
        return;
      }

      const surahs = await Promise.all(surahNumbers.map(surahNumber => getOfflineTafsirForSurah(surahNumber)));
      if (surahs.some(rows => !rows)) {
        setIsOfflineReady(false);
        setRowsByCoordinate(new Map());
        setError('بعض بيانات التفسير المحلية غير مكتملة. أعد استكمال التنزيل للتحقق منها.');
        return;
      }

      const next = new Map<string, QuranEncTafsirRow>();
      surahs.forEach(rows => rows?.forEach(row => next.set(`${Number(row.sura)}:${Number(row.aya)}`, row)));
      setRowsByCoordinate(next);
      setIsOfflineReady(true);
    } catch (reason) {
      setIsOfflineReady(false);
      setError(reason instanceof Error ? reason.message : 'تعذر قراءة التفسير المحلي.');
    } finally {
      setIsLoading(false);
    }
  }, [surahNumbers]);

  useEffect(() => { void loadOfflineTafsir(); }, [loadOfflineTafsir]);

  useEffect(() => {
    if (!isOfflineReady || !selectedAyah) return;
    document.getElementById(`wird-tafsir-ayah-${selectedAyah.surahNumber}-${selectedAyah.numberInSurah}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isOfflineReady, selectedAyah?.surahNumber, selectedAyah?.numberInSurah]);

  return (
    <section aria-label={`التفسير الميسر للآيات في ${sourceSideLabel} ${sourcePageNumber}`} className="flex min-h-[50vh] w-full flex-col overflow-hidden rounded-2xl border border-[#C59B27]/35 bg-[#FBF8F0] shadow-inner dark:border-[#E0A96D]/25 dark:bg-[#0D1930]" dir="rtl">
      <header className="border-b border-[#C59B27]/25 bg-[#F3EEDF] px-4 py-3 dark:border-[#E0A96D]/20 dark:bg-[#172640]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-wide text-[#8A6914] dark:text-[#E0A96D]">التفسير الميسر</p>
          <span className="text-[10px] font-semibold text-[#5B6F6B] dark:text-[#AAB8B4]">موضع العرض: ص {pageNumber}</span>
        </div>
        <h3 className="mt-1 text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">تفسير آيات {sourceSideLabel} {sourcePageNumber}</h3>
        <p className="mt-1 text-[10px] text-[#5B6F6B] dark:text-[#AAB8B4]">هذا الجانب يعرض تفسير آيات الصفحة المقابلة، بينما يظل الجانب الآخر متاحًا لقراءة المصحف.</p>
        {isOfflineReady && <p className="mt-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300" role="status">التفسير متاح محليًا دون اتصال.</p>}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {isOfflineReady && <TafsirOfflineDownloadPanel compact onComplete={loadOfflineTafsir} />}
        {isLoading ? (
          <p className="py-8 text-center text-xs text-[#5B6F6B] dark:text-[#AAB8B4]" role="status">جارٍ تجهيز التفسير المحلي…</p>
        ) : !isOfflineReady ? (
          <>
            {error && <p className="mb-3 text-xs leading-5 text-red-700 dark:text-red-300" role="alert">{error}</p>}
            <TafsirOfflineDownloadPanel onComplete={loadOfflineTafsir} />
          </>
        ) : ayahs.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#5B6F6B] dark:text-[#AAB8B4]">جارٍ تحميل بيانات الصفحة المقابلة…</p>
        ) : (
          ayahs.map(ayah => {
            const key = `${ayah.surahNumber}:${ayah.numberInSurah}`;
            const row = rowsByCoordinate.get(key);
            const isSelected = selectedAyah?.surahNumber === ayah.surahNumber && selectedAyah?.numberInSurah === ayah.numberInSurah;
            const footnotes = getFootnoteLines(row?.footnotes);
            return (
              <article
                key={key}
                id={`wird-tafsir-ayah-${ayah.surahNumber}-${ayah.numberInSurah}`}
                className={`rounded-xl border p-3 ${isSelected ? 'border-[#C59B27] bg-[#F6EED8] dark:bg-[#273047]' : 'border-[#1C4E46]/10 bg-white/80 dark:border-[#E0A96D]/15 dark:bg-[#111F36]'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#8A6914] dark:text-[#E0A96D]">سورة {ALL_SURAHS[ayah.surahNumber - 1]?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}</span>
                  {isSelected && <span className="rounded-md bg-[#C59B27]/15 px-2 py-1 text-[9px] font-bold text-[#8A6914] dark:text-[#E0A96D]">موضع القراءة</span>}
                </div>
                <p className="font-quran text-right text-base leading-[2.1] text-[#142421] dark:text-[#F5F1E8]">{ayah.text}</p>
                <p className="mt-3 whitespace-pre-line border-t border-[#1C4E46]/10 pt-3 text-sm leading-[1.9] text-[#243B35] dark:border-[#E0A96D]/15 dark:text-[#E8E1D4]">
                  {row?.translation || 'لا تتوفر بيانات التفسير لهذه الآية في النسخة المحلية.'}
                </p>
                {footnotes.length > 0 && (
                  <div className="mt-2 rounded-lg bg-[#F2EDE2] px-3 py-2 dark:bg-[#172640]">
                    <p className="mb-1 text-[10px] font-bold text-[#8A6914] dark:text-[#E0A96D]">الحواشي</p>
                    {footnotes.map((note, index) => <p key={index} className="whitespace-pre-line text-[11px] leading-5 text-[#5B6F6B] dark:text-[#AAB8B4]">{note}</p>)}
                  </div>
                )}
                <div className="mt-3">
                  <AyahNavigationControls currentAyah={ayah} onNavigate={onNavigate} compact />
                </div>
              </article>
            );
          })
        )}
      </div>

      <footer className="border-t border-[#C59B27]/20 px-3 py-2 text-[9px] leading-5 text-[#5B6F6B] dark:border-[#E0A96D]/15 dark:text-[#AAB8B4]">
        الناشر: {OFFLINE_TAFSIR_SOURCE.publisher} · المصدر: {OFFLINE_TAFSIR_SOURCE.source} · الإصدار V{OFFLINE_TAFSIR_SOURCE.version} ({OFFLINE_TAFSIR_SOURCE.releaseDate})
      </footer>
    </section>
  );
};
