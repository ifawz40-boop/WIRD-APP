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
import { ALL_SURAHS } from '../../data/quranMeta';
import { QURAN_JUZ_STARTS } from '../../data/quranNavigationIndex.generated';
import { QURAN_PAGE_INDEX } from '../../data/quranPageIndex.generated';

const JUZ_START_MAP = QURAN_JUZ_STARTS as unknown as Record<string, { surahNumber: number; ayahNumber: number; page: number }>;
const PAGE_SEGMENTS_MAP = QURAN_PAGE_INDEX as unknown as Record<string, Array<{ surahNumber: number; startAyah: number; endAyah: number }>>;

function getJuzPageRange(fromJuz: number, toJuz: number): { startPage: number; endPage: number } {
  const safeFrom = Math.min(30, Math.max(1, fromJuz));
  const safeTo = Math.min(30, Math.max(safeFrom, toJuz));
  const startPage = JUZ_START_MAP[String(safeFrom)]?.page ?? 1;
  const endPage = safeTo >= 30 ? 604 : Math.max(startPage, (JUZ_START_MAP[String(safeTo + 1)]?.page ?? 604) - 1);
  return { startPage, endPage };
}

function getSurahPageRange(surahNumber: number): { startPage: number; endPage: number } {
  const surah = ALL_SURAHS.find(s => s.number === surahNumber) || ALL_SURAHS[0];
  let endPage = surah.pageStart;
  for (let p = surah.pageStart; p <= 604; p += 1) {
    const segments = PAGE_SEGMENTS_MAP[String(p)];
    if (segments?.some(seg => seg.surahNumber === surah.number)) {
      endPage = p;
    } else if (p > surah.pageStart) {
      break;
    }
  }
  return { startPage: surah.pageStart, endPage };
}

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
  const [newScopeMode, setNewScopeMode] = useState<'full' | 'juz' | 'surah' | 'custom'>('full');
  const [newFromJuz, setNewFromJuz] = useState(30);
  const [newToJuz, setNewToJuz] = useState(30);
  const [newSurahNumber, setNewSurahNumber] = useState(2);
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

  const resolvedCreatorRange = (() => {
    if (newScopeMode === 'juz') return getJuzPageRange(newFromJuz, newToJuz);
    if (newScopeMode === 'surah') return getSurahPageRange(newSurahNumber);
    if (newScopeMode === 'custom') {
      const startPage = Math.max(1, Math.min(604, newStartPage));
      const endPage = Math.max(startPage, Math.min(604, newEndPage));
      return { startPage, endPage };
    }
    return { startPage: 1, endPage: 604 };
  })();

  const handleCreateSubmit = () => {
    const { startPage: scopeStart, endPage: scopeEnd } = resolvedCreatorRange;
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
  const creatorPreviewPagesCount = Math.max(1, resolvedCreatorRange.endPage - resolvedCreatorRange.startPage + 1);
  const creatorDailyPreview = Math.ceil(creatorPreviewPagesCount / Math.max(1, newDurationDays));

  return (
    <section
      aria-labelledby="reading-khatma-title"
      className="wird-card p-5 border-[var(--wird-border-gold)] space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2
            id="reading-khatma-title"
            className="flex items-center gap-2 font-bold text-[var(--wird-primary)]"
          >
            <BookOpenCheck className="h-5 w-5 shrink-0" />
            <span>ختمات القراءة المتعددة</span>
          </h2>
          <p className="text-xs text-[var(--wird-muted)]">
            أنشئ أكثر من ختمة مستقلة بالاسم والموضع، وسجّل وردك مباشرة من داخل المصحف المطبوع أو النص المرن.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {historyCount > 0 && (
            <span className="text-xs font-semibold text-[var(--wird-muted)] tabular-nums">
              المكتملة: <strong className="text-[var(--wird-text)]">{historyCount}</strong>
            </span>
          )}
          {selectedKhatma && !selectedKhatma.completedAt && (
            <button
              type="button"
              onClick={() => setIsCreatingNew(prev => !prev)}
              aria-expanded={isCreatingNew}
              className={`min-h-11 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                isCreatingNew
                  ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                  : 'border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] hover:border-[var(--wird-accent)]'
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
          className="flex flex-wrap items-center gap-2 border-t border-[var(--wird-border)] pt-3"
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
                className={`min-h-11 inline-flex items-center gap-2 rounded-[var(--wird-radius-control)] border px-3.5 py-2 text-xs font-bold transition-colors ${
                  isSelected
                    ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs'
                    : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
                }`}
              >
                <span>{item.title || 'ختمة القراءة'}</span>
                <span className={`font-mono tabular-nums text-[11px] ${isSelected ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
                  {itemProgress.completedPages}/{itemProgress.totalScopePages} · ص {itemProgress.resumePage}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Creation Form */}
      {showCreator && (
        <div className="space-y-4 rounded-2xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-4">
          <p className="text-sm font-bold text-[var(--wird-text)]">
            {selectedKhatma?.completedAt && !isCreatingNew
              ? 'ما شاء الله، اكتملت الختمة السابقة. ابدأ ختمة جديدة:'
              : 'إعداد ختمة قراءة جديدة'}
          </p>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <label className="block space-y-1.5 text-xs font-semibold text-[var(--wird-text)]">
              <span>اسم الختمة (اختياري)</span>
              <input
                type="text"
                aria-label="اسم ختمة القراءة"
                value={newTitle}
                onChange={event => setNewTitle(event.target.value)}
                placeholder="مثال: ختمة التلاوة اليومية"
                maxLength={50}
                className="min-h-11 w-full rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs font-semibold text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
              />
            </label>

            <label className="block space-y-1.5 text-xs font-semibold text-[var(--wird-text)]">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-[var(--wird-accent)]" />
                مدة الختمة
              </span>
              <select
                aria-label="مدة ختمة القراءة"
                value={newDurationDays}
                onChange={event => setNewDurationDays(Number(event.target.value))}
                className="min-h-11 w-full rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs font-semibold text-[var(--wird-text)]"
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

            <label className="block space-y-1.5 text-xs font-semibold text-[var(--wird-text)]">
              <span className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[var(--wird-accent)]" />
                جلسات القراءة يومياً
              </span>
              <select
                aria-label="عدد جلسات القراءة اليومية"
                value={newSessionsPerDay}
                onChange={event => setNewSessionsPerDay(Number(event.target.value))}
                className="min-h-11 w-full rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs font-semibold text-[var(--wird-text)]"
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
              <span className="font-semibold text-[var(--wird-muted)]">النطاق:</span>
              {([
                { id: 'full', label: 'المصحف كامل (1–604)' },
                { id: 'juz', label: 'بالأجزاء' },
                { id: 'surah', label: 'بسورة محددة' },
                { id: 'custom', label: 'نطاق صفحات مخصص' }
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={newScopeMode === opt.id}
                  onClick={() => setNewScopeMode(opt.id)}
                  className={`min-h-10 rounded-[var(--wird-radius-control)] border px-3 py-1.5 font-bold transition-colors ${
                    newScopeMode === opt.id
                      ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                      : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {newScopeMode === 'juz' && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-text)]">
                  <span>من جزء</span>
                  <select
                    aria-label="الجزء البداية للختمة"
                    value={newFromJuz}
                    onChange={event => {
                      const nextFrom = Number(event.target.value);
                      setNewFromJuz(nextFrom);
                      if (newToJuz < nextFrom) setNewToJuz(nextFrom);
                    }}
                    className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2 text-xs font-semibold text-[var(--wird-text)]"
                  >
                    {Array.from({ length: 30 }, (_, idx) => idx + 1).map(juz => (
                      <option key={juz} value={juz}>الجزء {juz}</option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-text)]">
                  <span>إلى جزء</span>
                  <select
                    aria-label="الجزء النهاية للختمة"
                    value={newToJuz}
                    onChange={event => setNewToJuz(Number(event.target.value))}
                    className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2 text-xs font-semibold text-[var(--wird-text)]"
                  >
                    {Array.from({ length: 30 - newFromJuz + 1 }, (_, idx) => newFromJuz + idx).map(juz => (
                      <option key={juz} value={juz}>الجزء {juz}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {newScopeMode === 'surah' && (
              <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-text)]">
                <span>السورة</span>
                <select
                  aria-label="سورة الختمة"
                  value={newSurahNumber}
                  onChange={event => setNewSurahNumber(Number(event.target.value))}
                  className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2.5 text-xs font-semibold text-[var(--wird-text)]"
                >
                  {ALL_SURAHS.map(surah => (
                    <option key={surah.number} value={surah.number}>
                      {surah.number}. سورة {surah.name} (ص {surah.pageStart})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {newScopeMode === 'custom' && (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-text)]">
                  <span>من ص</span>
                  <input
                    type="number"
                    min={1}
                    max={604}
                    aria-label="صفحة بداية الختمة"
                    value={newStartPage}
                    onChange={event => setNewStartPage(Number(event.target.value) || 1)}
                    className="min-h-10 w-16 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2 text-center font-mono tabular-nums text-[var(--wird-text)]"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-text)]">
                  <span>إلى ص</span>
                  <input
                    type="number"
                    min={newStartPage}
                    max={604}
                    aria-label="صفحة نهاية الختمة"
                    value={newEndPage}
                    onChange={event => setNewEndPage(Number(event.target.value) || 604)}
                    className="min-h-10 w-16 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2 text-center font-mono tabular-nums text-[var(--wird-text)]"
                  />
                </label>
              </div>
            )}

            <span className="text-[11px] font-semibold text-[var(--wird-primary)] tabular-nums">
              الورد التقديري: {creatorDailyPreview} صفحة يومياً
            </span>
          </div>

          <button
            type="button"
            onClick={handleCreateSubmit}
            className="min-h-11 w-full rounded-[var(--wird-radius-control)] wird-btn-primary px-4 py-2 text-sm font-bold"
          >
            بدء ختمة جديدة
          </button>
        </div>
      )}

      {/* Active Khatma Tracking Hub */}
      {selectedKhatma && progress && isActive && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--wird-text)]">
                  <span>{selectedKhatma.title || 'ختمة القراءة'}</span>
                  <span className="text-xs font-mono tabular-nums text-[var(--wird-primary)]">
                    · {progress.percent}٪ ({progress.completedPages} / {progress.totalScopePages} صفحة)
                  </span>
                </div>
                <p className="text-xs text-[var(--wird-muted)] tabular-nums">
                  آخر موضع توقف: صفحة {progress.resumePage} · ورد اليوم: {progress.pagesReadToday} / {progress.pagesPerDay} صفحة · المتبقي {progress.remainingPages} صفحة حتى {formatDate(progress.targetCompletionDate)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={progress.isPaused}
                  onClick={() => onContinue(progress.resumePage)}
                  className="min-h-11 rounded-[var(--wird-radius-control)] wird-btn-primary px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  متابعة القراءة · ص {progress.resumePage}
                </button>
                {progress.resumePage !== progress.nextPage && (
                  <button
                    type="button"
                    disabled={progress.isPaused}
                    onClick={() => onContinue(progress.nextPage)}
                    className="min-h-11 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-2 text-xs font-bold text-[var(--wird-primary)] hover:border-[var(--wird-accent)] disabled:opacity-50"
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
              className="h-2 w-full accent-[var(--wird-primary)]"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--wird-muted)] tabular-nums">
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

          <details className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)]/70 px-4 py-2.5">
            <summary className="flex min-h-10 cursor-pointer items-center justify-between text-xs font-bold text-[var(--wird-text)]">
              <span>إعدادات هذه الختمة (تعديل الخطة أو الإيقاف المؤقت)</span>
              <ChevronDown className="h-4 w-4 text-[var(--wird-muted)]" />
            </summary>

            <div className="mt-3 space-y-3 border-t border-[var(--wird-border)] pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-[var(--wird-text)]">
                  <span>تعديل اسم الختمة</span>
                  <input
                    type="text"
                    aria-label="تعديل اسم الختمة"
                    value={editTitle}
                    onChange={event => setEditTitle(event.target.value)}
                    maxLength={50}
                    className="min-h-11 w-full rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs text-[var(--wird-text)]"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[var(--wird-text)]">
                  <span>تعديل مدة الختمة</span>
                  <select
                    aria-label="تعديل مدة الختمة"
                    value={durationDays}
                    onChange={event => setDurationDays(Number(event.target.value))}
                    className="min-h-11 w-full rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs text-[var(--wird-text)]"
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
                <label className="space-y-1 text-xs font-semibold text-[var(--wird-text)]">
                  <span>تعديل عدد الجلسات</span>
                  <select
                    aria-label="تعديل عدد الجلسات"
                    value={sessionsPerDay}
                    onChange={event => setSessionsPerDay(Number(event.target.value))}
                    className="min-h-11 w-full rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs text-[var(--wird-text)]"
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
                  className="min-h-11 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] px-3.5 py-2 text-xs font-bold text-[var(--wird-primary)] hover:bg-[var(--wird-surface)]"
                >
                  تحديث الخطة
                </button>
                <button
                  type="button"
                  onClick={() => (progress.isPaused ? onResume(selectedKhatma.id) : onPause(selectedKhatma.id))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] px-3 py-2 text-xs font-semibold text-[var(--wird-text)]"
                >
                  {progress.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {progress.isPaused ? 'استئناف الختمة' : 'إيقاف مؤقت'}
                </button>

                {onDeleteKhatma && allKhatmas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteKhatma(selectedKhatma.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] border border-rose-300/60 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:text-rose-300"
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
                      className="min-h-11 rounded-lg border border-[var(--wird-border-strong)] px-3 text-xs text-[var(--wird-text)]"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    aria-label="إعادة ضبط ختمة القراءة"
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] px-3 text-xs font-semibold text-[var(--wird-text)]"
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
        <div className="rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] p-4 text-sm font-semibold text-[var(--wird-primary)]">
          اكتملت الختمة الحالية، تقبل الله منك. يمكنك بدء ختمة جديدة مع الاحتفاظ بسجل الختمات السابقة.
        </div>
      )}

      {history.length > 0 && (
        <details className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)]/75 px-4 py-2.5">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between text-xs font-bold text-[var(--wird-text)]">
            <span>سجل الختمات المكتملة ({history.length})</span>
            <ChevronDown className="h-4 w-4 text-[var(--wird-muted)]" />
          </summary>
          <ul className="mt-2.5 space-y-2 border-t border-[var(--wird-border)] pt-2.5">
            {history.slice(0, 8).map(cycle => (
              <li
                key={cycle.id}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--wird-muted)]"
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

