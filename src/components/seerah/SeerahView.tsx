import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import {
  SEERAH_BOOK_VERSION,
  SEERAH_CHAPTERS,
  SEERAH_CLAIMS,
  SEERAH_PARTS,
  SEERAH_PEOPLE,
  SEERAH_PLACES,
  SEERAH_SOURCES,
  getSeerahChapterById,
  getSeerahChaptersByPart,
  type SeerahChapter,
  type SeerahDatePrecision
} from '../../data/seerahData';
import {
  getSeerahOverallProgress,
  readSeerahProgressStore,
  saveSeerahReadingPosition,
  setSeerahReadingMode,
  toggleSeerahBookmark,
  toggleSeerahChapterCompleted,
  type SeerahProgressStore
} from '../../services/seerahProgressService';
import { WirdIslamicPattern, WirdMihrabArch } from '../brand/WirdPattern';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';

interface SeerahViewProps {
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

const DATE_PRECISION_LABELS: Record<SeerahDatePrecision, { label: string; style: string }> = {
  exact: {
    label: 'تاريخ مضبوط ومثبت',
    style: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
  },
  approximate: {
    label: 'تاريخ تقريبي في السير',
    style: 'bg-[#C59B27]/15 text-[#9A7415] dark:text-[#E0A96D] border-[#C59B27]/35'
  },
  range: {
    label: 'نطاق زمني مرحلي',
    style: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30'
  },
  disputed: {
    label: 'فيه تفصيل واختلاف تاريخي',
    style: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35'
  }
};

export const SeerahView: React.FC<SeerahViewProps> = ({ onToast }) => {
  const [store, setStore] = useState<SeerahProgressStore>(() => readSeerahProgressStore());
  const overallProgress = useMemo(() => getSeerahOverallProgress(store), [store]);

  const [activeChapterId, setActiveChapterId] = useState<string>(
    () => store.lastPosition?.chapterId || SEERAH_CHAPTERS[0].id
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'reader' | 'timeline' | 'figures' | 'bookmarks'>('reader');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartFilter, setSelectedPartFilter] = useState<string>('all');
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, number>>({});

  const activeChapter: SeerahChapter = useMemo(
    () => getSeerahChapterById(activeChapterId) || SEERAH_CHAPTERS[0],
    [activeChapterId]
  );
  const activePart = useMemo(
    () => SEERAH_PARTS.find(part => part.id === activeChapter.partId) || SEERAH_PARTS[0],
    [activeChapter.partId]
  );

  const openChapter = (chapterId: string, sceneId?: string) => {
    const ch = getSeerahChapterById(chapterId);
    if (!ch) return;
    setActiveChapterId(ch.id);
    setActiveWorkspaceTab('reader');
    setStore(saveSeerahReadingPosition(ch.id, sceneId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleCompleted = (chapterId: string) => {
    const updated = toggleSeerahChapterCompleted(chapterId);
    setStore(updated);
    const isNowDone = updated.completedChapterIds.includes(chapterId);
    const ch = getSeerahChapterById(chapterId);
    if (isNowDone && ch) {
      onToast?.(`تم تسجيل إتمام قراءة «${ch.title}» في سجل السيرة النبوية.`, 'success');
    }
  };

  const handleToggleSceneBookmark = (chapterId: string, sceneId: string) => {
    const updated = toggleSeerahBookmark(chapterId, sceneId);
    setStore(updated);
    const key = `${chapterId}:${sceneId}`;
    const isSaved = updated.bookmarks.some(b => b.id === key);
    onToast?.(
      isSaved ? 'تم حفظ العلامة المرجعية في هذا المشهد.' : 'تمت إزالة العلامة المرجعية.',
      'info'
    );
  };

  const filteredTimelineChapters = useMemo(() => {
    const query = searchQuery.trim();
    return SEERAH_CHAPTERS.filter(ch => {
      if (selectedPartFilter !== 'all' && ch.partId !== selectedPartFilter) return false;
      if (!query) return true;
      const inScenes = ch.scenes.some(sc =>
        sc.title.includes(query) || sc.bodyBlocks.some(blk => blk.text.includes(query))
      );
      return (
        ch.title.includes(query) ||
        ch.subtitle.includes(query) ||
        ch.intro.includes(query) ||
        ch.periodLabel.includes(query) ||
        inScenes
      );
    });
  }, [searchQuery, selectedPartFilter]);

  const chapterClaims = useMemo(() => {
    const ids = new Set<string>();
    for (const sc of activeChapter.scenes) {
      for (const blk of sc.bodyBlocks) {
        for (const cid of blk.claimIds) ids.add(cid);
      }
    }
    return Array.from(ids)
      .map(id => SEERAH_CLAIMS[id])
      .filter(Boolean);
  }, [activeChapter]);

  const chapterSources = useMemo(() => {
    const ids = new Set<string>();
    for (const sc of activeChapter.scenes) {
      for (const blk of sc.bodyBlocks) {
        for (const sid of blk.sourceIds) ids.add(sid);
      }
    }
    return Array.from(ids)
      .map(id => SEERAH_SOURCES[id])
      .filter(Boolean);
  }, [activeChapter]);

  const isActiveChapterCompleted = store.completedChapterIds.includes(activeChapter.id);
  const previousChapter = activeChapter.previousChapterId
    ? getSeerahChapterById(activeChapter.previousChapterId)
    : undefined;
  const nextChapter = activeChapter.nextChapterId
    ? getSeerahChapterById(activeChapter.nextChapterId)
    : undefined;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Architectural Hero Banner */}
      <section
        aria-labelledby="seerah-hero-title"
        className="wird-hero-surface relative p-6 md:p-8 overflow-hidden"
      >
        <WirdIslamicPattern opacity={0.06} variant="gold" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="wird-section-badge">
                <Sparkles className="w-3.5 h-3.5" />
                <span>حكاية السيرة النبوية الشريفة · إصدار {SEERAH_BOOK_VERSION}</span>
              </span>
              <span className="text-xs font-semibold text-[#F2EDE2]/80">
                · سرد تاريخي متصل بمصادر محققة ويعمل بالكامل دون إنترنت
              </span>
            </div>
            <h2 id="seerah-hero-title" className="text-2xl md:text-3xl font-extrabold font-quran text-[#F5F1E8]">
              السيرة النبوية الشريفة — من ما قبل البعثة إلى الرفيق الأعلى والشمائل
            </h2>
            <p className="text-xs md:text-sm text-[#F2EDE2]/90 leading-relaxed">
              ﴿ لَّقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ ﴾ — كتاب سيرة عربي متصل بأجزاء وفصول ومشاهد مترابطة، يربط كل واقعة واقتباس بمصادره المعتمدة ويميّز الثابت بالصحيح عما فيه تفصيل واختلاف تاريخي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            {store.lastPosition && (
              <button
                type="button"
                onClick={() => openChapter(store.lastPosition!.chapterId, store.lastPosition!.sceneId)}
                className="wird-btn-accent min-h-11 px-4 py-2.5 text-xs font-bold"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  استئناف القراءة: {getSeerahChapterById(store.lastPosition.chapterId)?.title || 'الفصل الحالي'}
                </span>
              </button>
            )}
            <WirdMihrabArch size={84} variant="gold" className="hidden sm:block shrink-0" />
          </div>
        </div>

        {/* Overall Progress Bar (Independent of Quran Memorization/Khatma Stats) */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#F2EDE2]">
            <ShieldCheck className="w-4 h-4 text-[#E0A96D]" />
            <span>
              تقدمك في كتاب السيرة (مستقل عن إحصاءات الحفظ والختمة):{' '}
              <strong className="font-mono">{overallProgress.completedChapters} / {overallProgress.totalChapters} فصلاً ({overallProgress.percent}%)</strong>
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="تقدم قراءة كتاب السيرة النبوية"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress.percent}
            className="w-full sm:w-64 h-2 rounded-full bg-white/15 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#F6D78B] to-[#C59B27] transition-all duration-300"
              style={{ width: `${overallProgress.percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. Workspace Mode Switcher & Reading Mode Controls */}
      <div className="wird-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={activeWorkspaceTab === 'reader'}
              onClick={() => setActiveWorkspaceTab('reader')}
              className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                activeWorkspaceTab === 'reader'
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white ring-1 ring-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              <span>القارئ السردي المتصل</span>
            </button>

            <button
              type="button"
              aria-pressed={activeWorkspaceTab === 'timeline'}
              onClick={() => setActiveWorkspaceTab('timeline')}
              className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                activeWorkspaceTab === 'timeline'
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white ring-1 ring-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
              }`}
            >
              <Layers className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              <span>فهرس الأجزاء والخط الزمني ({SEERAH_CHAPTERS.length})</span>
            </button>

            <button
              type="button"
              aria-pressed={activeWorkspaceTab === 'figures'}
              onClick={() => setActiveWorkspaceTab('figures')}
              className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                activeWorkspaceTab === 'figures'
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white ring-1 ring-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
              }`}
            >
              <Users className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              <span>الأعلام والأماكن والمصادر</span>
            </button>

            <button
              type="button"
              aria-pressed={activeWorkspaceTab === 'bookmarks'}
              onClick={() => setActiveWorkspaceTab('bookmarks')}
              className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                activeWorkspaceTab === 'bookmarks'
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white ring-1 ring-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
              }`}
            >
              <Bookmark className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              <span>العلامات المرجعية ({store.bookmarks.length})</span>
            </button>
          </div>

          {activeWorkspaceTab === 'reader' && (
            <div className="wird-segmented-track inline-flex items-center gap-1">
              <button
                type="button"
                aria-pressed={store.readingMode === 'continuous'}
                onClick={() => setStore(setSeerahReadingMode('continuous'))}
                className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  store.readingMode === 'continuous'
                    ? 'bg-[#1C4E46] text-white'
                    : 'text-[#5B6F6B] dark:text-[#98ADAA]'
                }`}
              >
                قراءة متصلة صافية
              </button>
              <button
                type="button"
                aria-pressed={store.readingMode === 'study'}
                onClick={() => setStore(setSeerahReadingMode('study'))}
                className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  store.readingMode === 'study'
                    ? 'bg-[#1C4E46] text-white'
                    : 'text-[#5B6F6B] dark:text-[#98ADAA]'
                }`}
              >
                قراءة وتعلّم وتوثيق
              </button>
            </div>
          )}
        </div>

        {/* Horizontal Chapter Rail for quick chapter switching in Reader mode */}
        {activeWorkspaceTab === 'reader' && (
          <HorizontalScrollRail ariaLabel="التنقل السريع بين فصول السيرة النبوية">
            {SEERAH_CHAPTERS.map(ch => {
              const isCurrent = ch.id === activeChapter.id;
              const isDone = store.completedChapterIds.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() => openChapter(ch.id)}
                  className={`min-h-11 shrink-0 snap-start px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    isCurrent
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                      : isDone
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-500/30'
                      : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                  }`}
                >
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  <span>{ch.order}. {ch.title.replace(/^الفصل [^:]+:\s*/, '')}</span>
                </button>
              );
            })}
          </HorizontalScrollRail>
        )}
      </div>

      {/* 3A. CONTINUOUS NARRATIVE READER VIEW */}
      {activeWorkspaceTab === 'reader' && (
        <article className="space-y-6">
          {/* Part Context Header */}
          <div className="wird-card p-5 md:p-6 bg-[#F2EDE2]/75 dark:bg-[#111F36] border border-[#C59B27]/35 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                {activePart.title}
              </span>
              <span className="font-mono text-[#5B6F6B] dark:text-[#98ADAA]">
                {activePart.periodLabel}
              </span>
            </div>
            <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA] leading-relaxed">
              {activePart.summary}
            </p>
          </div>

          {/* Chapter Main Book Sheet */}
          <div className="wird-card p-6 md:p-10 space-y-8">
            {/* Chapter Title & Metadata Header */}
            <header className="space-y-4 pb-6 border-b border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#1C4E46]/10 dark:bg-[#1E4A47]/60 text-[#1C4E46] dark:text-[#E0A96D] text-xs font-bold">
                    الفصل {activeChapter.order} من {SEERAH_CHAPTERS.length}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8]">
                    <Clock className="w-3.5 h-3.5 text-[#C59B27]" />
                    <span>{activeChapter.periodLabel}</span>
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full border text-[11px] font-bold ${
                      DATE_PRECISION_LABELS[activeChapter.datePrecision].style
                    }`}
                  >
                    {DATE_PRECISION_LABELS[activeChapter.datePrecision].label}
                  </span>
                </div>

                <button
                  type="button"
                  aria-pressed={isActiveChapterCompleted}
                  onClick={() => handleToggleCompleted(activeChapter.id)}
                  className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                    isActiveChapterCompleted
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isActiveChapterCompleted ? 'تم إتمام قراءة الفصل' : 'تسجيل الفصل كمقروء'}</span>
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black font-quran text-[#1C4E46] dark:text-[#F5F1E8] leading-snug">
                  {activeChapter.title}
                </h3>
                <p className="text-sm md:text-base font-semibold text-[#C59B27] dark:text-[#E0A96D]">
                  {activeChapter.subtitle}
                </p>
              </div>

              {/* Narrative Introduction & Historical Context */}
              <div className="p-4 md:p-5 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/80 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-2">
                <p className="text-sm md:text-base text-[#142421] dark:text-[#F5F1E8] leading-relaxed">
                  <strong className="text-[#1C4E46] dark:text-[#E0A96D]">مدخل الفصل: </strong>
                  {activeChapter.intro}
                </p>
                <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA] leading-relaxed">
                  <strong>تمهيد السياق: </strong>
                  {activeChapter.contextNote}
                </p>
              </div>
            </header>

            {/* Chapter Narrative Scenes */}
            <div className="space-y-8">
              {activeChapter.scenes.map(scene => {
                const bookmarkKey = `${activeChapter.id}:${scene.id}`;
                const isBookmarked = store.bookmarks.some(bm => bm.id === bookmarkKey);

                return (
                  <section
                    key={scene.id}
                    id={`seerah-scene-${scene.id}`}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg md:text-xl font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D]">
                        {scene.title}
                      </h4>
                      <button
                        type="button"
                        aria-pressed={isBookmarked}
                        aria-label={isBookmarked ? `إزالة علامة ${scene.title}` : `حفظ علامة في ${scene.title}`}
                        onClick={() => handleToggleSceneBookmark(activeChapter.id, scene.id)}
                        className={`min-h-11 px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isBookmarked
                            ? 'bg-[#C59B27]/15 border-[#C59B27] text-[#9A7415] dark:text-[#E0A96D]'
                            : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#98ADAA]'
                        }`}
                      >
                        {isBookmarked ? (
                          <>
                            <BookmarkCheck className="w-4 h-4" />
                            <span>محفوظ في العلامات</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4" />
                            <span>حفظ علامة</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {scene.bodyBlocks.map(block => {
                        if (block.type === 'quote_verified') {
                          return (
                            <blockquote
                              key={block.id}
                              className="p-5 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/90 border-r-4 border-[#C59B27] dark:border-[#E0A96D] space-y-2"
                            >
                              <p className="hadith-matn text-[#142421] dark:text-[#F5F1E8]">
                                {block.text}
                              </p>
                              {store.readingMode === 'study' && (
                                <div className="text-[11px] font-semibold text-[#5B6F6B] dark:text-[#98ADAA]">
                                  التوثيق: {block.sourceIds.map(sid => SEERAH_SOURCES[sid]?.workTitle).filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </blockquote>
                          );
                        }

                        if (block.type === 'uncertainty_note') {
                          return (
                            <div
                              key={block.id}
                              className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-xs md:text-sm text-[#142421] dark:text-[#F5F1E8] leading-relaxed"
                            >
                              <strong className="text-amber-800 dark:text-amber-300 block mb-1">
                                منهج التحقيق وضبط اختلاف الروايات:
                              </strong>
                              {block.text}
                            </div>
                          );
                        }

                        return (
                          <div key={block.id} className="space-y-1.5">
                            <p className="hadith-matn text-[#142421] dark:text-[#F5F1E8]">
                              {block.text}
                            </p>
                            {store.readingMode === 'study' && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">
                                {block.claimIds.map(cid => {
                                  const clm = SEERAH_CLAIMS[cid];
                                  if (!clm) return null;
                                  return (
                                    <span
                                      key={cid}
                                      className="px-2 py-0.5 rounded-md bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 font-semibold"
                                    >
                                      {clm.evidenceGrade}
                                    </span>
                                  );
                                })}
                                <span>
                                  المصادر: {block.sourceIds.map(sid => SEERAH_SOURCES[sid]?.workTitle).filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Closing Narrative Bridge */}
            <div className="p-5 rounded-2xl bg-gradient-to-l from-[#1C4E46]/10 to-[#C59B27]/10 dark:from-[#1E4A47]/35 dark:to-[#E0A96D]/10 border border-[#C59B27]/30 space-y-2">
              <span className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                خاتمة الفصل والجسر التاريخي لما بعده:
              </span>
              <p className="text-sm md:text-base text-[#142421] dark:text-[#F5F1E8] leading-relaxed">
                {activeChapter.closingNarrative}
              </p>
            </div>

            {/* Study Mode Sections: Lessons, Linked Figures/Places, Verified Claims & Sources, Optional Quiz */}
            {store.readingMode === 'study' && (
              <div className="space-y-6 pt-4 border-t border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
                {/* Pedagogical Lessons */}
                <div className="space-y-2.5">
                  <h4 className="text-sm font-bold text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    <span>فوائد ودروس منهجية من هذا الفصل</span>
                  </h4>
                  <ul className="space-y-2 text-xs md:text-sm text-[#142421] dark:text-[#F5F1E8]">
                    {activeChapter.lessons.map((lesson, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#C59B27] font-bold">•</span>
                        <span>{lesson}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Linked Figures & Places in this Chapter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-2.5">
                    <h5 className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>الأعلام والشخصيات في هذا الفصل</span>
                    </h5>
                    <div className="space-y-2">
                      {activeChapter.peopleIds.map(pid => {
                        const person = SEERAH_PEOPLE[pid];
                        if (!person) return null;
                        return (
                          <div key={pid} className="text-xs space-y-0.5">
                            <div className="font-bold text-[#142421] dark:text-[#F5F1E8]">
                              {person.name} <span className="text-[#C59B27] dark:text-[#E0A96D]">({person.epithet})</span>
                            </div>
                            <p className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">{person.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-2.5">
                    <h5 className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>المعالم والأماكن المرتبطة</span>
                    </h5>
                    <div className="space-y-2">
                      {activeChapter.placeIds.map(plId => {
                        const place = SEERAH_PLACES[plId];
                        if (!place) return null;
                        return (
                          <div key={plId} className="text-xs space-y-0.5">
                            <div className="font-bold text-[#142421] dark:text-[#F5F1E8]">
                              {place.name} <span className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">({place.region} · {place.precisionNote})</span>
                            </div>
                            <p className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">{place.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Claim-Level Sources Drawer */}
                <div className="p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-3">
                  <h5 className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>سجل التوثيق والمصادر الكلاسيكية المعتمدة في هذا الفصل</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    {chapterClaims.map(clm => (
                      <div key={clm.id} className="p-2.5 rounded-xl bg-white dark:bg-[#111F36] border border-[#1C4E46]/10 dark:border-[#E0A96D]/15 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">{clm.statement}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#1C4E46]/10 dark:bg-[#1E4A47] text-[#1C4E46] dark:text-[#E0A96D] text-[10px] font-bold">
                            {clm.evidenceGrade}
                          </span>
                        </div>
                        {clm.scholarlyNote && (
                          <p className="text-[11px] text-amber-800 dark:text-amber-300">
                            ملاحظة تحقيق: {clm.scholarlyNote}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">
                      {chapterSources.map(src => (
                        <span key={src.id} className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111F36] border border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
                          <strong>{src.workTitle}</strong> — {src.author} ({src.referenceLocator})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Optional End-of-Chapter Comprehension Quiz */}
                {activeChapter.quizQuestions.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/80 border border-[#C59B27]/35 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-bold text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-[#C59B27]" />
                        <span>وقفة فهم واسترجاع اختيارية (لا تقطع القراءة)</span>
                      </h5>
                      <span className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">مشتقة من الوقائع الثابتة في الفصل</span>
                    </div>

                    {activeChapter.quizQuestions.map(q => {
                      const chosenIdx = selectedQuizAnswers[q.id];
                      const hasAnswered = chosenIdx !== undefined;
                      const isCorrect = chosenIdx === q.correctIndex;

                      return (
                        <div key={q.id} className="space-y-3 text-xs">
                          <p className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8]">{q.prompt}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.choices.map((choice, idx) => {
                              const isSelected = chosenIdx === idx;
                              const isRightOption = idx === q.correctIndex;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedQuizAnswers(prev => ({ ...prev, [q.id]: idx }))}
                                  className={`min-h-11 p-3 rounded-xl border text-right font-semibold transition-all ${
                                    !hasAnswered
                                      ? 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                                      : isRightOption
                                      ? 'bg-emerald-600/15 border-emerald-600 text-emerald-900 dark:text-emerald-200'
                                      : isSelected
                                      ? 'bg-rose-600/15 border-rose-600 text-rose-900 dark:text-rose-200'
                                      : 'bg-white/60 dark:bg-[#111F36]/50 text-[#5B6F6B] dark:text-[#98ADAA] border-transparent'
                                  }`}
                                >
                                  {choice}
                                </button>
                              );
                            })}
                          </div>
                          {hasAnswered && (
                            <div
                              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                                isCorrect
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                              }`}
                            >
                              <strong>{isCorrect ? 'إجابة صحيحة: ' : 'التصويب والتوضيح: '}</strong>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Previous / Next Chapter Navigation Bar */}
            <footer className="pt-6 border-t border-[#1C4E46]/12 dark:border-[#E0A96D]/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {previousChapter ? (
                <button
                  type="button"
                  onClick={() => openChapter(previousChapter.id)}
                  className="min-h-14 p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:border-[#C59B27] text-right flex items-center justify-between gap-3 transition-all"
                >
                  <ChevronRight className="w-5 h-5 text-[#C59B27] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">الفصل السابق</div>
                    <div className="text-xs md:text-sm font-bold text-[#142421] dark:text-[#F5F1E8] truncate">
                      {previousChapter.title}
                    </div>
                  </div>
                </button>
              ) : (
                <div />
              )}

              {nextChapter ? (
                <button
                  type="button"
                  onClick={() => openChapter(nextChapter.id)}
                  className="min-h-14 p-4 rounded-2xl bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] text-white border border-[#C59B27]/40 text-right flex items-center justify-between gap-3 transition-all shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-[#F2EDE2]/80">الفصل التالي في الحكاية</div>
                    <div className="text-xs md:text-sm font-bold truncate">
                      {nextChapter.title}
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-[#E0A96D] shrink-0" />
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                  تمّ بحمد الله آخر فصول الكتاب — تقبل الله منك وحشرنا وإياك في زمرة نبيه ﷺ
                </div>
              )}
            </footer>
          </div>
        </article>
      )}

      {/* 3B. TIMELINE & PARTS DIRECTORY VIEW */}
      {activeWorkspaceTab === 'timeline' && (
        <div className="space-y-6">
          <div className="wird-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5B6F6B] dark:text-[#98ADAA] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="البحث في فصول ومشاهد السيرة النبوية"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن حدث، غزوة، شخصية، أو مرحلة زمنية..."
                className="w-full min-h-11 pr-10 pl-3 py-2 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-xs text-[#142421] dark:text-[#F5F1E8]"
              />
            </div>

            <select
              aria-label="تصفية حسب جزء السيرة"
              value={selectedPartFilter}
              onChange={e => setSelectedPartFilter(e.target.value)}
              className="min-h-11 px-3.5 py-2 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-xs font-bold text-[#142421] dark:text-[#F5F1E8]"
            >
              <option value="all">جميع أجزاء السيرة (5 أجزاء · 16 فصلاً)</option>
              {SEERAH_PARTS.map(part => (
                <option key={part.id} value={part.id}>{part.title}</option>
              ))}
            </select>
          </div>

          {SEERAH_PARTS.filter(part => selectedPartFilter === 'all' || part.id === selectedPartFilter).map(part => {
            const partChapters = getSeerahChaptersByPart(part.id).filter(ch =>
              filteredTimelineChapters.some(f => f.id === ch.id)
            );
            if (partChapters.length === 0) return null;

            return (
              <section key={part.id} className="wird-card p-6 space-y-4">
                <div className="border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D]">
                      {part.title}
                    </h3>
                    <span className="text-xs font-mono text-[#5B6F6B] dark:text-[#98ADAA]">
                      {part.periodLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA] mt-1">{part.summary}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {partChapters.map(ch => {
                    const isDone = store.completedChapterIds.includes(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className="p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono font-bold text-[#C59B27] dark:text-[#E0A96D]">
                              {ch.periodLabel}
                            </span>
                            {isDone && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>مقروء</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
                            {ch.title}
                          </h4>
                          <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA] leading-relaxed">
                            {ch.subtitle}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openChapter(ch.id)}
                          className="min-h-11 w-full px-4 py-2 rounded-xl bg-[#1C4E46] hover:bg-[#28665B] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>قراءة هذا الفصل</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* 3C. FIGURES, PLACES & CLASSICAL SOURCES DIRECTORY */}
      {activeWorkspaceTab === 'figures' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="wird-card p-6 space-y-4">
            <h3 className="text-base font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>الأعلام والصحابة الكرام</span>
            </h3>
            <div className="space-y-3">
              {Object.values(SEERAH_PEOPLE).map(person => (
                <div key={person.id} className="p-3.5 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-1.5 text-xs">
                  <div className="font-bold text-[#142421] dark:text-[#F5F1E8]">{person.name}</div>
                  <div className="text-[11px] font-semibold text-[#C59B27] dark:text-[#E0A96D]">{person.epithet}</div>
                  <p className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA] leading-relaxed">{person.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="wird-card p-6 space-y-4">
            <h3 className="text-base font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>الأماكن والمعالم الجغرافية الموثقة</span>
            </h3>
            <div className="space-y-3">
              {Object.values(SEERAH_PLACES).map(place => (
                <div key={place.id} className="p-3.5 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-1 text-xs">
                  <div className="font-bold text-[#142421] dark:text-[#F5F1E8]">{place.name}</div>
                  <div className="text-[11px] text-[#C59B27] dark:text-[#E0A96D]">{place.region} · {place.precisionNote}</div>
                  <p className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA] leading-relaxed">{place.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="wird-card p-6 space-y-4">
            <h3 className="text-base font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>سجل المصادر الكلاسيكية المعتمدة</span>
            </h3>
            <div className="space-y-3">
              {Object.values(SEERAH_SOURCES).map(src => (
                <div key={src.id} className="p-3.5 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-1 text-xs">
                  <div className="font-bold text-[#142421] dark:text-[#F5F1E8]">{src.workTitle}</div>
                  <div className="text-[11px] text-[#C59B27] dark:text-[#E0A96D]">{src.author}</div>
                  <div className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">{src.referenceLocator}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 3D. SAVED BOOKMARKS VIEW */}
      {activeWorkspaceTab === 'bookmarks' && (
        <section className="wird-card p-6 space-y-4">
          <h3 className="text-lg font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D] flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            <span>العلامات المرجعية المحفوظة في كتاب السيرة ({store.bookmarks.length})</span>
          </h3>

          {store.bookmarks.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-xs text-[#5B6F6B] dark:text-[#98ADAA]">
              <Bookmark className="w-8 h-8 text-[#C59B27] mx-auto" />
              <p>لم تحفظ أي علامة مرجعية بعد. اضغط «حفظ علامة» بجانب أي مشهد أثناء القراءة للرجوع إليه لاحقاً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {store.bookmarks.map(bm => (
                <div
                  key={bm.id}
                  className="p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8] truncate">
                      {bm.title}
                    </div>
                    <div className="text-[10px] font-mono text-[#5B6F6B] dark:text-[#98ADAA]">
                      الإصدار {bm.bookVersion}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openChapter(bm.chapterId, bm.sceneId)}
                      className="min-h-11 px-3.5 py-1.5 rounded-xl bg-[#1C4E46] text-white text-xs font-bold"
                    >
                      انتقال
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSceneBookmark(bm.chapterId, bm.sceneId)}
                      className="min-h-11 px-3 py-1.5 rounded-xl bg-[#F2EDE2] dark:bg-[#162744] text-xs font-bold text-rose-700 dark:text-rose-300"
                    >
                      إزالة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
