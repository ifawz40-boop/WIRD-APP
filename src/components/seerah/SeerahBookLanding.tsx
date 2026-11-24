import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  Layers,
  Search,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import {
  computeSeerahBookProgress,
  searchSeerahItemsSync,
  type SeerahBookManifest,
  type SeerahProgressState,
  type SeerahSearchItem
} from '../../services/seerahBookService';
import { WirdIslamicPattern, WirdMihrabArch } from '../brand/WirdPattern';

interface SeerahBookLandingProps {
  manifest: SeerahBookManifest;
  progressState: SeerahProgressState;
  searchIndex: SeerahSearchItem[] | null;
  onEnsureSearchIndex: () => void;
  onOpenChapter: (chapterId: string, sceneId?: string) => void;
  onToggleChapterRead: (chapterId: string) => void;
  onOpenCharacterDirectory: () => void;
  onOpenCharacter: (characterId: string) => void;
}

export const SeerahBookLanding: React.FC<SeerahBookLandingProps> = ({
  manifest,
  progressState,
  searchIndex,
  onEnsureSearchIndex,
  onOpenChapter,
  onToggleChapterRead,
  onOpenCharacterDirectory,
  onOpenCharacter,
}) => {
  const [selectedEraId, setSelectedEraId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = useMemo(
    () => computeSeerahBookProgress(progressState, manifest),
    [progressState, manifest]
  );

  const completedSet = useMemo(
    () => new Set(progressState.completedChapterIds),
    [progressState.completedChapterIds]
  );

  const resumeChapter = useMemo(() => {
    if (progressState.lastPosition) {
      const exact = manifest.chapters.find(
        (c) => c.id === progressState.lastPosition?.chapterId
      );
      if (exact) return exact;
    }
    // Next unread chapter, or Chapter 1
    return manifest.chapters.find((c) => !completedSet.has(c.id)) || manifest.chapters[0];
  }, [manifest.chapters, progressState.lastPosition, completedSet]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return null;
    if (!searchIndex) return [];
    return searchSeerahItemsSync(searchQuery, searchIndex, 'all');
  }, [searchQuery, searchIndex]);

  const visibleEras = useMemo(
    () =>
      selectedEraId === 'all'
        ? manifest.eras
        : manifest.eras.filter((e) => e.id === selectedEraId),
    [manifest.eras, selectedEraId]
  );

  return (
    <div id="seerah-book-landing" className="max-w-5xl mx-auto space-y-8">
      {/* 1. Calm Digital Book Hero & Progress */}
      <section
        aria-labelledby="seerah-book-hero-title"
        className="wird-hero-surface relative p-6 sm:p-8 md:p-10 overflow-hidden"
      >
        <WirdIslamicPattern opacity={0.05} variant="gold" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 wird-section-badge">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                كتاب السيرة النبوية الشريفة · {manifest.totalSections} قسماً · {manifest.totalChapters} فصلاً متصلاً
              </span>
            </div>

            <h1
              id="seerah-book-hero-title"
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-quran text-[#F5F1E8] leading-snug"
            >
              {manifest.title}
            </h1>

            <p className="text-xs sm:text-sm text-[#F2EDE2]/90 leading-relaxed">
              {manifest.subtitle}. قراءة سردية عربية هادئة وموثقة تجمع دقة التحقيق التاريخي وحفظ الآيات والأحاديث بنصها الحرفي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            {resumeChapter && (
              <button
                type="button"
                onClick={() =>
                  onOpenChapter(
                    resumeChapter.id,
                    progressState.lastPosition?.chapterId === resumeChapter.id
                      ? progressState.lastPosition.sceneId
                      : undefined
                  )
                }
                className="wird-btn-accent min-h-12 px-5 py-3 text-xs sm:text-sm font-bold inline-flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  {progressState.lastPosition
                    ? `متابعة القراءة: ${resumeChapter.title}`
                    : `ابدأ الرحلة: ${resumeChapter.title}`}
                </span>
              </button>
            )}
            <WirdMihrabArch size={80} variant="gold" className="hidden sm:block shrink-0" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative z-10 mt-7 pt-5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#F2EDE2]">
          <div>
            تقدمك في قراءة السيرة:{' '}
            <strong className="font-mono">
              {summary.completedCount} من {summary.totalCount} فصلاً ({summary.percent}%)
            </strong>
          </div>
          <div
            role="progressbar"
            aria-label="نسبة الفصول المقروءة في كتاب السيرة النبوية"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.percent}
            className="w-full sm:w-64 h-2 rounded-full bg-white/15 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#F6D78B] to-[#C59B27] transition-all duration-300"
              style={{ width: `${summary.percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. Dedicated Character Directory Entry + Search & Era Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <button
          type="button"
          onClick={onOpenCharacterDirectory}
          className="lg:col-span-5 wird-card p-5 text-right hover:border-[var(--wird-border-gold)] transition-all flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-sm font-extrabold font-quran text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              <Users className="w-4 h-4" />
              <span>دليل شخصيات السيرة ({manifest.totalCharacters} شخصية)</span>
            </div>
            <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
              حكايات سردية متصلة للصحابة وأمهات المؤمنين وآل البيت مرتبطة بمواضعهم في السيرة.
            </p>
          </div>
          <ChevronLeft className="w-5 h-5 text-[var(--wird-accent)] shrink-0" />
        </button>

        <div className="lg:col-span-7 wird-card p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="ابحث في فصول وشخصيات السيرة النبوية"
              value={searchQuery}
              onFocus={onEnsureSearchIndex}
              onChange={(e) => {
                onEnsureSearchIndex();
                setSearchQuery(e.target.value);
              }}
              placeholder="ابحث عن حدث، غزوة، فصل، أو شخصية..."
              className="w-full min-h-11 pr-10 pl-8 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs sm:text-sm text-[var(--wird-text)]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            aria-label="تصفية حسب العصر التاريخي"
            value={selectedEraId}
            onChange={(e) => setSelectedEraId(e.target.value)}
            className="min-h-11 px-3.5 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)]"
          >
            <option value="all">جميع العصور ({manifest.totalEras} عصور)</option>
            {manifest.eras.map((era) => (
              <option key={era.id} value={era.id}>
                {era.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Instant Search Results Panel */}
      {searchResults !== null && (
        <section className="wird-card p-5 sm:p-6 space-y-3" aria-label="نتائج البحث في السيرة">
          <div className="flex items-center justify-between text-xs text-[var(--wird-muted)]">
            <span>
              نتائج البحث عن «<strong className="text-[var(--wird-text)]">{searchQuery}</strong>»:{' '}
              <strong className="font-mono">{searchResults.length}</strong>
            </span>
          </div>

          {searchResults.length === 0 ? (
            <p className="text-xs text-[var(--wird-muted)] py-4 text-center">
              لم يُعثر على نتائج مطابقة. جرّب كلمة أخرى.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pl-1">
              {searchResults.map((hit) => (
                <button
                  key={`${hit.kind}:${hit.id}`}
                  type="button"
                  onClick={() =>
                    hit.kind === 'chapter'
                      ? onOpenChapter(hit.id)
                      : onOpenCharacter(hit.id)
                  }
                  className="p-4 rounded-xl bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] border border-[var(--wird-border)] text-right space-y-1 transition-all"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-[var(--wird-accent)]">
                      {hit.kind === 'chapter' ? `الفصل ${hit.order}` : 'شخصية تاريخية'}
                    </span>
                    <span className="text-[var(--wird-muted)]">{hit.periodLabel}</span>
                  </div>
                  <div className="text-sm font-bold font-quran text-[var(--wird-text)]">
                    {hit.title}
                  </div>
                  <p className="text-xs text-[var(--wird-muted)] line-clamp-2">{hit.preview}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Chronological Eras -> Sections -> Chapters */}
      <div className="space-y-8">
        {visibleEras.map((era) => {
          const eraSections = manifest.sections.filter((s) => s.eraId === era.id);
          return (
            <section key={era.id} className="space-y-4">
              <div className="px-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold font-quran text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--wird-accent)]" />
                    <span>{era.title}</span>
                  </h2>
                  <span className="text-xs font-mono text-[var(--wird-muted)]">
                    {era.periodLabel}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--wird-muted)] leading-relaxed">
                  {era.summary}
                </p>
              </div>

              <div className="space-y-5">
                {eraSections.map((sec) => {
                  const secChapters = manifest.chapters.filter(
                    (c) => c.sectionId === sec.id
                  );
                  const secProg = summary.bySection[sec.id] || {
                    completed: 0,
                    total: secChapters.length,
                    percent: 0,
                  };

                  return (
                    <div key={sec.id} className="wird-card p-5 sm:p-6 space-y-4">
                      <div className="pb-3 border-b border-[var(--wird-border)] flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 max-w-2xl">
                          <div className="text-[11px] font-bold text-[var(--wird-accent)]">
                            القسم {sec.order} · {sec.periodLabel}
                          </div>
                          <h3 className="text-base sm:text-lg font-bold font-quran text-[var(--wird-text)]">
                            {sec.title}
                          </h3>
                          <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                            {sec.summary}
                          </p>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px] font-mono text-[var(--wird-muted)]">
                          {secProg.completed} / {secProg.total} مكتمل
                        </span>
                      </div>

                      <div className="divide-y divide-[var(--wird-border)]/70">
                        {secChapters.map((ch) => {
                          const isDone = completedSet.has(ch.id);
                          const isLastRead =
                            progressState.lastPosition?.chapterId === ch.id;

                          return (
                            <div
                              key={ch.id}
                              className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="font-mono font-bold text-[var(--wird-accent)]">
                                    الفصل {ch.order}
                                  </span>
                                  <span className="text-[var(--wird-muted)]">·</span>
                                  <span className="text-[var(--wird-muted)]">
                                    {ch.periodLabel}
                                  </span>
                                  <span className="text-[var(--wird-muted)]">·</span>
                                  <span className="inline-flex items-center gap-1 text-[var(--wird-muted)]">
                                    <Clock className="w-3 h-3" />
                                    <span>{ch.estimatedReadingMinutes} د</span>
                                  </span>
                                  {isLastRead && (
                                    <span className="px-2 py-0.5 rounded-full bg-[var(--wird-primary)]/15 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold">
                                      آخر موضع قراءة
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onOpenChapter(ch.id)}
                                  className="text-right group block w-full"
                                >
                                  <h4 className="text-sm sm:text-base font-bold font-quran text-[var(--wird-text)] group-hover:text-[var(--wird-primary)] dark:group-hover:text-[var(--wird-accent)] transition-colors">
                                    {ch.title}
                                  </h4>
                                  <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                                    {ch.subtitle}
                                  </p>
                                </button>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  aria-pressed={isDone}
                                  aria-label={
                                    isDone
                                      ? `إلغاء تحديد ${ch.title} كمقروء`
                                      : `تحديد ${ch.title} كمقروء`
                                  }
                                  onClick={() => onToggleChapterRead(ch.id)}
                                  className={`min-h-10 px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                                    isDone
                                      ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                                  }`}
                                >
                                  {isDone ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>مقروء</span>
                                    </>
                                  ) : (
                                    <>
                                      <Circle className="w-3.5 h-3.5" />
                                      <span>غير مقروء</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onOpenChapter(ch.id)}
                                  className="min-h-10 px-4 py-1.5 rounded-xl bg-[var(--wird-primary)] text-white text-xs font-bold inline-flex items-center gap-1.5"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                                  <span>اقرأ الفصل</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
