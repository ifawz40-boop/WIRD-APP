import React from 'react';
import {
  Volume2,
  Play,
  Pause,
  Star,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react';
import type { AdhkarItem } from '../../data/adhkarData';
import type { AdhkarFontScale } from '../../services/adhkarProgressService';
import type { Ayah } from '../../types/quran';
import { QuranText } from '../shared/QuranText';
import { CircularCountdownRing } from './CircularCountdownRing';

interface AdhkarCardProps {
  item: AdhkarItem;
  indexNumber: number;
  currentCount: number;
  targetCount: number;
  remainingCount: number;
  isCompleted: boolean;
  isFavorite: boolean;
  isCopied: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  resolvedAyahs?: Ayah[];
  fontScale: AdhkarFontScale;
  showVirtueAndSource: boolean;
  onTapCount: () => void;
  onPlayAudio: () => void;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onResetItem: () => void;
}

const QURAN_FONT_SIZE_CLASSES: Record<AdhkarFontScale, string> = {
  sm: 'text-lg md:text-xl leading-[2.25]',
  md: 'text-xl md:text-2xl leading-[2.35]',
  lg: 'text-2xl md:text-[1.75rem] leading-[2.45]',
  xl: 'text-[1.65rem] md:text-[2rem] leading-[2.5]'
};

const HADITH_FONT_SIZE_CLASSES: Record<AdhkarFontScale, string> = {
  sm: 'text-[15px] md:text-base leading-[2.05]',
  md: 'text-base md:text-lg leading-[2.15]',
  lg: 'text-lg md:text-xl leading-[2.2]',
  xl: 'text-xl md:text-2xl leading-[2.25]'
};

/**
 * Interactive Adhkar Card with full-card & circular-ring countdown ergonomics.
 * Follows WIRD Design System V2 semantic tokens and zero-pill metadata discipline.
 */
export const AdhkarCard: React.FC<AdhkarCardProps> = ({
  item,
  indexNumber,
  currentCount,
  targetCount,
  remainingCount,
  isCompleted,
  isFavorite,
  isCopied,
  isPlaying,
  isPaused,
  resolvedAyahs,
  fontScale,
  showVirtueAndSource,
  onTapCount,
  onPlayAudio,
  onToggleFavorite,
  onCopy,
  onResetItem
}) => {
  const formattedIndex = String(indexNumber).padStart(2, '0');
  const repeatLabel = targetCount === 1 ? 'مرة واحدة' : `${targetCount} مرات`;

  const handleCardClick = () => {
    if (!isCompleted) {
      onTapCount();
    }
  };

  return (
    <article
      id={`adhkar-card-${item.id}`}
      onClick={handleCardClick}
      className={`wird-card p-5 md:p-6 transition-all duration-150 ${
        isCompleted
          ? 'border-emerald-600/35 dark:border-emerald-400/35 bg-emerald-50/35 dark:bg-emerald-950/15 opacity-90'
          : 'cursor-pointer hover:border-[var(--wird-border-gold)] active:scale-[0.995]'
      }`}
    >
      {/* Top Row: Editorial Title + Unboxed Metadata + Utility Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--wird-border)]">
        <div className="space-y-1 min-w-0 flex-1">
          <h3 className="text-base md:text-lg font-bold font-quran text-[var(--wird-text)] leading-snug">
            <span className="font-mono text-xs font-bold text-[var(--wird-muted)] tabular-nums ml-2">
              {formattedIndex}.
            </span>
            {item.title}
          </h3>
          {/* Zero-pill quiet metadata line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--wird-muted)]">
            <span className="font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              {item.grade}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">التكرار المسنون: {repeatLabel}</span>
            {item.kind === 'quran' && item.surahName && (
              <>
                <span aria-hidden="true">·</span>
                <span>سورة {item.surahName}</span>
              </>
            )}
          </div>
        </div>

        {/* Utility Actions (stopPropagation so tapping utilities never triggers countdown) */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          {item.kind === 'quran' && (
            <button
              type="button"
              onClick={onPlayAudio}
              className={`min-h-11 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                isPlaying
                  ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                  : 'bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)]'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف</span>
                </>
              ) : isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>استئناف</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>تلاوة</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            aria-label={isFavorite ? `إزالة ${item.title} من المفضلة` : `إضافة ${item.title} إلى المفضلة`}
            aria-pressed={isFavorite}
            onClick={onToggleFavorite}
            className={`min-h-11 min-w-11 flex items-center justify-center rounded-xl border transition-colors ${
              isFavorite
                ? 'bg-[var(--wird-accent-soft)] border-[var(--wird-border-gold)] text-[var(--wird-accent)]'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            aria-label={`نسخ ${item.title}`}
            onClick={onCopy}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-primary)] dark:hover:text-[var(--wird-accent)] transition-colors"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {currentCount > 0 && (
            <button
              type="button"
              aria-label={`تصفير عداد ${item.title}`}
              onClick={onResetItem}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body: Vocalized Text + Prominent Circular Countdown Ring */}
      <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex-1 min-w-0">
          {item.kind === 'quran' ? (
            <p className={`font-quran ${QURAN_FONT_SIZE_CLASSES[fontScale]} text-[var(--wird-text)] text-right`}>
              {resolvedAyahs && resolvedAyahs.length > 0 ? (
                resolvedAyahs.map(ayah => (
                  <React.Fragment key={ayah.number}>
                    <QuranText>{ayah.text}</QuranText>
                    <span className="ayah-number">{ayah.numberInSurah}</span>
                  </React.Fragment>
                ))
              ) : (
                <QuranText>{item.text}</QuranText>
              )}
            </p>
          ) : (
            <p className={`hadith-matn ${HADITH_FONT_SIZE_CLASSES[fontScale]} text-[var(--wird-text)] text-right`}>
              {item.text}
            </p>
          )}
        </div>

        {/* Circular Countdown Counter */}
        <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--wird-border)]">
          <span className="text-[11px] text-[var(--wird-muted)] sm:hidden">
            {isCompleted ? 'أتممت هذا الذكر' : 'اضغط على البطاقة أو الحلقة للعدّ'}
          </span>
          <CircularCountdownRing
            remaining={remainingCount}
            target={targetCount}
            isCompleted={isCompleted}
            ariaLabel={`عدّاد ${item.title}: متبقٍ ${remainingCount} من ${targetCount}`}
            onTap={e => {
              e.stopPropagation();
              onTapCount();
            }}
          />
          {!isCompleted && targetCount > 1 && (
            <span className="hidden sm:block text-[11px] font-mono tabular-nums text-[var(--wird-muted)]">
              {currentCount} / {targetCount}
            </span>
          )}
        </div>
      </div>

      {/* Optional Virtue & Primary Citation Footer (Controlled by Reader Toggle) */}
      {showVirtueAndSource && (
        <div className="mt-4 pt-3.5 border-t border-[var(--wird-border)] space-y-1.5 text-xs leading-relaxed text-[var(--wird-muted)]">
          <p>
            <strong className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              الفضل والبيان:{' '}
            </strong>
            {item.virtue}
          </p>
          <p className="text-[11px] opacity-85">
            المصدر: {item.source}
          </p>
        </div>
      )}
    </article>
  );
};
