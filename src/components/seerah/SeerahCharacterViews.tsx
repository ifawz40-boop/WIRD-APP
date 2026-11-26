import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  ChevronLeft,
  Clock,
  Loader2,
  Search,
  Type,
  Users
} from 'lucide-react';
import {
  normalizeSeerahSearchText,
  type SeerahBookManifest,
  type SeerahCharacterDocument,
  type SeerahFontSize
} from '../../services/seerahBookService';
import {
  buildCharacterAudioSegments,
  type SeerahAudioSegment
} from '../../services/seerahAudioNarratorService';
import { SeerahAudioPlayerBar } from './SeerahAudioPlayerBar';

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

interface SeerahCharacterDirectoryProps {
  manifest: SeerahBookManifest;
  onOpenCharacter: (characterId: string) => void;
  onBackToBook: () => void;
}

export const SeerahCharacterDirectory: React.FC<SeerahCharacterDirectoryProps> = ({
  manifest,
  onOpenCharacter,
  onBackToBook,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of manifest.characters) set.add(c.category);
    return Array.from(set);
  }, [manifest.characters]);

  const filtered = useMemo(() => {
    const normQ = normalizeSeerahSearchText(query);
    return manifest.characters.filter((c) => {
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (!normQ) return true;
      return normalizeSeerahSearchText(`${c.name} ${c.epithet} ${c.summary} ${c.category}`).includes(
        normQ
      );
    });
  }, [manifest.characters, query, selectedCategory]);

  return (
    <div id="seerah-character-directory" className="max-w-5xl mx-auto space-y-6">
      <div className="wird-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold font-quran text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>دليل شخصيات السيرة النبوية ({manifest.totalCharacters} شخصية)</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--wird-muted)]">
              تراجم وحكايات سردية متصلة لأبرز الصحابة وأمهات المؤمنين وآل البيت وشخصيات العهد النبوي، مرتبطة مباشرة بفصول السيرة.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToBook}
            className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 text-[var(--wird-accent)]" />
            <span>العودة إلى كتاب السيرة</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="ابحث في دليل شخصيات السيرة"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الشخصية أو لقبها أو دورها..."
              className="w-full min-h-11 pr-10 pl-3 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs sm:text-sm text-[var(--wird-text)]"
            />
          </div>

          <select
            aria-label="تصفية حسب فئة الشخصيات"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-h-11 px-3.5 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)]"
          >
            <option value="all">جميع الفئات ({manifest.totalCharacters})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="wird-card p-10 text-center text-xs sm:text-sm text-[var(--wird-muted)]">
          لا توجد شخصيات مطابقة لبحثك الحالي.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onOpenCharacter(person.id)}
              className="wird-card p-5 text-right hover:border-[var(--wird-border-gold)] transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-semibold text-[var(--wird-muted)]">
                    {person.category}
                  </span>
                  <span className="font-mono text-[var(--wird-muted)]">
                    {person.estimatedReadingMinutes} د قراءة · {person.linkedChapterIds.length} فصول مرتبطة
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold font-quran text-[var(--wird-primary)] dark:text-[var(--wird-text)]">
                  {person.name}
                </h2>
                <div className="text-xs font-bold text-[var(--wird-accent)]">{person.epithet}</div>
                <p className="text-xs text-[var(--wird-muted)] leading-relaxed line-clamp-2">
                  {person.summary}
                </p>
              </div>

              <div className="pt-2 border-t border-[var(--wird-border)] flex items-center justify-between text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                <span>قراءة القصة الكاملة</span>
                <ChevronLeft className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface SeerahCharacterProfileProps {
  manifest: SeerahBookManifest;
  character: SeerahCharacterDocument | null;
  loading: boolean;
  error: string | null;
  fontSize: SeerahFontSize;
  onChangeFontSize: (size: SeerahFontSize) => void;
  onOpenChapter: (chapterId: string) => void;
  onBackToDirectory: () => void;
  onBackToBook: () => void;
}

export const SeerahCharacterProfile: React.FC<SeerahCharacterProfileProps> = ({
  manifest,
  character,
  loading,
  error,
  fontSize,
  onChangeFontSize,
  onOpenChapter,
  onBackToDirectory,
  onBackToBook,
}) => {
  const chapterMap = useMemo(
    () => new Map(manifest.chapters.map((c) => [c.id, c])),
    [manifest.chapters]
  );
  const [activeAudioDomId, setActiveAudioDomId] = useState<string | null>(null);
  const audioSegments = useMemo(
    () => (character ? buildCharacterAudioSegments(character) : []),
    [character]
  );
  const handleActiveAudioSegment = useCallback((seg: SeerahAudioSegment | null) => {
    const nextDomId = seg?.domElementId ?? null;
    setActiveAudioDomId(nextDomId);
    if (nextDomId && typeof document !== 'undefined') {
      document.getElementById(nextDomId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto wird-card p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--wird-accent)]" />
        <p className="text-sm font-bold text-[var(--wird-text)]">جارٍ فتح سيرة الشخصية…</p>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="max-w-3xl mx-auto wird-card p-8 text-center space-y-4">
        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
          {error || 'تعذر العثور على هذه الشخصية.'}
        </p>
        <button
          type="button"
          onClick={onBackToDirectory}
          className="min-h-11 px-5 py-2.5 rounded-xl bg-[var(--wird-primary)] text-white text-xs font-bold inline-flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى دليل الشخصيات</span>
        </button>
      </div>
    );
  }

  const linkedChapters = character.linkedChapterIds
    .map((id) => chapterMap.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div id="seerah-character-profile" className="max-w-4xl mx-auto space-y-6">
      <nav
        aria-label="التنقل في سيرة الشخصية"
        className="wird-card px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToDirectory}
            className="min-h-10 px-3.5 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 text-[var(--wird-accent)]" />
            <span>دليل الشخصيات</span>
          </button>

          <button
            type="button"
            onClick={onBackToBook}
            className="min-h-10 px-3.5 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
          >
            فهرس كتاب السيرة
          </button>
        </div>

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
      </nav>

      <SeerahAudioPlayerBar
        docKey={character.id}
        titleAr={character.name}
        segments={audioSegments}
        onActiveSegmentChange={handleActiveAudioSegment}
      />

      <article className="wird-card px-5 py-8 sm:px-10 sm:py-12 md:px-14 space-y-9">
        <header
          id={`seerah-char-intro-${character.id}`}
          className={`space-y-3 pb-7 border-b border-[var(--wird-border)] text-center max-w-2xl mx-auto transition-all ${
            activeAudioDomId === `seerah-char-intro-${character.id}`
              ? 'ring-2 ring-[var(--wird-accent)]/60 bg-[var(--wird-accent-soft)]/30 rounded-2xl p-4'
              : ''
          }`}
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-semibold text-[var(--wird-muted)]">
            {character.category}
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-editorial-ar text-[var(--wird-primary)] dark:text-[var(--wird-text)] leading-snug">
            {character.name}
          </h1>
          <p className="text-sm sm:text-base font-bold text-[var(--wird-accent)]">
            {character.epithet}
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-[var(--wird-muted)] pt-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
              <span>نحو {character.estimatedReadingMinutes} دقائق قراءة</span>
            </span>
            <span>·</span>
            <span>{character.encyclopediaStats.pagesCount} موضعاً في الموسوعة المرجعية</span>
          </div>
        </header>

        {/* Introduction & Context Cards */}
        <div className="max-w-3xl mx-auto space-y-5">
          <p
            className={`font-editorial-ar font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] ${FONT_SIZE_STYLES[fontSize]}`}
          >
            {character.introduction}
          </p>

          <div
            id={`seerah-char-context-${character.id}`}
            className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all ${
              activeAudioDomId === `seerah-char-context-${character.id}`
                ? 'ring-2 ring-[var(--wird-accent)]/60 rounded-2xl p-2'
                : ''
            }`}
          >
            <div className="p-5 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] space-y-1.5">
              <h2 className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                النشأة والخلفية التاريخية
              </h2>
              <p className="text-xs sm:text-sm text-[var(--wird-text)] leading-relaxed">
                {character.backgroundAndContext}
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] space-y-1.5">
              <h2 className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                صلته ومكانته عند رسول الله ﷺ
              </h2>
              <p className="text-xs sm:text-sm text-[var(--wird-text)] leading-relaxed">
                {character.relationshipWithProphet}
              </p>
            </div>
          </div>
        </div>

        {/* Continuous Independent Character Narrative */}
        <section className="max-w-3xl mx-auto space-y-5">
          <h2 className="text-xl sm:text-2xl font-bold font-editorial-ar text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
            الحكاية التاريخية الكاملة
          </h2>
          <div className="space-y-6">
            {character.narrativeStoryParagraphs.map((para, idx) => (
              <p
                key={idx}
                id={`seerah-char-para-${idx}`}
                className={`font-editorial-ar text-[var(--wird-text)] ${FONT_SIZE_STYLES[fontSize]} ${
                  activeAudioDomId === `seerah-char-para-${idx}`
                    ? 'ring-2 ring-[var(--wird-accent)]/65 bg-[var(--wird-accent-soft)]/35 rounded-2xl p-3 -mx-3 transition-all'
                    : ''
                }`}
              >
                {para}
              </p>
            ))}
          </div>
        </section>

        {/* Documented Virtues */}
        {character.documentedVirtues.length > 0 && (
          <section
            id={`seerah-char-virtues-${character.id}`}
            className={`max-w-3xl mx-auto p-5 sm:p-6 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] space-y-3 ${
              activeAudioDomId === `seerah-char-virtues-${character.id}`
                ? 'ring-2 ring-[var(--wird-accent)]'
                : ''
            }`}
          >
            <h2 className="text-sm font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--wird-accent)]" />
              <span>مناقب وإسهامات موثقة</span>
            </h2>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--wird-text)] leading-relaxed">
              {character.documentedVirtues.map((v, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-[var(--wird-accent)] font-bold">•</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Chronological Personal Journey with Bidirectional Links to Seerah Chapters */}
        {character.chronologicalMoments.length > 0 && (
          <section className="max-w-3xl mx-auto space-y-4 pt-4 border-t border-[var(--wird-border)]">
            <h2 className="text-lg sm:text-xl font-bold font-quran text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              محطات الرحلة وربطها بفصول السيرة
            </h2>
            <div className="space-y-3">
              {character.chronologicalMoments.map((moment) => {
                const targetChapter = chapterMap.get(moment.chapterId);
                return (
                  <div
                    key={moment.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-mono font-bold text-[var(--wird-accent)]">
                          {moment.periodLabel}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold font-quran text-[var(--wird-text)]">
                        {moment.title}
                      </h3>
                      <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                        {moment.description}
                      </p>
                    </div>

                    {targetChapter && (
                      <button
                        type="button"
                        onClick={() => onOpenChapter(targetChapter.id)}
                        className="min-h-10 px-3.5 py-2 rounded-xl bg-[var(--wird-primary)] text-white text-xs font-bold shrink-0 inline-flex items-center gap-1.5 self-start sm:self-center"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                        <span>الفصل {targetChapter.order}: {targetChapter.title}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* All Linked Chapters Strip */}
        {linkedChapters.length > 0 && (
          <section className="max-w-3xl mx-auto pt-4 border-t border-[var(--wird-border)] space-y-3">
            <h2 className="text-xs font-bold text-[var(--wird-muted)]">
              جميع فصول السيرة المرتبطة بهذه الشخصية ({linkedChapters.length}):
            </h2>
            <div className="flex flex-wrap gap-2">
              {linkedChapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onOpenChapter(ch.id)}
                  className="min-h-10 px-3.5 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                  <span>{ch.order}. {ch.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
};
