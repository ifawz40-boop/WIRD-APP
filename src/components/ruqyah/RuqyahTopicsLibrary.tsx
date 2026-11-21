import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

type TopicCategory = {
  title: string;
  subcategories: Array<{
    subcategory: string;
    'subcategory-slug': string;
    ruqyah: Array<{ id: number | string; title: string }>;
  }>;
};
type TopicArticle = {
  sub_id: number | string;
  title: string;
  section_title?: string;
  category: string;
  content: Array<{ type: 'text' | 'arabic' | 'translation' | 'header' | 'transliteration'; content: string }>;
};

async function request<T>(params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ ...params, lang: 'ar' });
  let response: Response;
  try {
    response = await fetch('/api/ruqyah?' + query.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new Error('تعذر الاتصال بمكتبة موضوعات الرقية. تحقق من الإنترنت ثم أعد المحاولة.');
  }
  const raw = await response.text();
  if (raw.trim().startsWith('<') || !/application\/(?:[a-z0-9.+-]*\+)?json/i.test(response.headers.get('content-type') || '')) {
    throw new Error('استجابة مكتبة الرقية ليست JSON صالحة.');
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new Error('تعذر قراءة بيانات مكتبة الرقية.'); }
  if (!response.ok) {
    const code = payload && typeof payload === 'object' && 'error' in payload ? String((payload as { error: unknown }).error) : '';
    if (code === 'RUQYAH_TOPICS_DISABLED') throw new Error('مكتبة الموضوعات غير مفعّلة على هذا النشر. تأكد من RUQYAH_TOPICS_ENABLED ثم أعد النشر.');
    if (code === 'RUQYAH_API_KEY_NOT_CONFIGURED') throw new Error('مفتاح IslamicAPI غير مضبوط على الخادم.');
    if (code === 'RUQYAH_API_KEY_REJECTED') throw new Error('IslamicAPI رفض مفتاح الخادم.');
    if (code === 'RUQYAH_SOURCE_RATE_LIMITED') throw new Error('وصلنا إلى حد الطلبات المؤقت لدى IslamicAPI. أعد المحاولة لاحقًا.');
    throw new Error('تعذر تحميل محتوى IslamicAPI (HTTP ' + response.status + ').');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload) || (payload as { status?: unknown }).status !== 'success') {
    throw new Error('بنية بيانات مكتبة الرقية غير متوقعة.');
  }
  return (payload as { data: T }).data;
}

const BLOCK_LABELS: Record<TopicArticle['content'][number]['type'], string> = {
  text: 'نص',
  arabic: 'نص عربي',
  translation: 'ترجمة',
  header: 'عنوان',
  transliteration: 'نطق'
};

export const RuqyahTopicsLibrary: React.FC = () => {
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [articles, setArticles] = useState<TopicArticle[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [error, setError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const topicOptions = useMemo(() => categories.flatMap(category => category.subcategories), [categories]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCategories(true);
    setError('');
    request<TopicCategory[]>({ type: 'topic-category' }, controller.signal)
      .then(data => {
        if (!Array.isArray(data) || data.length > 13) throw new Error('قائمة موضوعات الرقية غير صالحة.');
        const options = data.flatMap(item => Array.isArray(item?.subcategories) ? item.subcategories : []);
        if (!options.length) throw new Error('لم تُرجع المكتبة أي تصنيفات.');
        setCategories(data);
        setSelectedTopic(current => options.some(item => item['subcategory-slug'] === current) ? current : options[0]['subcategory-slug']);
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل تصنيفات الرقية.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingCategories(false); });
    return () => controller.abort();
  }, [retryNonce]);

  useEffect(() => {
    if (!selectedTopic) return;
    const controller = new AbortController();
    setLoadingArticles(true);
    setError('');
    setArticles([]);
    request<TopicArticle[]>({ type: 'topic', topic: selectedTopic }, controller.signal)
      .then(data => {
        if (!Array.isArray(data) || data.length > 100) throw new Error('قائمة المقالات غير صالحة.');
        setArticles(data);
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المقالات.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingArticles(false); });
    return () => controller.abort();
  }, [selectedTopic, retryNonce]);

  const selectedLabel = topicOptions.find(item => item['subcategory-slug'] === selectedTopic)?.subcategory || '';

  return (
    <section className="space-y-5" dir="rtl" aria-label="موضوعات الرقية من IslamicAPI">
      <div className="wird-card rounded-3xl p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1C4E46] dark:bg-[#1E4A47] text-[#E0A96D] flex items-center justify-center shrink-0 border border-[#C59B27]/35">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8]">مكتبة موضوعات الرقية</h2>
            <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">
              مقالات تعليمية وتصنيفات من IslamicAPI. المحتوى من المصدر كما ورد، ويُعرض للتثقيف والاطلاع وليس فتوى أو تشخيصًا طبيًا.
            </p>
          </div>
        </div>
        <label className="block">
          <span className="block text-xs font-bold text-[#142421] dark:text-[#F5F1E8] mb-1.5">اختر الموضوع</span>
          <select aria-label="اختيار موضوع الرقية" value={selectedTopic} disabled={loadingCategories || topicOptions.length === 0}
            onChange={event => setSelectedTopic(event.target.value)}
            className="w-full min-h-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 py-2.5 text-sm text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
            {topicOptions.map(item => <option key={item['subcategory-slug']} value={item['subcategory-slug']}>{item.subcategory}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>المصدر: IslamicAPI · اللغة العربية · {selectedLabel || 'تحميل التصنيفات'}</span>
        </div>
      </div>

      {(loadingCategories || loadingArticles) && (
        <div role="status" aria-live="polite" className="wird-card flex items-center justify-center gap-2.5 rounded-2xl p-8 text-sm font-medium text-[#5B6F6B] dark:text-[#8B9E9B]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1C4E46] dark:text-[#E0A96D]" /> جارٍ تحميل الموضوعات...
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-[#C59B27]/50 dark:border-[#E0A96D]/40 bg-[#C59B27]/10 dark:bg-[#E0A96D]/10 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#9A7512] dark:text-[#E0A96D] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">تعذر تحميل مكتبة الموضوعات</p>
              <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#CBD5E1] mt-1">{error}</p>
              <button type="button" onClick={() => setRetryNonce(value => value + 1)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C59B27] px-4 py-2 text-xs font-bold text-[#0B132B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      )}

      {!loadingArticles && !error && articles.length === 0 && selectedTopic && (
        <div className="wird-card rounded-2xl p-6 text-center text-sm text-[#5B6F6B] dark:text-[#8B9E9B]">لا توجد مقالات في هذا الموضوع حاليًا.</div>
      )}

      {articles.map((article, index) => (
        <article key={String(article.sub_id) + '-' + index} className="wird-card rounded-2xl p-4 md:p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#9A7512] dark:text-[#E0A96D]">{article.category}</p>
            <h3 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8]">{article.title}</h3>
            {article.section_title && <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">{article.section_title}</p>}
          </div>
          <div className="space-y-3">
            {article.content.map((block, blockIndex) => (
              <div key={blockIndex} className={
                block.type === 'header' ? 'pt-2 text-sm font-bold text-[#1C4E46] dark:text-[#E0A96D]' :
                block.type === 'arabic' ? 'rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 p-4 text-center font-quran text-xl leading-[2.2] text-[#142421] dark:text-[#F5F1E8]' :
                block.type === 'translation' ? 'border-r-2 border-[#C59B27] pr-3 text-sm leading-8 text-[#5B6F6B] dark:text-[#CBD5E1]' :
                block.type === 'transliteration' ? 'text-sm italic leading-7 text-[#5B6F6B] dark:text-[#CBD5E1]' :
                'text-sm leading-8 text-[#142421] dark:text-[#F5F1E8]'
              } dir={block.type === 'arabic' ? 'rtl' : undefined}>
                {block.type !== 'text' && block.type !== 'arabic' && block.type !== 'translation' && block.type !== 'header' && <span className="sr-only">{BLOCK_LABELS[block.type]}: </span>}
                {block.content}
              </div>
            ))}
          </div>
          <p className="border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 pt-3 text-[10px] leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B]">
            المصدر: IslamicAPI · يُرجى الرجوع إلى أهل العلم في المسائل الشرعية، وعدم تأخير الرعاية الطبية اللازمة.
          </p>
        </article>
      ))}
    </section>
  );
};
