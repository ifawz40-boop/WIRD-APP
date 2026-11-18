import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';

export type QuranAyahCoordinate = { surahNumber: number; ayahNumber: number };
export type AyahNavigationDirection = 'previous' | 'next';

export function getAdjacentAyahCoordinate(
  current: QuranAyahCoordinate,
  direction: AyahNavigationDirection
): QuranAyahCoordinate | null {
  const surah = ALL_SURAHS[current.surahNumber - 1];
  if (!surah || !Number.isInteger(current.ayahNumber) || current.ayahNumber < 1 || current.ayahNumber > surah.versesCount) return null;

  if (direction === 'previous') {
    if (current.ayahNumber > 1) return { surahNumber: current.surahNumber, ayahNumber: current.ayahNumber - 1 };
    const previousSurah = ALL_SURAHS[current.surahNumber - 2];
    return previousSurah ? { surahNumber: previousSurah.number, ayahNumber: previousSurah.versesCount } : null;
  }

  if (current.ayahNumber < surah.versesCount) {
    return { surahNumber: current.surahNumber, ayahNumber: current.ayahNumber + 1 };
  }
  const nextSurah = ALL_SURAHS[current.surahNumber];
  return nextSurah ? { surahNumber: nextSurah.number, ayahNumber: 1 } : null;
}

interface AyahNavigationControlsProps {
  currentAyah: Pick<Ayah, 'surahNumber' | 'numberInSurah'>;
  onNavigate: (surahNumber: number, ayahNumber: number) => void;
  compact?: boolean;
}

export const AyahNavigationControls: React.FC<AyahNavigationControlsProps> = ({
  currentAyah,
  onNavigate,
  compact = false
}) => {
  const coordinate = { surahNumber: currentAyah.surahNumber, ayahNumber: currentAyah.numberInSurah };
  const previous = getAdjacentAyahCoordinate(coordinate, 'previous');
  const next = getAdjacentAyahCoordinate(coordinate, 'next');

  return (
    <nav
      aria-label="التنقل بين الآيات"
      className={`flex items-center justify-between gap-2 rounded-xl border border-[#1C4E46]/12 bg-white/75 px-2 py-2 dark:border-[#E0A96D]/20 dark:bg-[#0B132B]/65 ${compact ? 'text-[11px]' : 'text-xs'}`}
      dir="rtl"
    >
      <button
        type="button"
        disabled={!previous}
        onClick={() => previous && onNavigate(previous.surahNumber, previous.ayahNumber)}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#F2EDE2] px-2.5 font-bold text-[#1C4E46] transition-colors hover:bg-[#E6DFCE] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#162744] dark:text-[#E0A96D] dark:hover:bg-[#203453]"
      >
        <ChevronRight className="h-4 w-4 shrink-0" />
        <span>الآية السابقة</span>
      </button>
      <span className="shrink-0 px-1 text-center font-mono tabular-nums text-[10px] font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
        {currentAyah.surahNumber}:{currentAyah.numberInSurah}
      </span>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onNavigate(next.surahNumber, next.ayahNumber)}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1C4E46] px-2.5 font-bold text-white transition-colors hover:bg-[#28665B] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#1E4A47] dark:hover:bg-[#28665B]"
      >
        <span>الآية التالية</span>
        <ChevronLeft className="h-4 w-4 shrink-0" />
      </button>
    </nav>
  );
};
