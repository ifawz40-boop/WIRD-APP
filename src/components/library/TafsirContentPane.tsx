import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  PanelLeft,
  RefreshCw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getAyahDisplayText, loadSurahVerses } from '../../data/quranDataLoader';
import { getTafsir, TAFSIR_EDITIONS } from '../../services/tafsirService';
import { parseTafsirToSegments, sanitizeTafsirToPlainText } from '../../utils/tafsirSanitizer';
import type { MushafTafsirDesktopLayout } from '../../services/mushafSpreadService';
import { RelatedHadithPanel } from '../shared/RelatedHadithPanel';
import { QuranText } from '../shared/QuranText';

export interface TafsirContentPaneProps {
  ayah: Ayah;
  onSelectAyah: (nextAyah: Ayah) => void;
  onClose?: () => void;
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  titleId?: string;
  pageNumber?: number;
  pageAyahs?: Ayah[];
  desktopLayout?: MushafTafsirDesktopLayout;
  onChangeDesktopLayout?: (layout: MushafTafsirDesktopLayout) => void;
  returnToMushafLabel?: string;
  compactHeader?: boolean;
  syncReadingPageAction?: {
    pageNumber: number;
    onSync: () => void;
  };
}

const FONT_SIZE_KEY = 'wird_tafsir_font_size_v1';
const SELECTED_BOOK_KEY = 'wird_tafsir_selected_book_v1';

const FONT_SIZES = [
  { label: 'صغير', sizeClass: 'text-[14px] leading-[2.1]' },
  { label: 'متوسط', sizeClass: 'text-[16px] leading-[2.2]' },
  { label: 'كبير', sizeClass: 'text-[18px] leading-[2.3]' },
  { label: 'كبير جداً', sizeClass: 'text-[21px] leading-[2.4]' }
];

async function resolveAdjacentAyah(ayah: Ayah, direction: 'prev' | 'next'): Promise<Ayah | null> {
  if (direction === 'next') {
    const currentSurahMeta = ALL_SURAHS[ayah.surahNumber - 1];
    if (!currentSurahMeta) return null;
    if (ayah.numberInSurah < currentSurahMeta.versesCount) {
      const verses = await loadSurahVerses(ayah.surahNumber);
      return verses.find(v => v.numberInSurah === ayah.numberInSurah + 1) || null;
    }
    if (ayah.surahNumber < 114) {
      const nextVerses = await loadSurahVerses(ayah.surahNumber + 1);
      return nextVerses[0] || null;
    }
    return null;
  }

  if (ayah.numberInSurah > 1) {
    const verses = await loadSurahVerses(ayah.surahNumber);
    return verses.find(v => v.numberInSurah === ayah.numberInSurah - 1) || null;
  }
  if (ayah.surahNumber > 1) {
    const prevVerses = await loadSurahVerses(ayah.surahNumber - 1);
    return prevVerses[prevVerses.length - 1] || null;
  }
  return null;
}

export const TafsirContentPane: React.FC<TafsirContentPaneProps> = ({
  ayah,
  onSelectAyah,
  onClose,
  closeButtonRef,
  titleId = 'wird-tafsir-dialog-title',
  pageNumber,
  pageAyahs,
  desktopLayout,
  onChangeDesktopLayout,
  returnToMushafLabel,
  compactHeader = false,
  syncReadingPageAction
}) => {
  const [selectedBookId, setSelectedBookId] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SELECTED_BOOK_KEY));
      return TAFSIR_EDITIONS.some(b => b.id === saved) ? saved : 16;
    } catch {
      return 16;
    }
  });

  const [fontSizeIndex, setFontSizeIndex] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
      return Number.isInteger(saved) && saved >= 0 && saved < FONT_SIZES.length ? saved : 1;
    } catch {
      return 1;
    }
  });

  const [rawText, setRawText] = useState('');
  const [currentBookName, setCurrentBookName] = useState('التفسير الميسر');
  const [currentAuthor, setCurrentAuthor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'single_ayah' | 'page_overview'>('single_ayah');
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
  const hasPrevAyah = !(ayah.surahNumber === 1 && ayah.numberInSurah === 1);
  const hasNextAyah = !(ayah.surahNumber === 114 && ayah.numberInSurah >= (surah?.versesCount || 6));

  const handleSelectBook = (bookId: number) => {
    setSelectedBookId(bookId);
    try {
      localStorage.setItem(SELECTED_BOOK_KEY, String(bookId));
    } catch {
      // Storage unavailable
    }
  };

  const handleAdjustFontSize = (direction: 'increase' | 'decrease') => {
    setFontSizeIndex(prev => {
      const next = direction === 'increase'
        ? Math.min(FONT_SIZES.length - 1, prev + 1)
        : Math.max(0, prev - 1);
      try {
        localStorage.setItem(FONT_SIZE_KEY, String(next));
      } catch {
        // Storage unavailable
      }
      return next;
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    setRawText('');
    setError(null);
    setIsCached(false);
    setIsLoading(true);

    getTafsir(ayah.surahNumber, ayah.numberInSurah, selectedBookId, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setRawText(result.text);
        setCurrentBookName(result.bookName);
        setCurrentAuthor(result.author || '');
        setIsCached(result.source === 'cache');
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason?.message || 'تعذر تحميل التفسير من المصدر.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [ayah.surahNumber, ayah.numberInSurah, selectedBookId, retry]);

  const segments = useMemo(() => parseTafsirToSegments(rawText), [rawText]);

  const handleStepAyah = async (direction: 'prev' | 'next') => {
    if (isStepping) return;
    setIsStepping(true);
    try {
      const adjacent = await resolveAdjacentAyah(ayah, direction);
      if (adjacent) {
        setViewMode('single_ayah');
        onSelectAyah(adjacent);
      }
    } finally {
      setIsStepping(false);
    }
  };

  const handleCopyTafsir = async () => {
    if (!rawText) return;
    const plainTafsir = sanitizeTafsirToPlainText(rawText);
    const surahName = surah?.name || ayah.surahNumber;
    const displayText = await getAyahDisplayText(ayah);
    const shareText = `﴿ ${displayText} ﴾ [سورة ${surahName}، آية ${ayah.numberInSurah}]\n\n📖 ${currentBookName}:\n${plainTafsir}\n\n— عبر تطبيق وِرد القرآني (WIRD)`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2500);
    } catch {
      // Clipboard fallback failed cleanly
    }
  };

  const currentSizeConfig = FONT_SIZES[fontSizeIndex];

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--wird-surface)] text-[var(--wird-text)]">
      {/* Header */}
      <div className={`flex flex-col border-b border-[var(--wird-border)] bg-[var(--wird-surface-muted)]/90 shrink-0 ${compactHeader ? 'px-4 py-3 space-y-2.5' : 'px-5 py-3.5 space-y-3'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] flex items-center justify-center shadow-xs shrink-0 border border-[var(--wird-border-gold)]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="font-bold text-[var(--wird-text)] text-sm md:text-base font-quran truncate">
                {currentBookName}
              </h2>
              <p className="text-xs text-[var(--wird-muted)] truncate">
                سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}
                {pageNumber ? ` · ص ${pageNumber}` : ''}
                {currentAuthor ? ` · ${currentAuthor}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyTafsir}
              disabled={isLoading || !rawText}
              aria-label="نسخ الآية والتفسير"
              title="نسخ الآية والتفسير للمشاركة"
              className={`min-h-10 min-w-10 px-2.5 py-1.5 rounded-[var(--wird-radius-control)] border transition-all text-xs font-semibold flex items-center gap-1.5 ${
                copied
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                  : 'bg-[var(--wird-surface)] border-[var(--wird-border-strong)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
              } disabled:opacity-40`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-[var(--wird-muted)]" />}
              <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                ref={closeButtonRef}
                aria-label={returnToMushafLabel || 'إغلاق التفسير'}
                className="min-h-10 min-w-10 px-2.5 py-1.5 rounded-[var(--wird-radius-control)] hover:bg-[var(--wird-surface)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] transition-colors inline-flex items-center gap-1 text-xs font-bold"
              >
                <X className="w-4 h-4" />
                {returnToMushafLabel && <span className="hidden sm:inline">{returnToMushafLabel}</span>}
              </button>
            )}
          </div>
        </div>

        {/* Context-aware Ayah Stepping & Page Tafsir Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--wird-border)] text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!hasPrevAyah || isStepping}
              onClick={() => void handleStepAyah('prev')}
              aria-label="تفسير الآية السابقة"
              className="min-h-10 inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" /> الآية السابقة
            </button>
            <button
              type="button"
              disabled={!hasNextAyah || isStepping}
              onClick={() => void handleStepAyah('next')}
              aria-label="تفسير الآية التالية"
              className="min-h-10 inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] disabled:opacity-40 transition-colors"
            >
              الآية التالية <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {syncReadingPageAction && (
              <button
                type="button"
                onClick={syncReadingPageAction.onSync}
                className="min-h-10 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] px-3 py-1.5 font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:border-[var(--wird-accent)] transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>تفسير صفحة {syncReadingPageAction.pageNumber}</span>
              </button>
            )}

            {pageAyahs && pageAyahs.length > 0 && (
              <button
                type="button"
                aria-pressed={viewMode === 'page_overview'}
                onClick={() => setViewMode(prev => (prev === 'page_overview' ? 'single_ayah' : 'page_overview'))}
                className={`min-h-10 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] border px-3 py-1.5 font-bold transition-colors ${
                  viewMode === 'page_overview'
                    ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                    : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>فهرس آيات الصفحة ({pageAyahs.length})</span>
              </button>
            )}

            {desktopLayout && onChangeDesktopLayout && (
              <div
                role="group"
                aria-label="تخطيط عرض التفسير بجانب المصحف"
                className="inline-flex rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] bg-[var(--wird-surface)] p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={desktopLayout === 'panel'}
                  onClick={() => onChangeDesktopLayout('panel')}
                  className={`min-h-9 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                    desktopLayout === 'panel'
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                      : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                  }`}
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span>لوحة جانبية</span>
                </button>
                <button
                  type="button"
                  aria-pressed={desktopLayout === 'replace_opposite'}
                  onClick={() => onChangeDesktopLayout('replace_opposite')}
                  className={`min-h-9 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                    desktopLayout === 'replace_opposite'
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                      : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                  }`}
                >
                  استبدال المقابلة
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edition Selector & Font Scaler Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--wird-border)] text-xs">
          <label className="flex items-center gap-2 text-xs text-[var(--wird-muted)]">
            <span className="text-[11px] font-semibold shrink-0">كتاب التفسير</span>
            <select
              aria-label="اختيار كتاب التفسير"
              value={selectedBookId}
              onChange={event => handleSelectBook(Number(event.target.value))}
              className="min-h-10 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 text-xs font-bold text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
            >
              {TAFSIR_EDITIONS.map(edition => (
                <option key={edition.id} value={edition.id}>
                  {edition.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1 bg-[var(--wird-surface)] border border-[var(--wird-border)] rounded-[var(--wird-radius-control)] p-0.5">
            <button
              type="button"
              onClick={() => handleAdjustFontSize('decrease')}
              disabled={fontSizeIndex === 0}
              aria-label="تصغير خط التفسير"
              title="تصغير خط التفسير"
              className="min-h-10 min-w-10 p-1 hover:bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] rounded-lg disabled:opacity-30 flex items-center justify-center"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono font-medium text-[var(--wird-muted)]">
              {currentSizeConfig.label}
            </span>
            <button
              type="button"
              onClick={() => handleAdjustFontSize('increase')}
              disabled={fontSizeIndex === FONT_SIZES.length - 1}
              aria-label="تكبير خط التفسير"
              title="تكبير خط التفسير"
              className="min-h-10 min-w-10 p-1 hover:bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] rounded-lg disabled:opacity-30 flex items-center justify-center"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 md:p-5 lg:pb-6 space-y-5">
        {viewMode === 'page_overview' && pageAyahs && pageAyahs.length > 0 && (
          <div className="rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] p-3.5 space-y-2.5">
            <p className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              اختر آية من الصفحة {pageNumber ? `(${pageNumber})` : ''} لقراءة تفسيرها مباشرة:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pageAyahs.map(pageItem => {
                const isSelected =
                  pageItem.surahNumber === ayah.surahNumber &&
                  pageItem.numberInSurah === ayah.numberInSurah;
                const itemSurah = ALL_SURAHS.find(s => s.number === pageItem.surahNumber);
                return (
                  <button
                    key={pageItem.number}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      onSelectAyah(pageItem);
                      setViewMode('single_ayah');
                    }}
                    className={`min-h-10 px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                        : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)]'
                    }`}
                  >
                    {itemSurah?.name || pageItem.surahNumber}: {pageItem.numberInSurah}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ayah Display */}
        <div className="rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] p-4 md:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2.5 text-xs text-[var(--wird-accent)] font-semibold border-b border-[var(--wird-border)] pb-2">
            <span>نص الآية الكريمة</span>
            <span className="font-sans-ui text-[11px] font-bold">
              سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}
            </span>
          </div>

          <p className="font-quran text-xl md:text-2xl leading-[2.3] text-right text-[var(--wird-text)]">
            <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>
              {ayah.text}
            </QuranText>{' '}
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[var(--wird-accent)] text-[var(--wird-accent)] bg-[var(--wird-surface)] font-sans text-xs align-middle font-bold mx-1 tabular-nums">
              {ayah.numberInSurah}
            </span>
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p className="text-sm font-semibold">جارٍ تحميل التفسير المعتمد من المصدر الرسمي...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <p className="text-sm font-bold">تعذر تحميل التفسير</p>
            </div>
            <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRetry(val => val + 1)}
                className="inline-flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
              <button
                type="button"
                onClick={() => handleSelectBook(16)}
                className="min-h-11 text-xs text-rose-900 dark:text-rose-300 underline font-semibold"
              >
                التبديل إلى التفسير الميسر
              </button>
            </div>
          </div>
        )}

        {/* Tafsir Text */}
        {!isLoading && !error && segments.length > 0 && (
          <article className={`p-1 space-y-3 text-[var(--wird-text)] ${currentSizeConfig.sizeClass} text-justify font-sans-ui`}>
            <div className="flex items-center gap-2 pb-2 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border-b border-[var(--wird-border)]">
              <Sparkles className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
              <span>بيان المعنى والشرح:</span>
            </div>

            <div className="space-y-4">
              {renderSegmentBlocks(segments)}
            </div>
          </article>
        )}

        {!isLoading && !error && segments.length === 0 && (
          <div className="py-10 text-center text-[var(--wird-muted)] text-xs">
            لا يتوفر نص تفسير متاح لهذه الآية في الطبعة المحددة حالياً.
          </div>
        )}

        <RelatedHadithPanel ayah={ayah} />

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--wird-border)] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--wird-muted)]">
          <span>{isCached ? 'محفوظ محلياً للرجوع إليه دون إنترنت' : 'تم الجلب مباشرة من Quran.com API v4'}</span>
          <a
            href="https://quran.com/ar/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline"
          >
            <span>منصة مطوري Quran.com</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

function renderSegmentBlocks(segments: ReturnType<typeof parseTafsirToSegments>) {
  const paragraphs: Array<Array<typeof segments[0]>> = [];
  let currentPara: Array<typeof segments[0]> = [];

  segments.forEach(seg => {
    if (seg.type === 'paragraph_break') {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara);
        currentPara = [];
      }
    } else {
      currentPara.push(seg);
    }
  });
  if (currentPara.length > 0) {
    paragraphs.push(currentPara);
  }

  return paragraphs.map((para, pIndex) => (
    <p key={`para-${pIndex}`} className="leading-[2.2] tracking-wide">
      {para.map(seg => {
        if (seg.type === 'ayah_quote') {
          return (
            <span
              key={seg.id}
              className="font-quran text-[var(--wird-accent)] font-bold bg-[var(--wird-accent-soft)] px-1.5 py-0.5 rounded-md inline-block mx-1 border border-[var(--wird-border-gold)]"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'highlight') {
          return (
            <span
              key={seg.id}
              className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] bg-[var(--wird-surface-muted)] px-1 py-0.5 rounded inline-block mx-0.5"
            >
              {seg.text}
            </span>
          );
        }
        return <span key={seg.id}>{seg.text} </span>;
      })}
    </p>
  ));
}
