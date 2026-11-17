import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Type,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getTafsir, TAFSIR_EDITIONS, TafsirBookOption } from '../../services/tafsirService';
import { parseTafsirToSegments, sanitizeTafsirToPlainText } from '../../utils/tafsirSanitizer';
import { RelatedHadithPanel } from '../shared/RelatedHadithPanel';
import { QuranText } from '../shared/QuranText';
import { getAyahDisplayText } from '../../data/quranDataLoader';

interface TafsirSheetProps {
  ayah: Ayah | null;
  onClose: () => void;
}

const FONT_SIZE_KEY = 'wird_tafsir_font_size_v1';
const SELECTED_BOOK_KEY = 'wird_tafsir_selected_book_v1';

const FONT_SIZES = [
  { label: 'صغير', sizeClass: 'text-[14px] leading-[2.1]' },
  { label: 'متوسط', sizeClass: 'text-[16px] leading-[2.2]' },
  { label: 'كبير', sizeClass: 'text-[18px] leading-[2.3]' },
  { label: 'كبير جداً', sizeClass: 'text-[21px] leading-[2.4]' }
];

export const TafsirSheet: React.FC<TafsirSheetProps> = ({ ayah, onClose }) => {
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
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const surah = ayah ? ALL_SURAHS.find(item => item.number === ayah.surahNumber) : undefined;

  // Persist preferences
  const handleSelectBook = (bookId: number) => {
    setSelectedBookId(bookId);
    try {
      localStorage.setItem(SELECTED_BOOK_KEY, String(bookId));
    } catch { /* Storage unavailable */ }
  };

  const handleAdjustFontSize = (direction: 'increase' | 'decrease') => {
    setFontSizeIndex(prev => {
      const next = direction === 'increase'
        ? Math.min(FONT_SIZES.length - 1, prev + 1)
        : Math.max(0, prev - 1);
      try {
        localStorage.setItem(FONT_SIZE_KEY, String(next));
      } catch { /* Storage unavailable */ }
      return next;
    });
  };

  useEffect(() => {
    if (!ayah) return;
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
  }, [ayah?.surahNumber, ayah?.numberInSurah, selectedBookId, retry]);

  // Keep keyboard focus inside the modal, support Escape, and return focus to the ayah action.
  useEffect(() => {
    if (!ayah) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      previousFocus?.focus();
    };
  }, [ayah?.surahNumber, ayah?.numberInSurah]);

  // Parse segments safely to prevent raw HTML code display
  const segments = useMemo(() => {
    return parseTafsirToSegments(rawText);
  }, [rawText]);

  // Plain text for clipboard sharing
  const handleCopyTafsir = async () => {
    if (!ayah || !rawText) return;
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
      // Fallback
    }
  };

  if (!ayah) return null;

  const currentSizeConfig = FONT_SIZES[fontSizeIndex];

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wird-tafsir-dialog-title"
        onClick={event => event.stopPropagation()}
        className="w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] bg-[#F9F6EE] dark:bg-[#111F36] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#C59B27]/35 dark:border-[#E0A96D]/30 overflow-hidden flex flex-col"
      >
        {/* Header with Title and Quick Controls */}
        <div className="flex flex-col border-b border-[#1C4E46]/12 dark:border-[#E0A96D]/18 bg-[#F2EDE2]/85 dark:bg-[#0B132B]/90 shrink-0 px-5 py-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#1C4E46] dark:bg-[#1E4A47] text-[#E0A96D] flex items-center justify-center shadow-xs shrink-0 border border-[#C59B27]/40 dark:border-[#E0A96D]/35">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="wird-tafsir-dialog-title" className="font-bold text-[#142421] dark:text-[#F5F1E8] text-base md:text-lg font-quran">
                    {currentBookName}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1C4E46]/10 dark:bg-[#1E4A47]/60 text-[#1C4E46] dark:text-[#E0A96D] font-semibold border border-[#1C4E46]/20 dark:border-[#E0A96D]/25">
                    Quran.com API v4
                  </span>
                </div>
                <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] truncate">
                  سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah} {currentAuthor ? `· ${currentAuthor}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopyTafsir}
                disabled={isLoading || !rawText}
                aria-label="نسخ الآية والتفسير"
                title="نسخ الآية والتفسير للمشاركة"
                className={`min-h-11 min-w-11 p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 ${
                  copied
                    ? 'bg-[#1C4E46]/12 border-[#1C4E46] text-[#1C4E46] dark:bg-[#1E4A47]/55 dark:border-[#E0A96D] dark:text-[#E0A96D]'
                    : 'bg-white dark:bg-[#162744] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
                } disabled:opacity-40`}
              >
                {copied ? <Check className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" /> : <Copy className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B]" />}
                <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                ref={closeButtonRef}
                aria-label="إغلاق التفسير"
                className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-white/80 dark:hover:bg-[#162744] text-[#5B6F6B] hover:text-[#142421] dark:hover:text-[#F5F1E8] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Edition Selector & Font Scaler Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-xs">
            {/* Tafsir Book Editions Dropdown */}
            <label className="flex items-center gap-2 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
              <span className="text-[11px] font-semibold shrink-0">كتاب التفسير</span>
              <select
                aria-label="اختيار كتاب التفسير"
                value={selectedBookId}
                onChange={event => handleSelectBook(Number(event.target.value))}
                className="min-h-11 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#162744] px-3 py-1.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              >
                {TAFSIR_EDITIONS.map(edition => (
                  <option key={edition.id} value={edition.id}>
                    {edition.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Font Size Adjuster */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#162744] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => handleAdjustFontSize('decrease')}
                disabled={fontSizeIndex === 0}
                aria-label="تصغير خط التفسير"
                title="تصغير خط التفسير"
                className="min-h-11 min-w-11 p-1 hover:bg-[#F2EDE2] dark:hover:bg-[#0B132B] text-[#5B6F6B] dark:text-[#8B9E9B] rounded-lg disabled:opacity-30"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] font-mono font-medium text-[#5B6F6B] dark:text-[#8B9E9B]">
                {currentSizeConfig.label}
              </span>
              <button
                type="button"
                onClick={() => handleAdjustFontSize('increase')}
                disabled={fontSizeIndex === FONT_SIZES.length - 1}
                aria-label="تكبير خط التفسير"
                title="تكبير خط التفسير"
                className="min-h-11 min-w-11 p-1 hover:bg-[#F2EDE2] dark:hover:bg-[#0B132B] text-[#5B6F6B] dark:text-[#8B9E9B] rounded-lg disabled:opacity-30"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto overscroll-contain p-5 md:p-6 space-y-5">
          {/* Authentic Quranic Ayah Presentation Card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#FFFFFF] to-[#F2EDE2] dark:from-[#0B132B]/90 dark:to-[#162744]/85 border border-[#C59B27]/40 dark:border-[#E0A96D]/30 p-5 md:p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-2 left-3 opacity-10 text-[#C59B27] dark:text-[#E0A96D] pointer-events-none">
              <Sparkles className="w-20 h-20" />
            </div>

            <div className="flex items-center justify-between gap-2 mb-3 text-xs text-[#9A7415] dark:text-[#E0A96D] font-semibold border-b border-[#C59B27]/25 dark:border-[#E0A96D]/20 pb-2">
              <span>نص الآية الكريمة</span>
              <span className="font-sans-ui bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 px-2.5 py-0.5 rounded-full text-[11px]">
                سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}
              </span>
            </div>

            <p className="font-quran text-2xl md:text-3xl leading-[2.3] text-right text-[#142421] dark:text-[#F5F1E8]">
              <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>{' '}
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-[#C59B27] dark:border-[#E0A96D] text-[#9A7415] dark:text-[#E0A96D] bg-[#F9F6EE] dark:bg-[#0B132B] font-sans text-xs align-middle font-bold mx-1 tabular-nums">
                {ayah.numberInSurah}
              </span>
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#1C4E46] dark:text-[#E0A96D]">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm font-semibold">جارٍ تحميل التفسير المعتمد من المصدر الرسمي...</p>
            </div>
          )}

          {/* Error State with Graceful Retry */}
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

          {/* Clean Rendered Tafsir Segments (Zero Raw HTML or Code Display) */}
          {!isLoading && !error && segments.length > 0 && (
            <article
              className={`p-1 space-y-3 text-[#142421] dark:text-[#F5F1E8] ${currentSizeConfig.sizeClass} text-justify font-sans-ui`}
            >
              <div className="flex items-center gap-2 pb-2 text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] border-b border-[#1C4E46]/12 dark:border-[#E0A96D]/18">
                <Sparkles className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
                <span>بيان المعنى والشرح:</span>
              </div>

              <div className="space-y-4">
                {renderSegmentBlocks(segments)}
              </div>
            </article>
          )}

          {/* Empty Fallback */}
          {!isLoading && !error && segments.length === 0 && (
            <div className="py-12 text-center text-[#5B6F6B] dark:text-[#8B9E9B] text-xs">
              لا يتوفر نص تفسير متاح لهذه الآية في الطبعة المحددة حالياً.
            </div>
          )}

          <RelatedHadithPanel ayah={ayah} />

          {/* Footer Metadata & Status */}
          <div className="pt-4 border-t border-[#1C4E46]/12 dark:border-[#E0A96D]/18 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1C4E46] dark:bg-[#E0A96D]" />
              <span>{isCached ? 'محفوظ محلياً للرجوع إليه دون إنترنت' : 'تم الجلب مباشرة من Quran.com API v4'}</span>
            </div>
            <a
              href="https://quran.com/ar/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#1C4E46] dark:text-[#E0A96D] hover:underline"
            >
              <span>منصة مطوري Quran.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

/**
 * Helper to group segments into clean readable paragraphs with styled Quranic quotes
 */
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
              className="font-quran text-[#9A7415] dark:text-[#E0A96D] font-bold bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 px-1.5 py-0.5 rounded-md inline-block mx-1 shadow-2xs border border-[#C59B27]/35 dark:border-[#E0A96D]/30"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'highlight') {
          return (
            <span
              key={seg.id}
              className="font-bold text-[#1C4E46] dark:text-[#6EE7B7] bg-[#1C4E46]/10 dark:bg-[#1E4A47]/45 px-1 py-0.5 rounded inline-block mx-0.5"
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
