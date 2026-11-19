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

const RUQYAH_INDEX_REQUEST_TIMEOUT_MS = 10_000;

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
    let active = true;
    let timedOut = false;
    let timeoutId: number | null = null;
    const cached = readRuqyahApiIndexCache(program);
    setLoading(true);
    setError(null);
    setEntries(cached?.entries || []);
    setIsShowingCachedData(Boolean(cached));
    setCacheSavedAt(cached?.savedAt || null);

    const request = fetchRuqyahApiData<RuqyahApiEntry[] | RuqyahApiEntry>({
      type: 'instant',
      program,
      source: 'from-quran'
    }, controller.signal).then(data => {
      if (!active) return;
      if (!Array.isArray(data) && (!data || typeof data !== 'object')) {
        throw new Error('استجابة فهرس الآيات غير صالحة؛ لم يتم عرض أي محتوى منه.');
      }
      const normalized = Array.isArray(data) ? data : [data as RuqyahApiEntry];
      if (normalized.length > 300 || normalized.some(entry => {
        try {
          resolveApiQuranEntry(entry);
          return false;
        } catch {
          return true;
        }
      })) {
        throw new Error('أعاد فهرس الآيات مواضع غير صالحة؛ لم يتم عرض أي محتوى منه.');
      }
      if (normalized.length === 0) {
        setEntries([]);
        setCacheSavedAt(null);
        setIsShowingCachedData(false);
        setError(null);
        return;
      }
      const saved = writeRuqyahApiIndexCache(program, normalized);
      setEntries(normalized);
      setCacheSavedAt(saved ? new Date().toISOString() : null);
      setIsShowingCachedData(false);
      setError(null);
    }).catch(reason => {
      if (!active || (controller.signal.aborted && !timedOut)) return;
      throw reason;
    });

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        reject(new Error('انتهت مهلة تحميل فهرس مواضع الآيات. يمكنك استخدام آخر نسخة محفوظة أو إعادة المحاولة.'));
        controller.abort();
      }, RUQYAH_INDEX_REQUEST_TIMEOUT_MS);
    });

    void Promise.race([request, timeout])
      .catch(reason => {
        if (!active) return;
        const detail = reason instanceof Error ? reason.message : 'تعذر تحميل فهرس مواضع الآيات.';
        const safeDetail = /HTTP (?:500|502)\b/.test(detail)
          ? 'خدمة فهرس المواضع تواجه عطلًا مؤقتًا (' + detail + ').'
          : detail;
        if (cached) {
          setEntries(cached.entries);
          setIsShowingCachedData(true);
          setCacheSavedAt(cached.savedAt);
          setError('تعذر تحديث الفهرس الآن؛ نعرض آخر نسخة محفوظة بعد التحقق من مواضعها. ' + safeDetail);
        } else {
          setEntries([]);
          setError(safeDetail);
        }
      })
      .finally(() => {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      controller.abort();
    };
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
          <div className="w-10 h-10 rounded-xl bg-[#1C4E46] dark:bg-[#1E4A47] text-[#E0A96D] flex items-center justify-center shrink-0 border border-[#C59B27]/35">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8]">فهرس مواضع الآيات</h2>
            <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">
              نستفيد من الفهرس الخارجي لتحديد أرقام السور والآيات فقط. لا نعرض عناوينه أو ترجماته أو شروحه أو نصوصه؛ جميع الآيات تُستخرج من مصحف وِرد المعتمد. تقسيمات الفهرس تنظيمية وليست ترتيبًا نبويًا أو عددًا لازمًا.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-[#142421] dark:text-[#F5F1E8] mb-1.5">تقسيم الفهرس</span>
            <select aria-label="تقسيم فهرس مواضع الآيات" value={program} onChange={event => { setProgram(event.target.value as ProgramId); setSearchQuery(''); }}
              className="w-full min-h-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 py-2.5 text-sm text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
              {PROGRAMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <div className="w-full min-h-11 flex items-center rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/18 bg-[#F9F6EE] dark:bg-[#0B132B]/70 px-3 py-2.5 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
              فهرس مواضع فقط · نص الآيات من مصحف وِرد
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <label className="block min-w-0">
            <span className="block text-xs font-bold text-[#142421] dark:text-[#F5F1E8] mb-1.5">البحث باسم السورة أو رقمها أو الآية</span>
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="مثال: البقرة أو ٢:٢٥٥"
              aria-label="البحث في فهرس مواضع الآيات"
              className="w-full min-w-0 min-h-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 py-2.5 text-sm text-[#142421] dark:text-[#F5F1E8] placeholder:text-[#5B6F6B]/60 dark:placeholder:text-[#8B9E9B]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
            />
          </label>
          <div className="space-y-1">
            <div className="rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 bg-[#F9F6EE] dark:bg-[#0B132B]/70 px-3 py-2.5 text-xs font-medium text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums" role="status" aria-live="polite">
              {loading ? 'جارٍ تحديث الفهرس' : filteredEntries.length + ' من ' + entries.length + ' موضع'}
            </div>
            {isShowingCachedData && cacheSavedAt && (
              <p className="text-[10px] font-medium text-[#9A7512] dark:text-[#E0A96D]">
                نسخة محفوظة · آخر تحديث {new Date(cacheSavedAt).toLocaleDateString('ar-EG')}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-2xl border border-[#C59B27]/50 dark:border-[#E0A96D]/40 bg-[#C59B27]/10 dark:bg-[#E0A96D]/10 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#9A7512] dark:text-[#E0A96D] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">تعذر تحميل فهرس الآيات</p>
              <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#CBD5E1] mt-1">{error}</p>
              {isMissingApiKey && (
                <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B] mt-2">
                  يلزم ضبط ISLAMICAPI_API_KEY كمتغير سري في إعدادات Vercel ثم إعادة النشر. لا تضع المفتاح في ملفات الواجهة أو داخل GitHub.
                </p>
              )}
              {isRejectedApiKey && (
                <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B] mt-2">
                  المفتاح موجود لكنه مرفوض من المزود؛ راجع قيمته في Vercel وتأكد من نسخه كاملاً دون مسافات.
                </p>
              )}
              <button type="button" onClick={retry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C59B27] hover:bg-[#b1891f] dark:bg-[#E0A96D] dark:hover:bg-[#f1b87d] px-4 py-2 text-xs font-bold text-[#0B132B] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div role="status" aria-live="polite" className="wird-card flex items-center justify-center gap-2.5 rounded-2xl p-8 text-sm font-medium text-[#5B6F6B] dark:text-[#8B9E9B]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1C4E46] dark:text-[#E0A96D]" /> جارٍ تحميل فهرس مواضع الآيات...
        </div>
      ) : entries.length === 0 && !error ? (
        <div className="wird-card rounded-2xl p-6 text-center text-sm text-[#5B6F6B] dark:text-[#8B9E9B]">
          لا توجد مواضع قرآنية في هذا القسم من الفهرس.
        </div>
      ) : entries.length > 0 && filteredEntries.length === 0 ? (
        <div role="status" className="wird-card rounded-2xl p-6 text-center text-sm text-[#5B6F6B] dark:text-[#8B9E9B]">
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
                className="wird-card rounded-2xl p-4 md:p-5 space-y-3 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">
                      {resolved ? 'سورة ' + resolved.surahName : 'موضع قرآني غير صالح'}
                    </h3>
                    {resolved && (
                      <p className="text-xs font-semibold text-[#1C4E46] dark:text-[#E0A96D] mt-1 tabular-nums">
                        الآيات: {resolved.startAyah}{resolved.endAyah !== resolved.startAyah ? '–' + resolved.endAyah : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#F2EDE2] dark:bg-[#162744] border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 px-2.5 py-1 text-[11px] font-bold font-mono tabular-nums text-[#1C4E46] dark:text-[#E0A96D]">
                    {index + 1}
                  </span>
                </div>
                {validationError ? (
                  <p className="text-xs text-[#9A7512] dark:text-[#E0A96D] bg-[#C59B27]/10 dark:bg-[#E0A96D]/10 border border-[#C59B27]/30 rounded-xl p-3">{validationError}</p>
                ) : resolved && (
                  <div className="rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 border border-[#1C4E46]/10 dark:border-[#E0A96D]/15 px-3 py-4">
                    <p className="font-quran text-lg md:text-xl leading-[2.2] text-center text-[#142421] dark:text-[#F5F1E8]"><QuranText surahNumber={resolved.surahNumber} ayahNumber={resolved.startAyah} endAyahNumber={resolved.endAyah}>{resolved.text}</QuranText></p>
                  </div>
                )}
                <div className="pt-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
                  <span className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">النص من مصحف وِرد المعتمد؛ الفهرس الخارجي لا يضيف تفسيرًا أو حكمًا شرعيًا.</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
