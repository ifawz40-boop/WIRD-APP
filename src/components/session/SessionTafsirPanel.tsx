import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getTafsir, TAFSIR_EDITIONS } from '../../services/tafsirService';
import { parseTafsirToSegments } from '../../utils/tafsirSanitizer';
import { RelatedHadithPanel } from '../shared/RelatedHadithPanel';

const SELECTED_BOOK_KEY = 'wird_tafsir_selected_book_v1';
const EXPANDED_KEY = 'wird_session_tafsir_expanded_v1';
export const SessionTafsirPanel: React.FC<{ ayah: Ayah }> = ({ ayah }) => {
  const [isExpanded, setIsExpanded] = useState(() => { try { return localStorage.getItem(EXPANDED_KEY) === '1'; } catch { return false; } });
  const [bookId, setBookId] = useState(() => {
    try { const stored = Number(localStorage.getItem(SELECTED_BOOK_KEY)); return TAFSIR_EDITIONS.some(book => book.id === stored) ? stored : 16; }
    catch { return 16; }
  });
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!isExpanded) { setLoading(false); return; }
    const controller = new AbortController();
    setText(''); setLoading(true); setError(false);
    getTafsir(ayah.surahNumber, ayah.numberInSurah, bookId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setText(result.text); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ayah.surahNumber, ayah.numberInSurah, bookId, retry, isExpanded]);
  const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
  const selectedBook = TAFSIR_EDITIONS.find(book => book.id === bookId);
  const toggleExpanded = () => {
    setIsExpanded(current => {
      const next = !current;
      try { localStorage.setItem(EXPANDED_KEY, next ? '1' : '0'); } catch { /* keep the in-memory preference */ }
      return next;
    });
  };

  return (
    <section aria-labelledby="session-tafsir-title" className={`wird-card rounded-[var(--wird-radius-card)] border transition-colors ${isExpanded ? 'border-[var(--wird-border-gold)]' : ''}`}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls="session-tafsir-content"
        className="w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 text-right rounded-[var(--wird-radius-card)] hover:bg-[var(--wird-surface-muted)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wird-ring)] transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent)] border border-[var(--wird-border-gold)] flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span id="session-tafsir-title" className="block text-sm font-bold text-[var(--wird-text)]">تفسير الآية</span>
            <span className="block text-xs text-[var(--wird-muted)]">{isExpanded ? 'اضغط لإخفاء التفسير وتوسيع مساحة القراءة' : 'افتح التفسير عند الحاجة — مخفي لتبقى مساحة الحفظ مريحة'}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
          {isExpanded ? 'إخفاء' : 'عرض التفسير'}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isExpanded && (
        <div id="session-tafsir-content" className="border-t border-[var(--wird-border)] px-4 pb-4 pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[var(--wird-muted)]">سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}</p>
              {selectedBook?.author && (
                <p className="text-[11px] text-[var(--wird-muted)]">{selectedBook.author}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--wird-muted)]">
              <span className="font-semibold">مصدر التفسير</span>
              <select
                aria-label="مصدر التفسير في الجلسة"
                className="min-h-11 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs font-semibold text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-ring)]"
                value={bookId}
                onChange={event => {
                  const value = Number(event.target.value);
                  setBookId(value);
                  try { localStorage.setItem(SELECTED_BOOK_KEY, String(value)); } catch { /* preference remains in memory */ }
                }}
              >
                {TAFSIR_EDITIONS.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
              </select>
            </label>
          </div>
          {loading ? <p role="status" className="flex items-center gap-2 text-sm text-[var(--wird-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل التفسير…</p>
            : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-rose-700 dark:text-rose-300"><span>تعذر تحميل التفسير الآن.</span><button type="button" onClick={() => setRetry(value => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] px-3 hover:bg-[var(--wird-surface-muted)]"><RefreshCw className="h-4 w-4" /> إعادة المحاولة</button></div>
              : <div className="space-y-2 text-sm leading-8 text-[var(--wird-text)]">{parseTafsirToSegments(text).map(segment => <span key={segment.id}>{segment.text}</span>)}</div>}
          <p className="border-t border-[var(--wird-border)] pt-3 text-[11px] leading-6 text-[var(--wird-muted)]">التفسير من كتب معتمدة عبر المصدر المحدد؛ يُعرض للتدبر ولا يستبدل الرجوع لأهل العلم.</p>
          <RelatedHadithPanel ayah={ayah} />
        </div>
      )}
    </section>
  );
};
