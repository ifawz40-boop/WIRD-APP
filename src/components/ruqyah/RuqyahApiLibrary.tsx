import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  fetchRuqyahApiData,
  readRuqyahApiIndexCache,
  resolveApiQuranEntry,
  matchesApiQuranEntry,
  writeRuqyahApiIndexCache
} from '../../services/ruqyahApiService';
import type { RuqyahApiEntry } from '../../services/ruqyahApiService';
import { QuranText } from '../shared/QuranText';

type ProgramId = 'brief-ruqya' | 'a-medium-ruqya' | 'a-long-ruqya';

const PROGRAMS: Array<{ id: ProgramId; label: string }> = [
  { id: 'brief-ruqya', label: 'فهرس مختصر' },
  { id: 'a-medium-ruqya', label: 'فهرس متوسط' },
  { id: 'a-long-ruqya', label: 'فهرس موسع' }
];

export const RuqyahApiLibrary: React.FC = () => {
  const [program, setProgram] = useState<ProgramId>('brief-ruqya');
  const [entries, setEntries] = useState<RuqyahApiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isShowingCachedData, setIsShowingCachedData] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readRuqyahApiIndexCache(program);
    setLoading(true);
    setError(null);
    setEntries(cached?.entries || []);
    setIsShowingCachedData(Boolean(cached));
    setCacheSavedAt(cached?.savedAt || null);

    fetchRuqyahApiData<RuqyahApiEntry[]>({
      type: 'instant',
      program,
      source: 'from-quran'
    }, controller.signal)
      .then(data => {
        if (!Array.isArray(data) && (!data || typeof data !== 'object')) {
          throw new Error('استجابة فهرس الآيات غير صالحة؛ لم يتم عرض أي محتوى منه.');
        }
        const normalized = Array.isArray(data) ? data : [data as unknown as RuqyahApiEntry];
        if (normalized.length > 300 || normalized.some(entry =>
          !entry ||
          (typeof entry.id !== 'number' && typeof entry.id !== 'string') ||
          typeof entry.title !== 'string' ||
          !/^[0-9]{1,3}:[0-9]{1,3}(?:-[0-9]{1,3})?$/.test(entry.title)
        )) {
          throw new Error('أعاد فهرس الآيات مواضع غير صالحة؛ لم يتم عرض أي محتوى منه.');
        }
        writeRuqyahApiIndexCache(program, normalized);
        setEntries(normalized);
        setCacheSavedAt(new Date().toISOString());
        setIsShowingCachedData(false);
        setError(null);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          const detail = reason instanceof Error ? reason.message : 'تعذر تحميل فهرس مواضع الآيات.';
          if (cached) {
            setEntries(cached.entries);
            setIsShowingCachedData(true);
            setCacheSavedAt(cached.savedAt);
            setError('تعذر تحديث الفهرس الآن؛ نعرض آخر نسخة محفوظة بعد التحقق من مواضعها. ' + detail);
          } else {
            setError(detail);
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [program, retryNonce]);

  const filteredEntries = entries.filter(entry => matchesApiQuranEntry(entry, searchQuery));
  const isMissingApiKey = Boolean(error?.includes('يحتاج إلى ضبط مفتاح API'));
  const isRejectedApiKey = Boolean(error?.includes('رفض مصدر الرقية مفتاح API'));
  const retry = () => {
    setError(null);
    setRetryNonce(value => value + 1);
  };

  return (
    <section className="space-y-5" dir="rtl">
      <div className="wird-card rounded-3xl p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--wird-primary)] text-[#E0A96D] flex items-center justify-center shrink-0 border border-[#C59B27]/35">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--wird-text)]">فهرس مواضع الآيات</h2>
            <p className="text-xs leading-relaxed text-[var(--wird-muted)] mt-1">
              نستفيد من الفهرس الخارجي لتحديد أرقام السور والآيات فقط. لا نعرض عناوينه أو ترجماته أو شروحه أو نصوصه؛ جميع الآيات تُستخرج من مصحف وِرد المعتمد. تقسيمات الفهرس تنظيمية وليست ترتيبًا نبويًا أو عددًا لازمًا.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-[var(--wird-text)] mb-1.5">تقسيم الفهرس</span>
            <select aria-label="تقسيم فهرس مواضع الآيات" value={program} onChange={event => { setProgram(event.target.value as ProgramId); setSearchQuery(''); }}
              className="w-full min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2.5 text-sm text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]">
              {PROGRAMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <div className="w-full min-h-11 flex items-center rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2.5 text-xs text-[var(--wird-muted)]">
              فهرس مواضع فقط · نص الآيات من مصحف وِرد
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <label className="block min-w-0">
            <span className="block text-xs font-bold text-[var(--wird-text)] mb-1.5">البحث باسم السورة أو رقمها أو الآية</span>
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="مثال: البقرة أو ٢:٢٥٥"
              aria-label="البحث في فهرس مواضع الآيات"
              className="w-full min-w-0 min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2.5 text-sm text-[var(--wird-text)] placeholder:text-[var(--wird-muted)]/60 dark:placeholder:text-[#8B9E9B]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
            />
          </label>
          <div className="space-y-1">
            <div className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2.5 text-xs font-medium text-[var(--wird-muted)] tabular-nums" role="status" aria-live="polite">
              {loading ? 'جارٍ تحديث الفهرس' : filteredEntries.length + ' من ' + entries.length + ' موضع'}
            </div>
            {isShowingCachedData && cacheSavedAt && (
              <p className="text-[10px] font-medium text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]">
                نسخة محفوظة · آخر تحديث {new Date(cacheSavedAt).toLocaleDateString('ar-EG')}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--wird-text)]">تعذر تحميل فهرس الآيات</p>
              <p className="text-xs leading-relaxed text-[var(--wird-muted)] mt-1">{error}</p>
              {isMissingApiKey && (
                <p className="text-xs leading-relaxed text-[var(--wird-muted)] mt-2">
                  يلزم ضبط ISLAMICAPI_API_KEY كمتغير سري في إعدادات Vercel ثم إعادة النشر. لا تضع المفتاح في ملفات الواجهة أو داخل GitHub.
                </p>
              )}
              {isRejectedApiKey && (
                <p className="text-xs leading-relaxed text-[var(--wird-muted)] mt-2">
                  المفتاح موجود لكنه مرفوض من المزود؛ راجع قيمته في Vercel وتأكد من نسخه كاملاً دون مسافات.
                </p>
              )}
              <button type="button" onClick={retry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] px-4 py-2 text-xs font-bold text-[var(--wird-accent-ink)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div role="status" aria-live="polite" className="wird-card flex items-center justify-center gap-2.5 rounded-2xl p-8 text-sm font-medium text-[var(--wird-muted)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" /> جارٍ تحميل فهرس مواضع الآيات...
        </div>
      ) : entries.length === 0 && !error ? (
        <div className="wird-card rounded-2xl p-6 text-center text-sm text-[var(--wird-muted)]">
          لا توجد مواضع قرآنية في هذا القسم من الفهرس.
        </div>
      ) : entries.length > 0 && filteredEntries.length === 0 ? (
        <div role="status" className="wird-card rounded-2xl p-6 text-center text-sm text-[var(--wird-muted)]">
          {searchQuery.trim() ? 'لا توجد مواضع مطابقة لعبارة البحث.' : 'لا توجد مواضع قرآنية في هذا القسم من الفهرس.'}
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-3">
          {filteredEntries.map((entry, index) => {
            let resolved: ReturnType<typeof resolveApiQuranEntry> | null = null;
            let validationError: string | null = null;
            try { resolved = resolveApiQuranEntry(entry); }
            catch (reason) {
              validationError = reason instanceof Error ? reason.message : 'تعذر مطابقة موضع الآيات بالمصحف المعتمد.';
            }
            return (
              <article key={String(entry.id) + '-' + index}
                className="wird-card rounded-2xl p-4 md:p-5 space-y-3 border border-[var(--wird-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--wird-text)]">
                      {resolved ? 'سورة ' + resolved.surahName : 'موضع قرآني غير صالح'}
                    </h3>
                    {resolved && (
                      <p className="text-xs font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] mt-1 tabular-nums">
                        الآيات: {resolved.startAyah}{resolved.endAyah !== resolved.startAyah ? '–' + resolved.endAyah : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-lg bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] px-2.5 py-1 text-[11px] font-bold font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                    {index + 1}
                  </span>
                </div>
                {validationError ? (
                  <p className="text-xs text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] bg-[var(--wird-accent-soft)] border border-[#C59B27]/30 rounded-xl p-3">{validationError}</p>
                ) : resolved && (
                  <div className="rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] px-3 py-4">
                    <p className="font-quran text-lg md:text-xl leading-[2.2] text-center text-[var(--wird-text)]"><QuranText surahNumber={resolved.surahNumber} ayahNumber={resolved.startAyah} endAyahNumber={resolved.endAyah}>{resolved.text}</QuranText></p>
                  </div>
                )}
                <div className="pt-2 border-t border-[var(--wird-border)]">
                  <span className="text-[11px] text-[var(--wird-muted)]">النص من مصحف وِرد المعتمد؛ الفهرس الخارجي لا يضيف تفسيرًا أو حكمًا شرعيًا.</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
