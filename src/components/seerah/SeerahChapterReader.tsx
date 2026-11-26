import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Type,
  Users
} from 'lucide-react';
import type {
  SeerahBookManifest,
  SeerahChapterDocument,
  SeerahDatePrecision,
  SeerahFontSize
} from '../../services/seerahBookService';

const FONT_SIZE_STYLES: Record<SeerahFontSize, string> = {
  sm: 'text-base md:text-[17px] leading-[2.1]',
  md: 'text-[17px] md:text-[19px] leading-[2.25]',
  lg: 'text-lg md:text-[21px] leading-[2.35]',
  xl: 'text-xl md:text-[24px] leading-[2.45]',
};

const FONT_SIZE_LABELS: Record<SeerahFontSize, string> = {
  sm: 'صغير',
  md: 'متوسط',
  lg: 'كبير',
  xl: 'مكبر',
};

const PRECISION_LABELS: Record<SeerahDatePrecision, string> = {
  exact: 'تاريخ مضبوط ومثبت',
  approximate: 'تاريخ تقريبي عند أهل السير',
  range: 'نطاق زمني مرحلي',
  disputed: 'فيه تفصيل واختلاف تاريخي',
};

interface SeerahChapterReaderProps {
  manifest: SeerahBookManifest;
  chapter: SeerahChapterDocument | null;
  loading: boolean;
  error: string | null;
  isCompleted: boolean;
  fontSize: SeerahFontSize;
  initialSceneId?: string;
  onChangeFontSize: (size: SeerahFontSize) => void;
  onToggleCompleted: (chapterId: string) => void;
  onOpenChapter: (chapterId: string, sceneId?: string) => void;
  onOpenCharacter: (characterId: string) => void;
  onBackToIndex: () => void;
  onSceneFocus?: (sceneId: string) => void;
}

export const SeerahChapterReader: React.FC<SeerahChapterReaderProps> = ({
  manifest,
  chapter,
  loading,
  error,
  isCompleted,
  fontSize,
  initialSceneId,
  onChangeFontSize,
  onToggleCompleted,
  onOpenChapter,
  onOpenCharacter,
  onBackToIndex,
  onSceneFocus,
}) => {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const section = useMemo(
    () => (chapter ? manifest.sections.find((s) => s.id === chapter.sectionId) : undefined),
    [manifest.sections, chapter]
  );
  const era = useMemo(
    () => (chapter ? manifest.eras.find((e) => e.id === chapter.eraId) : undefined),
    [manifest.eras, chapter]
  );

  const charMap = useMemo(
    () => new Map(manifest.characters.map((c) => [c.id, c])),
    [manifest.characters]
  );
  const placeMap = useMemo(
    () => new Map(manifest.places.map((p) => [p.id, p])),
    [manifest.places]
  );
  const sourceMap = useMemo(
    () => new Map(manifest.sources.map((s) => [s.id, s])),
    [manifest.sources]
  );

  const prevCard = useMemo(
    () =>
      chapter?.previousChapterId
        ? manifest.chapters.find((c) => c.id === chapter.previousChapterId)
        : undefined,
    [manifest.chapters, chapter]
  );
  const nextCard = useMemo(
    () =>
      chapter?.nextChapterId
        ? manifest.chapters.find((c) => c.id === chapter.nextChapterId)
        : undefined,
    [manifest.chapters, chapter]
  );

  useEffect(() => {
    setSourcesExpanded(false);
    if (!chapter) return;
    if (initialSceneId) {
      const el = document.getElementById(`seerah-scene-${initialSceneId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [chapter?.id, initialSceneId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto wird-card p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--wird-accent)]" />
        <p className="text-sm font-bold text-[var(--wird-text)]">جارٍ فتح صفحات الفصل…</p>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="max-w-3xl mx-auto wird-card p-8 text-center space-y-4">
        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
          {error || 'تعذر فتح هذا الفصل حالياً.'}
        </p>
        <button
          type="button"
          onClick={onBackToIndex}
          className="min-h-11 px-5 py-2.5 rounded-xl bg-[var(--wird-primary)] text-white text-xs font-bold inline-flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى فهرس السيرة</span>
        </button>
      </div>
    );
  }

  const chapterCharacters = chapter.characterIds
    .map((id) => charMap.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const chapterPlaces = chapter.placeIds
    .map((id) => placeMap.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const chapterSources = chapter.sourceIds
    .map((id) => sourceMap.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div id="seerah-chapter-reader" className="max-w-4xl mx-auto space-y-6">
      {/* Top Calm Book Navigation & Reading Controls */}
      <nav
        aria-label="شريط التحكم بالقراءة"
        className="wird-card px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          onClick={onBackToIndex}
          className="min-h-10 px-3.5 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-2 transition-colors"
        >
          <ArrowRight className="w-4 h-4 text-[var(--wird-accent)]" />
          <span>فهرس فصول السيرة</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="حجم خط القراءة"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]"
          >
            <Type className="w-3.5 h-3.5 text-[var(--wird-muted)] mx-1" />
            {(['sm', 'md', 'lg', 'xl'] as SeerahFontSize[]).map((sz) => (
              <button
                key={sz}
                type="button"
                aria-pressed={fontSize === sz}
                onClick={() => onChangeFontSize(sz)}
                className={`min-h-8 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                  fontSize === sz
                    ? 'bg-[var(--wird-primary)] text-white'
                    : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                }`}
              >
                {FONT_SIZE_LABELS[sz]}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={isCompleted}
            onClick={() => onToggleCompleted(chapter.id)}
            className={`min-h-10 px-4 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              isCompleted
                ? 'bg-emerald-700 text-white'
                : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? 'مقروء (إلغاء التحديد)' : 'تحديد الفصل كمقروء'}</span>
          </button>
        </div>
      </nav>

      {/* Main Digital Book Sheet */}
      <article className="wird-card px-5 py-8 sm:px-10 sm:py-12 md:px-14 md:py-14 space-y-10">
        {/* Chapter Heading */}
        <header className="space-y-4 pb-8 border-b border-[var(--wird-border)] text-center max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {era && (
              <span className="px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-semibold text-[var(--wird-muted)]">
                {era.title.split(':')[0]}
              </span>
            )}
            {section && (
              <span className="px-3 py-1 rounded-full bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/35 font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                {section.title}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-mono text-[11px] text-[var(--wird-muted)]">
              الفصل {chapter.order} من {manifest.totalChapters}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-editorial-ar text-[var(--wird-primary)] dark:text-[var(--wird-text)] leading-snug">
            {chapter.title}
          </h1>

          <p className="text-sm sm:text-base font-semibold text-[var(--wird-accent)] leading-relaxed">
            {chapter.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-xs text-[var(--wird-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
              <span>{chapter.periodLabel}</span>
            </span>
            <span>·</span>
            <span>{PRECISION_LABELS[chapter.datePrecision]}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
              <span>نحو {chapter.estimatedReadingMinutes} دقائق قراءة</span>
            </span>
          </div>
        </header>

        {/* Opening Narrative Hook & Context */}
        <div className="max-w-3xl mx-auto space-y-5">
          <p
            className={`font-editorial-ar font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] ${FONT_SIZE_STYLES[fontSize]}`}
          >
            {chapter.openingHook}
          </p>
          <div className="p-5 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]">
            <p className="text-xs sm:text-sm text-[var(--wird-muted)] leading-relaxed">
              <strong className="text-[var(--wird-text)]">مدخل السياق التاريخي: </strong>
              {chapter.historicalContext}
            </p>
          </div>
        </div>

        {/* Narrative Scenes */}
        <div className="max-w-3xl mx-auto space-y-12">
          {chapter.scenes.map((scene, sIdx) => (
            <section
              key={scene.id}
              id={`seerah-scene-${scene.id}`}
              onMouseEnter={() => onSceneFocus?.(scene.id)}
              className="space-y-6 scroll-mt-24"
            >
              {sIdx > 0 && (
                <div className="flex items-center justify-center gap-3 py-2" aria-hidden="true">
                  <span className="h-px w-16 bg-[var(--wird-border)]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--wird-accent)]/60" />
                  <span className="h-px w-16 bg-[var(--wird-border)]" />
                </div>
              )}

              <h2 className="text-xl sm:text-2xl font-bold font-editorial-ar text-[var(--wird-primary)] dark:text-[var(--wird-accent)] leading-snug">
                {scene.title}
              </h2>

              <div className="space-y-6">
                {scene.blocks.map((block) => {
                  if (block.type === 'quran') {
                    return (
                      <div key={block.id} className="space-y-2.5 my-6">
                        {block.leadIn && (
                          <p className={`font-editorial-ar text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]}`}>
                            {block.leadIn}
                          </p>
                        )}
                        <figure className="p-6 sm:p-7 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] space-y-3">
                          <blockquote
                            lang="ar"
                            dir="rtl"
                            className={`quran-text font-quran text-center text-[var(--wird-primary)] dark:text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]}`}
                          >
                            ﴿ {block.verbatimText} ﴾
                          </blockquote>
                          <figcaption className="text-center text-xs font-semibold text-[var(--wird-accent)]">
                            القرآن الكريم — {block.reference}
                          </figcaption>
                        </figure>
                      </div>
                    );
                  }

                  if (block.type === 'hadith') {
                    return (
                      <div key={block.id} className="space-y-2.5 my-6">
                        {block.leadIn && (
                          <p className={`font-editorial-ar text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]}`}>
                            {block.leadIn}
                          </p>
                        )}
                        <figure className="p-5 sm:p-6 rounded-2xl bg-[var(--wird-surface-muted)] border-r-4 border-[var(--wird-border-gold)] space-y-2.5">
                          <blockquote className={`font-editorial-ar text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]}`}>
                            «{block.verbatimText}»
                          </blockquote>
                          <figcaption className="text-xs font-semibold text-[var(--wird-muted)]">
                            المصدر الموثق: {block.reference} (السيرة النبوية لابن كثير ج {block.encyclopediaLocator.volume} ص{' '}
                            {block.encyclopediaLocator.page})
                          </figcaption>
                        </figure>
                      </div>
                    );
                  }

                  if (block.type === 'uncertainty_note') {
                    return (
                      <aside
                        key={block.id}
                        className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-[var(--wird-text)] leading-relaxed"
                      >
                        <strong className="text-amber-800 dark:text-amber-300 block mb-1">
                          إضاءة تحقيقية وضبط للروايات:
                        </strong>
                        {block.text}
                      </aside>
                    );
                  }

                  return (
                    <p
                      key={block.id}
                      className={`font-editorial-ar text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]}`}
                    >
                      {block.text}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Closing Narrative Bridge */}
        <div className="max-w-3xl mx-auto pt-4">
          <div className="p-6 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] space-y-2">
            <span className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              تمهيد لما بعده في مسيرة السيرة:
            </span>
            <p className={`font-editorial-ar text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]}`}>
              {chapter.closingBridge}
            </p>
          </div>
        </div>

        {/* Key Reflections & Bidirectional Character / Place Pills */}
        <div className="max-w-3xl mx-auto pt-6 border-t border-[var(--wird-border)] space-y-6">
          {chapter.keyTakeaways.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                خلاصات ومعانٍ من هذا الفصل
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-[var(--wird-text)] leading-relaxed">
                {chapter.keyTakeaways.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[var(--wird-accent)] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bidirectional Character Links */}
          {chapterCharacters.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[var(--wird-muted)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--wird-accent)]" />
                <span>شخصيات هذا الفصل (اضغط لفتح حكاية الشخصية الكاملة):</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {chapterCharacters.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onOpenCharacter(person.id)}
                    className="min-h-10 px-3.5 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-primary)] hover:text-white border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] transition-colors inline-flex items-center gap-2"
                  >
                    <span>{person.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {chapterPlaces.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--wird-muted)]">
              <span className="inline-flex items-center gap-1 font-bold">
                <MapPin className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                <span>المعالم الجغرافية:</span>
              </span>
              {chapterPlaces.map((pl) => (
                <span
                  key={pl.id}
                  className="px-2.5 py-1 rounded-lg bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px]"
                >
                  {pl.name} ({pl.region})
                </span>
              ))}
            </div>
          )}

          {/* Calm Collapsible Sources Reference */}
          <div className="rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] overflow-hidden">
            <button
              type="button"
              aria-expanded={sourcesExpanded}
              onClick={() => setSourcesExpanded((v) => !v)}
              className="w-full min-h-11 px-4 py-3 flex items-center justify-between text-xs font-bold text-[var(--wird-text)]"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--wird-accent)]" />
                <span>المصادر والمواضع المرجعية لهذا الفصل ({chapterSources.length})</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[var(--wird-muted)] transition-transform ${
                  sourcesExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
            {sourcesExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-[var(--wird-border)] space-y-2 text-xs text-[var(--wird-muted)]">
                <p>
                  مواضع التحقيق في «السيرة النبوية لابن كثير»:{' '}
                  {chapter.encyclopediaSourceRefs
                    .map((r) => `المجلد ${r.volume} (ص ${r.startPage}–${r.endPage})`)
                    .join(' · ')}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {chapterSources.map((src) => (
                    <span
                      key={src.id}
                      className="px-2.5 py-1 rounded-lg bg-[var(--wird-surface)] border border-[var(--wird-border)] text-[11px]"
                    >
                      <strong className="text-[var(--wird-text)]">{src.workTitle}</strong> — {src.author}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Read Action + Previous / Next Chapter Navigation */}
        <footer className="max-w-3xl mx-auto pt-6 border-t border-[var(--wird-border)] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              type="button"
              aria-pressed={isCompleted}
              onClick={() => onToggleCompleted(chapter.id)}
              className={`min-h-11 px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors ${
                isCompleted
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isCompleted ? 'تمت قراءة هذا الفصل (إلغاء التحديد)' : 'إتمام قراءة هذا الفصل'}</span>
            </button>

            <button
              type="button"
              onClick={onBackToIndex}
              className="min-h-11 px-4 py-2 rounded-xl text-xs font-bold text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
            >
              العودة إلى فهرس الفصول
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prevCard ? (
              <button
                type="button"
                onClick={() => onOpenChapter(prevCard.id)}
                className="min-h-14 p-4 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-right flex items-center justify-between gap-3 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-[var(--wird-accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-[var(--wird-muted)]">الفصل السابق ({prevCard.order})</div>
                  <div className="text-xs sm:text-sm font-bold text-[var(--wird-text)] truncate">
                    {prevCard.title}
                  </div>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextCard ? (
              <button
                type="button"
                onClick={() => onOpenChapter(nextCard.id)}
                className="min-h-14 p-4 rounded-2xl bg-[var(--wird-primary)] text-white border border-[var(--wird-border-gold)] text-right flex items-center justify-between gap-3 transition-all shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-white/80">الفصل التالي ({nextCard.order})</div>
                  <div className="text-xs sm:text-sm font-bold truncate">{nextCard.title}</div>
                </div>
                <ChevronLeft className="w-5 h-5 text-[var(--wird-accent)] shrink-0" />
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                تمّ بحمد الله ختام فصول السيرة النبوية الشريفة — صلى الله عليه وسلم
              </div>
            )}
          </div>
        </footer>
      </article>
    </div>
  );
};
