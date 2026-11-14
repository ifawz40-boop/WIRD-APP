import React, { useEffect, useState } from 'react';
import { BookOpenCheck, CalendarDays, Pause, Play, RotateCcw, Target } from 'lucide-react';
import {
  getReadingKhatmaProgress,
  type ReadingKhatma,
  type ReadingKhatmaPlanOptions
} from '../../services/readingKhatmaService';

interface Props {
  khatma: ReadingKhatma | null;
  onStart: (plan: ReadingKhatmaPlanOptions) => void;
  onReset: () => void;
  onContinue: (page: number) => void;
  onPause: () => void;
  onResume: () => void;
  onUpdatePlan: (plan: ReadingKhatmaPlanOptions) => void;
  error?: string;
}

function formatDate(date: string): string {
  const value = new Date(date + 'T00:00:00');
  return Number.isFinite(value.getTime())
    ? value.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : date;
}

export const ReadingKhatmaPanel: React.FC<Props> = ({
  khatma,
  onStart,
  onReset,
  onContinue,
  onPause,
  onResume,
  onUpdatePlan,
  error
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [durationDays, setDurationDays] = useState(khatma?.plan?.durationDays || 30);
  const [sessionsPerDay, setSessionsPerDay] = useState(khatma?.plan?.sessionsPerDay || 2);
  const isActive = Boolean(khatma && !khatma.completedAt);
  const progress = khatma ? getReadingKhatmaProgress(khatma) : null;

  useEffect(() => {
    if (!khatma?.plan) return;
    setDurationDays(khatma.plan.durationDays);
    setSessionsPerDay(khatma.plan.sessionsPerDay);
  }, [khatma?.plan?.durationDays, khatma?.plan?.sessionsPerDay]);

  const planOptions: ReadingKhatmaPlanOptions = { durationDays, sessionsPerDay };
  const history = khatma ? [
    ...khatma.completedCycles,
    ...(khatma.completedAt ? [{
      id: khatma.id,
      startedAt: khatma.startedAt,
      completedAt: khatma.completedAt,
      durationDays: khatma.plan?.durationDays,
      pagesRead: khatma.completedPages.length
    }] : [])
  ].sort((a, b) => b.completedAt.localeCompare(a.completedAt)) : [];
  const historyCount = history.length;
  const sessionTargets = progress
    ? Array.from({ length: progress.sessionsPerDay }, (_, index) =>
        Math.max(0, Math.min(progress.pagesPerSession, progress.pagesPerDay - index * progress.pagesPerSession)))
    : [];


  return (
    <section aria-labelledby="reading-khatma-title" className="wird-card p-5 border-[#C59B27]/30 dark:border-[#E0A96D]/25">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="reading-khatma-title" className="flex items-center gap-2 font-bold text-[#1C4E46] dark:text-[#E0A96D]">
            <BookOpenCheck className="h-5 w-5" /> ختمة القراءة
          </h2>
          <p className="mt-1 text-xs leading-6 text-[#5B6F6B] dark:text-[#8B9E9B]">
            خطة مرنة لقراءة القرآن، موزعة على أيام وجلسات، مع حفظ تقدمك الفعلي وإعادة حساب الورد عند التأخر.
          </p>
        </div>
        {historyCount > 0 && (
          <span className="rounded-xl bg-[#F2EDE2] dark:bg-[#162744] px-3 py-1 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] border border-[#C59B27]/30 tabular-nums">
            الختمات المكتملة: {historyCount}
          </span>
        )}
      </div>

      {(!khatma || khatma.completedAt) && (
        <div className="mt-4 space-y-4 rounded-xl border border-[#1C4E46]/12 bg-[#F9F6EE] p-4 dark:border-[#E0A96D]/18 dark:bg-[#0B132B]/70">
          <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">
            {khatma?.completedAt ? 'ما شاء الله، اكتملت الختمة السابقة.' : 'ابدأ ختمة قراءة جديدة'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#C59B27] dark:text-[#E0A96D]" /> مدة الختمة</span>
              <select
                aria-label="مدة ختمة القراءة"
                value={durationDays}
                onChange={event => setDurationDays(Number(event.target.value))}
                className="min-h-11 w-full rounded-lg border border-[#1C4E46]/15 bg-white px-3 text-xs dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
              >
                <option value={30}>30 يوماً</option>
                <option value={45}>45 يوماً</option>
                <option value={60}>60 يوماً</option>
                <option value={90}>90 يوماً</option>
                <option value={120}>120 يوماً</option>
              </select>
            </label>
            <label className="block space-y-2 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-[#C59B27] dark:text-[#E0A96D]" /> جلسات القراءة يومياً</span>
              <select
                aria-label="عدد جلسات القراءة اليومية"
                value={sessionsPerDay}
                onChange={event => setSessionsPerDay(Number(event.target.value))}
                className="min-h-11 w-full rounded-lg border border-[#1C4E46]/15 bg-white px-3 text-xs dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
              >
                <option value={1}>جلسة واحدة</option>
                <option value={2}>جلستان</option>
                <option value={3}>3 جلسات</option>
                <option value={4}>4 جلسات</option>
                <option value={5}>5 جلسات</option>
                <option value={6}>6 جلسات</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => onStart(planOptions)}
            className="min-h-11 w-full rounded-xl wird-btn-primary px-4 py-2 text-sm font-bold"
          >
            {khatma ? 'بدء ختمة جديدة' : 'ابدأ ختمة القراءة'}
          </button>
        </div>
      )}

      {khatma && progress && isActive && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span className="tabular-nums">أنجزت {progress.completedPages} من 604 صفحة</span>
              <span className="tabular-nums font-mono">{progress.percent}٪</span>
            </div>
            <progress aria-label="تقدم ختمة القراءة" value={progress.completedPages} max={604} className="h-2 w-full accent-[#1C4E46] dark:accent-[#E0A96D]" />
            <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
              <span>المتبقي: {progress.remainingPages} صفحة</span>
              <span>الصفحة التالية: {progress.nextPage}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[#F9F6EE] p-3 dark:bg-[#0B132B]/70 border border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">الورد اليومي</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#1C4E46] dark:text-[#E0A96D]">{progress.pagesPerDay} صفحة</p>
            </div>
            <div className="rounded-xl bg-[#F9F6EE] p-3 dark:bg-[#0B132B]/70 border border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">لكل جلسة</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#1C4E46] dark:text-[#E0A96D]">{progress.pagesPerSession} صفحة</p>
            </div>
            <div className="rounded-xl bg-[#F9F6EE] p-3 dark:bg-[#0B132B]/70 border border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">قرأت اليوم</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#1C4E46] dark:text-[#E0A96D]">{progress.pagesReadToday} صفحة</p>
            </div>
            <div className="rounded-xl bg-[#F9F6EE] p-3 dark:bg-[#0B132B]/70 border border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">الأيام المتبقية</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#C59B27] dark:text-[#E0A96D]">{progress.daysRemaining} يوم</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#C59B27]/25 bg-[#F9F6EE] p-3 text-xs leading-6 dark:border-[#E0A96D]/20 dark:bg-[#0B132B]/60">
            <p className="font-semibold text-[#142421] dark:text-[#F5F1E8]">موعد الإتمام المستهدف: {formatDate(progress.targetCompletionDate)}</p>
            <p className="text-[#5B6F6B] dark:text-[#8B9E9B]">
              قسّم وردك إلى {progress.sessionsPerDay} جلسات يومية. المتبقي من ورد اليوم: {Math.max(0, progress.pagesPerDay - progress.pagesReadToday)} صفحة.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sessionTargets.map((pages, index) => (
                <span key={index} className="rounded-lg bg-[#1C4E46]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1C4E46] dark:bg-[#1E4A47]/60 dark:text-[#F5F1E8] tabular-nums">
                  الجلسة {index + 1}: {pages} صفحة
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span>تعديل مدة الختمة</span>
              <select
                aria-label="تعديل مدة الختمة"
                value={durationDays}
                onChange={event => setDurationDays(Number(event.target.value))}
                className="min-h-11 w-full rounded-lg border border-[#1C4E46]/15 bg-white px-3 text-sm dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
              >
                <option value={30}>30 يوماً</option>
                <option value={45}>45 يوماً</option>
                <option value={60}>60 يوماً</option>
                <option value={90}>90 يوماً</option>
                <option value={120}>120 يوماً</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span>تعديل عدد الجلسات</span>
              <select
                aria-label="تعديل عدد الجلسات"
                value={sessionsPerDay}
                onChange={event => setSessionsPerDay(Number(event.target.value))}
                className="min-h-11 w-full rounded-lg border border-[#1C4E46]/15 bg-white px-3 text-sm dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
              >
                <option value={1}>جلسة واحدة</option>
                <option value={2}>جلستان</option>
                <option value={3}>3 جلسات</option>
                <option value={4}>4 جلسات</option>
                <option value={5}>5 جلسات</option>
                <option value={6}>6 جلسات</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={progress.isPaused}
              onClick={() => onContinue(progress.nextPage)}
              className="min-h-11 rounded-xl wird-btn-primary px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              متابعة من صفحة {progress.nextPage}
            </button>
            <button
              type="button"
              onClick={progress.isPaused ? onResume : onPause}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1C4E46]/20 px-3 py-2 text-xs font-semibold text-[#142421] dark:border-[#E0A96D]/25 dark:text-[#F5F1E8]"
            >
              {progress.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {progress.isPaused ? 'استئناف الختمة' : 'إيقاف مؤقت'}
            </button>
            <button
              type="button"
              onClick={() => onUpdatePlan(planOptions)}
              className="min-h-11 rounded-xl border border-[#C59B27]/50 px-3 py-2 text-xs font-semibold text-[#1C4E46] dark:border-[#E0A96D]/40 dark:text-[#E0A96D]"
            >
              تحديث الخطة
            </button>
            {confirmReset ? (
              <>
                <span role="status" className="max-w-xs text-xs text-rose-700 dark:text-rose-300">سيُحذف تقدم الختمة الحالية وسجل الختمات السابقة. هل تريد المتابعة؟</span>
                <button type="button" onClick={() => { onReset(); setConfirmReset(false); }} className="min-h-11 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white">تأكيد المسح</button>
                <button type="button" onClick={() => setConfirmReset(false)} className="min-h-11 rounded-lg border px-3 text-xs">إلغاء</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} aria-label="إعادة ضبط ختمة القراءة" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1C4E46]/15 px-3 text-xs font-semibold text-[#142421] dark:border-[#E0A96D]/20 dark:text-[#F5F1E8]">
                <RotateCcw className="h-4 w-4" /> بدء من جديد
              </button>
            )}
          </div>
        </div>
      )}

      {khatma?.completedAt && (
        <div className="mt-4 rounded-xl border border-[#C59B27]/40 bg-[#F9F6EE] p-4 text-sm font-semibold text-[#1C4E46] dark:border-[#E0A96D]/30 dark:bg-[#0B132B]/70 dark:text-[#E0A96D]">
          اكتملت الختمة الحالية، تقبل الله منك. يمكنك بدء ختمة جديدة مع الاحتفاظ بسجل الختمات السابقة.
        </div>
      )}

      {history.length > 0 && (
        <section aria-label="سجل الختمات المكتملة" className="mt-4 rounded-xl border border-[#1C4E46]/12 bg-[#F9F6EE] p-3 dark:border-[#E0A96D]/15 dark:bg-[#0B132B]/60">
          <h3 className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">سجل الختمات المكتملة</h3>
          <ul className="mt-2 space-y-2">
            {history.slice(0, 5).map(cycle => (
              <li key={cycle.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                <span>بدأت {formatDate(cycle.startedAt.slice(0, 10))} · اكتملت {formatDate(cycle.completedAt.slice(0, 10))}</span>
                <span className="font-semibold tabular-nums">{cycle.pagesRead ?? 604} صفحة</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    </section>
  );
};
