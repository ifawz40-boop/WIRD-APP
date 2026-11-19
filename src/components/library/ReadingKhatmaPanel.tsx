import React, { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  X
} from 'lucide-react';
import {
  getReadingKhatmaProgress,
  type CreateReadingKhatmaOptions,
  type ReadingKhatma,
  type ReadingKhatmaCycle,
  type ReadingKhatmaPlanOptions
} from '../../services/readingKhatmaService';

interface Props {
  khatma: ReadingKhatma | null;
  khatmas?: ReadingKhatma[];
  activeKhatmaId?: string | null;
  completedCycles?: ReadingKhatmaCycle[];
  onStart: (plan: ReadingKhatmaPlanOptions) => void;
  onCreateKhatma?: (options: CreateReadingKhatmaOptions) => void;
  onSelectKhatma?: (id: string) => void;
  onReset: () => void;
  onDeleteKhatma?: (id: string) => void;
  onContinue: (page: number) => void;
  onPause: (id?: string) => void;
  onResume: (id?: string) => void;
  onUpdatePlan: (plan: ReadingKhatmaPlanOptions, id?: string, title?: string) => void;
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
  khatmas,
  activeKhatmaId,
  completedCycles,
  onStart,
  onCreateKhatma,
  onSelectKhatma,
  onReset,
  onDeleteKhatma,
  onContinue,
  onPause,
  onResume,
  onUpdatePlan,
  error
}) => {
  const allKhatmas = khatmas && khatmas.length > 0 ? khatmas : khatma ? [khatma] : [];
  const activeList = allKhatmas.filter(item => !item.completedAt);
  const selectedKhatma =
    (activeKhatmaId ? allKhatmas.find(item => item.id === activeKhatmaId) : null) ||
    khatma ||
    activeList[0] ||
    allKhatmas[0] ||
    null;

  const isActive = Boolean(selectedKhatma && !selectedKhatma.completedAt);
  const progress = selectedKhatma ? getReadingKhatmaProgress(selectedKhatma) : null;

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newSessionsPerDay, setNewSessionsPerDay] = useState(2);
  const [newScopeMode, setNewScopeMode] = useState<'full' | 'custom'>('full');
  const [newStartPage, setNewStartPage] = useState(1);
  const [newEndPage, setNewEndPage] = useState(604);

  const [editTitle, setEditTitle] = useState(selectedKhatma?.title || '');
  const [durationDays, setDurationDays] = useState(selectedKhatma?.plan?.durationDays || 30);
  const [sessionsPerDay, setSessionsPerDay] = useState(selectedKhatma?.plan?.sessionsPerDay || 2);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!selectedKhatma) return;
    setEditTitle(selectedKhatma.title || 'ختمة القراءة');
    if (selectedKhatma.plan) {
      setDurationDays(selectedKhatma.plan.durationDays);
      setSessionsPerDay(selectedKhatma.plan.sessionsPerDay);
    }
    setConfirmReset(false);
  }, [selectedKhatma?.id, selectedKhatma?.title, selectedKhatma?.plan?.durationDays, selectedKhatma?.plan?.sessionsPerDay]);

  const rawHistory: ReadingKhatmaCycle[] = completedCycles && completedCycles.length > 0
    ? completedCycles
    : selectedKhatma
    ? [
        ...selectedKhatma.completedCycles,
        ...(selectedKhatma.completedAt
          ? [
              {
                id: selectedKhatma.id,
                title: selectedKhatma.title,
                startedAt: selectedKhatma.startedAt,
                completedAt: selectedKhatma.completedAt,
                durationDays: selectedKhatma.plan?.durationDays,
                pagesRead: selectedKhatma.completedPages.length
              }
            ]
          : [])
      ]
    : [];

  const history = Array.from(new Map(rawHistory.map(c => [c.id, c])).values()).sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt)
  );
  const historyCount = history.length;

  const sessionTargets = progress
    ? Array.from({ length: progress.sessionsPerDay }, (_, index) =>
        Math.max(0, Math.min(progress.pagesPerSession, progress.pagesPerDay - index * progress.pagesPerSession))
      )
    : [];

  const handleCreateSubmit = () => {
    const scopeStart = newScopeMode === 'custom' ? Math.max(1, Math.min(604, newStartPage)) : 1;
    const scopeEnd = newScopeMode === 'custom' ? Math.max(scopeStart, Math.min(604, newEndPage)) : 604;
    if (onCreateKhatma) {
      onCreateKhatma({
        title: newTitle.trim() || undefined,
        durationDays: newDurationDays,
        sessionsPerDay: newSessionsPerDay,
        startPage: scopeStart,
        endPage: scopeEnd
      });
    } else {
      onStart({ durationDays: newDurationDays, sessionsPerDay: newSessionsPerDay });
    }
    setNewTitle('');
    setNewScopeMode('full');
    setIsCreatingNew(false);
  };

  const showCreator = isCreatingNew || !selectedKhatma || Boolean(selectedKhatma.completedAt);
  const creatorPreviewPagesCount =
    newScopeMode === 'custom'
      ? Math.max(1, Math.min(604, newEndPage) - Math.max(1, Math.min(604, newStartPage)) + 1)
      : 604;
  const creatorDailyPreview = Math.ceil(creatorPreviewPagesCount / Math.max(1, newDurationDays));

  return (
    <section
      aria-labelledby="reading-khatma-title"
      className="wird-card p-5 border-[#C59B27]/30 dark:border-[#E0A96D]/25 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2
            id="reading-khatma-title"
            className="flex items-center gap-2 font-bold text-[#1C4E46] dark:text-[#E0A96D]"
          >
            <BookOpenCheck className="h-5 w-5 shrink-0" />
            <span>ختمات القراءة المتعددة</span>
          </h2>
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
            أنشئ أكثر من ختمة مستقلة بالاسم والموضع، وسجّل وردك مباشرة من داخل المصحف المرن أو المطبوع.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {historyCount > 0 && (
            <span className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
              المكتملة: <strong className="text-[#142421] dark:text-[#F5F1E8]">{historyCount}</strong>
            </span>
          )}
          {selectedKhatma && !selectedKhatma.completedAt && (
            <button
              type="button"
              onClick={() => setIsCreatingNew(prev => !prev)}
              aria-expanded={isCreatingNew}
              className={`min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                isCreatingNew
                  ? 'border-[#1C4E46] bg-[#1C4E46] text-white dark:bg-[#1E4A47]'
                  : 'border-[#C59B27]/50 bg-[#F9F6EE] text-[#1C4E46] hover:border-[#C59B27] dark:border-[#E0A96D]/35 dark:bg-[#0B132B] dark:text-[#E0A96D]'
              }`}
            >
              {isCreatingNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isCreatingNew ? 'إغلاق الإنشاء' : 'إنشاء ختمة جديدة'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Khatma Switcher when 1+ Active Khatmas Exist */}
      {activeList.length > 0 && (
        <div
          role="tablist"
          aria-label="الختمات النشطة"
          className="flex flex-wrap items-center gap-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 pt-3"
        >
          {activeList.map(item => {
            const itemProgress = getReadingKhatmaProgress(item);
            const isSelected = selectedKhatma?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectKhatma?.(item.id)}
                className={`min-h-11 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                  isSelected
                    ? 'border-[#C59B27] bg-[#1C4E46] text-white dark:bg-[#1E4A47] shadow-xs'
                    : 'border-[#1C4E46]/15 bg-[#F9F6EE] text-[#142421] hover:border-[#C59B27] dark:border-[#E0A96D]/20 dark:bg-[#0B132B] dark:text-[#F5F1E8]'
                }`}
              >
                <span>{item.title || 'ختمة القراءة'}</span>
                <span className={`font-mono tabular-nums text-[11px] ${isSelected ? 'text-[#E0A96D]' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                  {itemProgress.completedPages}/{itemProgress.totalScopePages} · ص {itemProgress.resumePage}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Creation Form (shown for first khatma, completion, or explicit "+ إنشاء ختمة جديدة") */}
      {showCreator && (
        <div className="space-y-4 rounded-2xl border border-[#1C4E46]/12 bg-[#F9F6EE] p-4 dark:border-[#E0A96D]/18 dark:bg-[#0B132B]/70">
          <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">
            {selectedKhatma?.completedAt && !isCreatingNew
              ? 'ما شاء الله، اكتملت الختمة السابقة. ابدأ ختمة جديدة:'
              : 'إعداد ختمة قراءة جديدة'}
          </p>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <label className="block space-y-1.5 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span>اسم الختمة (اختياري)</span>
              <input
                type="text"
                aria-label="اسم ختمة القراءة"
                value={newTitle}
                onChange={event => setNewTitle(event.target.value)}
                placeholder="مثال: ختمة التلاوة اليومية"
                maxLength={50}
                className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 bg-white px-3 text-xs font-semibold text-[#142421] dark:border-[#E0A96D]/20 dark:bg-[#111F36] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
            </label>

            <label className="block space-y-1.5 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
                مدة الختمة
              </span>
              <select
                aria-label="مدة ختمة القراءة"
                value={newDurationDays}
                onChange={event => setNewDurationDays(Number(event.target.value))}
                className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 bg-white px-3 text-xs font-semibold dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
              >
                <option value={10}>10 أيام (جزء يومياً × 3)</option>
                <option value={15}>15 يوماً (جزآن يومياً)</option>
                <option value={30}>30 يوماً (ختمة شهرية)</option>
                <option value={45}>45 يوماً</option>
                <option value={60}>60 يوماً (نصف جزء يومياً)</option>
                <option value={90}>90 يوماً</option>
                <option value={120}>120 يوماً</option>
              </select>
            </label>

            <label className="block space-y-1.5 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
              <span className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
                جلسات القراءة يومياً
              </span>
              <select
                aria-label="عدد جلسات القراءة اليومية"
                value={newSessionsPerDay}
                onChange={event => setNewSessionsPerDay(Number(event.target.value))}
                className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 bg-white px-3 text-xs font-semibold dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
              >
                <option value={1}>جلسة واحدة</option>
                <option value={2}>جلستان</option>
                <option value={3}>3 جلسات</option>
                <option value={4}>4 جلسات</option>
                <option value={5}>5 جلسات (مع الصلوات)</option>
                <option value={6}>6 جلسات</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">النطاق:</span>
              <button
                type="button"
                aria-pressed={newScopeMode === 'full'}
                onClick={() => setNewScopeMode('full')}
                className={`min-h-10 rounded-xl border px-3 py-1.5 font-bold ${
                  newScopeMode === 'full'
                    ? 'border-[#C59B27] bg-[#1C4E46] text-white dark:bg-[#1E4A47]'
                    : 'border-[#1C4E46]/15 bg-white text-[#142421] dark:border-[#E0A96D]/20 dark:bg-[#111F36] dark:text-[#F5F1E8]'
                }`}
              >
                المصحف كامل (1–604)
              </button>
              <button
                type="button"
                aria-pressed={newScopeMode === 'custom'}
                onClick={() => setNewScopeMode('custom')}
                className={`min-h-10 rounded-xl border px-3 py-1.5 font-bold ${
                  newScopeMode === 'custom'
                    ? 'border-[#C59B27] bg-[#1C4E46] text-white dark:bg-[#1E4A47]'
                    : 'border-[#1C4E46]/15 bg-white text-[#142421] dark:border-[#E0A96D]/20 dark:bg-[#111F36] dark:text-[#F5F1E8]'
                }`}
              >
                نطاق صفحات مخصص
              </button>
            </div>

            {newScopeMode === 'custom' && (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 font-semibold text-[#142421] dark:text-[#F5F1E8]">
                  <span>من ص</span>
                  <input
                    type="number"
                    min={1}
                    max={604}
                    aria-label="صفحة بداية الختمة"
                    value={newStartPage}
                    onChange={event => setNewStartPage(Number(event.target.value) || 1)}
                    className="min-h-10 w-16 rounded-lg border border-[#1C4E46]/15 bg-white px-2 text-center font-mono tabular-nums dark:border-[#E0A96D]/25 dark:bg-[#111F36]"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 font-semibold text-[#142421] dark:text-[#F5F1E8]">
                  <span>إلى ص</span>
                  <input
                    type="number"
                    min={newStartPage}
                    max={604}
                    aria-label="صفحة نهاية الختمة"
                    value={newEndPage}
                    onChange={event => setNewEndPage(Number(event.target.value) || 604)}
                    className="min-h-10 w-16 rounded-lg border border-[#1C4E46]/15 bg-white px-2 text-center font-mono tabular-nums dark:border-[#E0A96D]/25 dark:bg-[#111F36]"
                  />
                </label>
              </div>
            )}

            <span className="text-[11px] font-semibold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums">
              الورد التقديري: {creatorDailyPreview} صفحة يومياً
            </span>
          </div>

          <button
            type="button"
            onClick={handleCreateSubmit}
            className="min-h-11 w-full rounded-xl wird-btn-primary px-4 py-2 text-sm font-bold"
          >
            بدء ختمة جديدة
          </button>
        </div>
      )}

      {/* Active Khatma Tracking Hub */}
      {selectedKhatma && progress && isActive && (
        <div className="space-y-4">
          {/* Primary Resume + Progress Header */}
          <div className="rounded-2xl border border-[#C59B27]/30 bg-[#F9F6EE] p-4 dark:border-[#E0A96D]/20 dark:bg-[#0B132B]/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">
                  <span>{selectedKhatma.title || 'ختمة القراءة'}</span>
                  <span className="text-xs font-mono tabular-nums text-[#1C4E46] dark:text-[#E0A96D]">
                    · {progress.percent}٪ ({progress.completedPages} / {progress.totalScopePages} صفحة)
                  </span>
                </div>
                <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                  آخر موضع توقف: صفحة {progress.resumePage} · ورد اليوم: {progress.pagesReadToday} / {progress.pagesPerDay} صفحة · المتبقي {progress.remainingPages} صفحة حتى {formatDate(progress.targetCompletionDate)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={progress.isPaused}
                  onClick={() => onContinue(progress.resumePage)}
                  className="min-h-11 rounded-xl wird-btn-primary px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  متابعة القراءة · ص {progress.resumePage}
                </button>
                {progress.resumePage !== progress.nextPage && (
                  <button
                    type="button"
                    disabled={progress.isPaused}
                    onClick={() => onContinue(progress.nextPage)}
                    className="min-h-11 rounded-xl border border-[#1C4E46]/20 bg-white px-3 py-2 text-xs font-bold text-[#1C4E46] hover:border-[#C59B27] disabled:opacity-50 dark:border-[#E0A96D]/25 dark:bg-[#111F36] dark:text-[#E0A96D]"
                  >
                    أول غير مقروءة (ص {progress.nextPage})
                  </button>
                )}
              </div>
            </div>

            <progress
              aria-label="تقدم ختمة القراءة"
              value={progress.completedPages}
              max={progress.totalScopePages}
              className="h-2 w-full accent-[#1C4E46] dark:accent-[#E0A96D]"
            />

            {/* Single Calm Line for Daily Sessions Split */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
              <span>
                الهدف اليومي: {progress.pagesPerDay} ص ({progress.sessionsPerDay} جلسات × ~{progress.pagesPerSession} ص) · الأيام المتبقية: {progress.daysRemaining}
              </span>
              {sessionTargets.length > 0 && (
                <span>
                  {sessionTargets.map((pages, idx) => `ج${idx + 1}: ${pages}ص`).join(' · ')}
                </span>
              )}
            </div>
          </div>

          {/* Progressive Disclosure for Editing Plan, Pause/Resume, and Deleting */}
          <details className="rounded-xl border border-[#1C4E46]/12 bg-[#F9F6EE]/70 px-4 py-2.5 dark:border-[#E0A96D]/15 dark:bg-[#0B132B]/50">
            <summary className="flex min-h-10 cursor-pointer items-center justify-between text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
              <span>إعدادات هذه الختمة (تعديل الخطة أو الإيقاف المؤقت)</span>
              <ChevronDown className="h-4 w-4 text-[#5B6F6B]" />
            </summary>

            <div className="mt-3 space-y-3 border-t border-[#1C4E46]/10 pt-3 dark:border-[#E0A96D]/15">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
                  <span>تعديل اسم الختمة</span>
                  <input
                    type="text"
                    aria-label="تعديل اسم الختمة"
                    value={editTitle}
                    onChange={event => setEditTitle(event.target.value)}
                    maxLength={50}
                    className="min-h-11 w-full rounded-lg border border-[#1C4E46]/15 bg-white px-3 text-xs dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
                  <span>تعديل مدة الختمة</span>
                  <select
                    aria-label="تعديل مدة الختمة"
                    value={durationDays}
                    onChange={event => setDurationDays(Number(event.target.value))}
                    className="min-h-11 w-full rounded-lg border border-[#1C4E46]/15 bg-white px-3 text-xs dark:border-[#E0A96D]/20 dark:bg-[#111F36]"
                  >
                    <option value={10}>10 أيام</option>
                    <option value={15}>15 يوماً</option>
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdatePlan({ durationDays, sessionsPerDay }, selectedKhatma.id, editTitle)}
                  className="min-h-11 rounded-xl border border-[#C59B27]/50 px-3.5 py-2 text-xs font-bold text-[#1C4E46] dark:border-[#E0A96D]/40 dark:text-[#E0A96D]"
                >
                  تحديث الخطة
                </button>
                <button
                  type="button"
                  onClick={() => (progress.isPaused ? onResume(selectedKhatma.id) : onPause(selectedKhatma.id))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1C4E46]/20 px-3 py-2 text-xs font-semibold text-[#142421] dark:border-[#E0A96D]/25 dark:text-[#F5F1E8]"
                >
                  {progress.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {progress.isPaused ? 'استئناف الختمة' : 'إيقاف مؤقت'}
                </button>

                {onDeleteKhatma && allKhatmas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteKhatma(selectedKhatma.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-rose-300/60 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>حذف هذه الختمة</span>
                  </button>
                )}

                {confirmReset ? (
                  <>
                    <span role="status" className="max-w-xs text-xs text-rose-700 dark:text-rose-300">
                      سيُحذف تقدم الختمات وسجلها نهائياً. هل تريد المتابعة؟
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onReset();
                        setConfirmReset(false);
                      }}
                      className="min-h-11 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white"
                    >
                      تأكيد المسح
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-11 rounded-lg border px-3 text-xs"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    aria-label="إعادة ضبط ختمة القراءة"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1C4E46]/15 px-3 text-xs font-semibold text-[#142421] dark:border-[#E0A96D]/20 dark:text-[#F5F1E8]"
                  >
                    <RotateCcw className="h-4 w-4" /> مسح الكل
                  </button>
                )}
              </div>
            </div>
          </details>
        </div>
      )}

      {selectedKhatma?.completedAt && (
        <div className="rounded-xl border border-[#C59B27]/40 bg-[#F9F6EE] p-4 text-sm font-semibold text-[#1C4E46] dark:border-[#E0A96D]/30 dark:bg-[#0B132B]/70 dark:text-[#E0A96D]">
          اكتملت الختمة الحالية، تقبل الله منك. يمكنك بدء ختمة جديدة مع الاحتفاظ بسجل الختمات السابقة.
        </div>
      )}

      {history.length > 0 && (
        <details className="rounded-xl border border-[#1C4E46]/12 bg-[#F9F6EE] px-4 py-2.5 dark:border-[#E0A96D]/15 dark:bg-[#0B132B]/60">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
            <span>سجل الختمات المكتملة ({history.length})</span>
            <ChevronDown className="h-4 w-4 text-[#5B6F6B]" />
          </summary>
          <ul className="mt-2.5 space-y-2 border-t border-[#1C4E46]/10 pt-2.5 dark:border-[#E0A96D]/15">
            {history.slice(0, 8).map(cycle => (
              <li
                key={cycle.id}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]"
              >
                <span>
                  {cycle.title ? `${cycle.title} · ` : ''}بدأت {formatDate(cycle.startedAt.slice(0, 10))} · اكتملت {formatDate(cycle.completedAt.slice(0, 10))}
                </span>
                <span className="font-semibold tabular-nums">{cycle.pagesRead ?? 604} صفحة</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
};

