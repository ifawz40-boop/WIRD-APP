import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  HardDrive,
  Hash,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  Search,
  StickyNote,
  Type,
  X
} from 'lucide-react';
import {
  cacheSeerahVolumeOffline,
  findSectionForVolumePage,
  getEncyclopediaProgressSummary,
  getSeerahVolumeOfflineStatus,
  loadSeerahEncyclopediaSectionPages,
  normalizeArabicSearchQuery,
  saveEncyclopediaPosition,
  searchSeerahEncyclopedia,
  setEncyclopediaFocusMode,
  setEncyclopediaFontSize,
  toggleEncyclopediaBookmark,
  toggleEncyclopediaSectionRead,
  updateEncyclopediaBookmarkNote,
  type SeerahEncyclopediaFontSize,
  type SeerahEncyclopediaManifest,
  type SeerahEncyclopediaOfflineStatus,
  type SeerahEncyclopediaPage,
  type SeerahEncyclopediaProgressStore,
  type SeerahEncyclopediaSearchHit,
  type SeerahEncyclopediaSection,
  type SeerahEncyclopediaToc
} from '../../services/seerahEncyclopediaService';

const PAGES_PER_VIEW = 10;

const FONT_SIZE_CLASSES: Record<SeerahEncyclopediaFontSize, string> = {
  sm: 'text-sm md:text-[15px] leading-[2.05]',
  md: 'text-base md:text-[17px] leading-[2.15]',
  lg: 'text-lg md:text-[19px] leading-[2.25]',
  xl: 'text-xl md:text-[22px] leading-[2.35]',
};

const FONT_SIZE_LABELS: Record<SeerahEncyclopediaFontSize, string> = {
  sm: 'صغير',
  md: 'متوسط',
  lg: 'كبير',
  xl: 'مكبر',
};

export interface SeerahEncyclopediaJumpTarget {
  volume: number;
  page: number;
  sectionId?: string;
  nonce: number;
}

interface SeerahEncyclopediaReaderProps {
  manifest: SeerahEncyclopediaManifest | null;
  toc: SeerahEncyclopediaToc | null;
  loadingMeta: boolean;
  metaError: string | null;
  store: SeerahEncyclopediaProgressStore;
  onStoreChange: (next: SeerahEncyclopediaProgressStore) => void;
  jumpTarget: SeerahEncyclopediaJumpTarget | null;
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

function isPoetryLine(text: string): boolean {
  return text.includes(' * ') && text.length <= 220;
}

function isOpeningBasmalah(text: string): boolean {
  return text === 'بسم الله الرحمن الرحيم' || text.startsWith('بسم الله الرحمن الرحيم وصلى الله');
}

export const SeerahEncyclopediaReader: React.FC<SeerahEncyclopediaReaderProps> = ({
  manifest,
  toc,
  loadingMeta,
  metaError,
  store,
  onStoreChange,
  jumpTarget,
  onToast,
}) => {
  const [activeVolume, setActiveVolume] = useState<number>(() => store.lastPosition?.volume || 1);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => store.lastPosition?.sectionId || 'v1-sec-001'
  );
  const [activePageTarget, setActivePageTarget] = useState<number>(
    () => store.lastPosition?.page || 1
  );
  const [sectionPages, setSectionPages] = useState<SeerahEncyclopediaPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pageWindowIndex, setPageWindowIndex] = useState(0);

  // TOC filtering & mobile toggle
  const [tocFilter, setTocFilter] = useState('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Direct page jump input
  const [jumpPageInput, setJumpPageInput] = useState('');

  // Full-text search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchVolumeScope, setSearchVolumeScope] = useState<number | 'all'>('all');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SeerahEncyclopediaSearchHit[] | null>(null);
  const [lastSearchedTerm, setLastSearchedTerm] = useState('');

  // Bookmark note editor
  const [editingNoteBookmarkId, setEditingNoteBookmarkId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Offline status for active volume
  const [offlineStatus, setOfflineStatus] = useState<SeerahEncyclopediaOfflineStatus | null>(null);
  const [cachingVolume, setCachingVolume] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<{ completed: number; total: number } | null>(null);

  const readerTopRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const progressSummary = useMemo(
    () => getEncyclopediaProgressSummary(store, toc),
    [store, toc]
  );

  const volumeSections = useMemo(() => {
    if (!toc) return [];
    return toc.sections.filter((s) => s.volume === activeVolume);
  }, [toc, activeVolume]);

  const filteredVolumeSections = useMemo(() => {
    const q = normalizeArabicSearchQuery(tocFilter);
    if (!q) return volumeSections;
    return volumeSections.filter((s) =>
      normalizeArabicSearchQuery(`${s.title} ${s.eraTag}`).includes(q)
    );
  }, [volumeSections, tocFilter]);

  const activeSection: SeerahEncyclopediaSection | null = useMemo(() => {
    if (!toc || toc.sections.length === 0) return null;
    return (
      toc.sections.find((s) => s.id === activeSectionId) ||
      volumeSections[0] ||
      toc.sections[0]
    );
  }, [toc, activeSectionId, volumeSections]);

  const activeVolumeMeta = useMemo(
    () => manifest?.volumes.find((v) => v.volume === activeVolume) || null,
    [manifest, activeVolume]
  );

  const { prevSection, nextSection } = useMemo(() => {
    if (!toc || !activeSection) return { prevSection: null, nextSection: null };
    const idx = toc.sections.findIndex((s) => s.id === activeSection.id);
    return {
      prevSection: idx > 0 ? toc.sections[idx - 1] : null,
      nextSection: idx >= 0 && idx < toc.sections.length - 1 ? toc.sections[idx + 1] : null,
    };
  }, [toc, activeSection]);

  const navigateToSection = useCallback(
    (section: SeerahEncyclopediaSection, targetPage?: number) => {
      const page = targetPage ?? section.startPage;
      setActiveVolume(section.volume);
      setActiveSectionId(section.id);
      setActivePageTarget(page);
      setMobileTocOpen(false);
      onStoreChange(saveEncyclopediaPosition(section.volume, page, section.id));
    },
    [onStoreChange]
  );

  // Handle external deep-link jumps (from curated chapters or bookmarks tab)
  useEffect(() => {
    if (!jumpTarget || !toc) return;
    const sec =
      (jumpTarget.sectionId ? toc.sections.find((s) => s.id === jumpTarget.sectionId) : null) ||
      findSectionForVolumePage(toc, jumpTarget.volume, jumpTarget.page);
    if (sec) {
      navigateToSection(sec, jumpTarget.page);
    }
  }, [jumpTarget, toc, navigateToSection]);

  // Load section pages lazily whenever activeSection changes
  useEffect(() => {
    if (!activeSection) return;
    const seq = ++requestSeqRef.current;
    setLoadingPages(true);
    setPagesError(null);

    loadSeerahEncyclopediaSectionPages(activeSection)
      .then((pages) => {
        if (seq !== requestSeqRef.current) return;
        setSectionPages(pages);
        const targetIdx = pages.findIndex((p) => p.page >= activePageTarget);
        const winIdx = targetIdx >= 0 ? Math.floor(targetIdx / PAGES_PER_VIEW) : 0;
        setPageWindowIndex(winIdx);
        setLoadingPages(false);
      })
      .catch((err) => {
        if (seq !== requestSeqRef.current) return;
        setPagesError(err instanceof Error ? err.message : 'تعذر تحميل صفحات هذا الباب.');
        setLoadingPages(false);
      });
  }, [activeSection, activePageTarget]);

  // Check offline cache status for active volume
  useEffect(() => {
    if (!manifest) return;
    let alive = true;
    void getSeerahVolumeOfflineStatus(manifest, activeVolume).then((status) => {
      if (alive) setOfflineStatus(status);
    });
    return () => {
      alive = false;
    };
  }, [manifest, activeVolume]);

  const totalPageWindows = Math.max(1, Math.ceil(sectionPages.length / PAGES_PER_VIEW));
  const safeWindowIndex = Math.min(pageWindowIndex, totalPageWindows - 1);
  const visiblePages = useMemo(() => {
    const start = safeWindowIndex * PAGES_PER_VIEW;
    return sectionPages.slice(start, start + PAGES_PER_VIEW);
  }, [sectionPages, safeWindowIndex]);

  const handleSelectVolume = (volNum: number) => {
    setActiveVolume(volNum);
    setTocFilter('');
    if (!toc) return;
    const firstInVol = toc.sections.find((s) => s.volume === volNum);
    if (firstInVol) {
      navigateToSection(firstInVol, firstInVol.startPage);
    }
  };

  const handleDirectPageJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toc || !activeVolumeMeta) return;
    const parsed = Number.parseInt(jumpPageInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < activeVolumeMeta.firstPage || parsed > activeVolumeMeta.lastPage) {
      onToast?.(
        `أدخل رقم صفحة صحيحاً في ${activeVolumeMeta.shortTitle} بين ${activeVolumeMeta.firstPage} و ${activeVolumeMeta.lastPage}.`,
        'warn'
      );
      return;
    }
    const sec = findSectionForVolumePage(toc, activeVolume, parsed);
    if (sec) {
      navigateToSection(sec, parsed);
      setJumpPageInput('');
      onToast?.(`تم الانتقال إلى ${activeVolumeMeta.shortTitle} · صفحة ${parsed}.`, 'info');
    }
  };

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toc) return;
    const trimmed = searchInput.trim();
    if (normalizeArabicSearchQuery(trimmed).length < 2) {
      onToast?.('أدخل كلمتين أو حرفين على الأقل للبحث في الموسوعة.', 'warn');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const hits = await searchSeerahEncyclopedia(trimmed, toc, {
        volumeFilter: searchVolumeScope,
        maxResults: 80,
      });
      setSearchResults(hits);
      setLastSearchedTerm(trimmed);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'تعذر إجراء البحث حالياً.');
    } finally {
      setSearching(false);
    }
  };

  const handleOpenSearchHit = (hit: SeerahEncyclopediaSearchHit) => {
    if (!toc) return;
    const sec =
      toc.sections.find((s) => s.id === hit.sectionId) ||
      findSectionForVolumePage(toc, hit.volume, hit.page);
    if (sec) {
      navigateToSection(sec, hit.page);
      setSearchOpen(false);
      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleToggleSectionRead = (sectionId: string) => {
    const next = toggleEncyclopediaSectionRead(sectionId);
    onStoreChange(next);
    const done = next.readSectionIds.includes(sectionId);
    if (done) {
      onToast?.('تم تسجيل إتمام قراءة هذا الباب في موسوعة السيرة النبوية.', 'success');
    }
  };

  const handleTogglePageBookmark = (pageNum: number) => {
    if (!activeSection) return;
    const bmId = `v${activeSection.volume}:p${pageNum}`;
    const wasSaved = store.bookmarks.some((b) => b.id === bmId);
    const next = toggleEncyclopediaBookmark(
      activeSection.volume,
      pageNum,
      activeSection.id,
      `${activeSection.title} — ج ${activeSection.volume} ص ${pageNum}`
    );
    onStoreChange(next);
    onToast?.(
      wasSaved
        ? `تمت إزالة العلامة المرجعية لصفحة ${pageNum}.`
        : `تم حفظ علامة مرجعية لصفحة ${pageNum} (المجلد ${activeSection.volume}).`,
      'info'
    );
  };

  const handleSaveBookmarkNote = (bookmarkId: string) => {
    const next = updateEncyclopediaBookmarkNote(bookmarkId, noteDraft);
    onStoreChange(next);
    setEditingNoteBookmarkId(null);
    setNoteDraft('');
    onToast?.('تم حفظ ملاحظتك الشخصية على العلامة المرجعية.', 'success');
  };

  const handleCacheActiveVolume = async () => {
    if (!manifest || cachingVolume) return;
    setCachingVolume(true);
    setCacheProgress({ completed: 0, total: activeVolumeMeta?.chunkCount || 1 });
    try {
      const status = await cacheSeerahVolumeOffline(manifest, activeVolume, (completed, total) => {
        setCacheProgress({ completed, total });
      });
      setOfflineStatus(status);
      onToast?.(
        status.complete
          ? `تم حفظ ${activeVolumeMeta?.shortTitle || 'المجلد'} بالكامل للقراءة والبحث بدون إنترنت.`
          : 'تم حفظ الأجزاء المتاحة محلياً.',
        status.complete ? 'success' : 'info'
      );
    } catch {
      onToast?.('تعذر حفظ المجلد محلياً حالياً، تأكد من الاتصال وحاول مجدداً.', 'error');
    } finally {
      setCachingVolume(false);
      setCacheProgress(null);
    }
  };

  if (loadingMeta) {
    return (
      <div className="wird-card p-10 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--wird-accent)]" />
        <p className="text-sm font-bold text-[var(--wird-text)]">جارٍ تحميل فهرس موسوعة السيرة النبوية لابن كثير…</p>
        <p className="text-xs text-[var(--wird-muted)]">4 مجلدات · 2,475 صفحة محققة مطابقة للمطبوع</p>
      </div>
    );
  }

  if (metaError || !manifest || !toc) {
    return (
      <div className="wird-card p-8 text-center space-y-3 border border-rose-500/30">
        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
          {metaError || 'تعذر تحميل بيانات موسوعة السيرة النبوية.'}
        </p>
        <p className="text-xs text-[var(--wird-muted)]">
          تأكد من توفر ملفات الموسوعة تحت المسار `/data/seerah-encyclopedia/`.
        </p>
      </div>
    );
  }

  const isSectionRead = activeSection ? store.readSectionIds.includes(activeSection.id) : false;

  return (
    <div id="seerah-encyclopedia-workspace" className="space-y-5">
      {/* 1. Four-Volume Selector Ribbon */}
      <section aria-label="اختيار مجلدات موسوعة السيرة النبوية" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {manifest.volumes.map((vol) => {
          const isSelected = vol.volume === activeVolume;
          const vProg = progressSummary.byVolume[vol.volume] || { completed: 0, total: vol.sectionCount, percent: 0 };
          return (
            <button
              key={vol.volume}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelectVolume(vol.volume)}
              className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2.5 ${
                isSelected
                  ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-sm ring-1 ring-[var(--wird-border-gold)]'
                  : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/15 text-white'
                        : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                    }`}
                  >
                    {vol.shortTitle}
                  </span>
                  <span className={`font-mono ${isSelected ? 'text-white/80' : 'text-[var(--wird-muted)]'}`}>
                    {vol.pageCount} ص · {vol.sectionCount} باباً
                  </span>
                </div>
                <div className="text-xs font-bold leading-snug line-clamp-2">
                  {vol.title.replace(/^المجلد [^:]+:\s*/, '')}
                </div>
                <div className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[var(--wird-muted)]'}`}>
                  {vol.periodLabel}
                </div>
              </div>

              <div className="space-y-1">
                <div className={`flex items-center justify-between text-[10px] font-mono ${isSelected ? 'text-white/85' : 'text-[var(--wird-muted)]'}`}>
                  <span>التقدم: {vProg.completed}/{vProg.total}</span>
                  <span>{vProg.percent}%</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-[var(--wird-surface-muted)]'}`}>
                  <div
                    className="h-full rounded-full bg-[var(--wird-accent)] transition-all duration-300"
                    style={{ width: `${vProg.percent}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* 2. Action Toolbar: Full-Text Search, Direct Page Jump, Offline Save & Typography */}
      <div className="wird-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
              className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors ${
                searchOpen
                  ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
                  : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
              }`}
            >
              <Search className="w-4 h-4 text-[var(--wird-accent)]" />
              <span>البحث الشامل في الـ {manifest.totalPages.toLocaleString('ar-EG')} صفحة</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTocOpen((v) => !v)}
              className="lg:hidden min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border)] flex items-center gap-1.5"
            >
              <List className="w-4 h-4 text-[var(--wird-accent)]" />
              <span>فهرس الأبواب ({volumeSections.length})</span>
            </button>

            {offlineStatus?.supported && (
              <button
                type="button"
                disabled={cachingVolume}
                onClick={() => void handleCacheActiveVolume()}
                className={`min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-colors ${
                  offlineStatus.complete
                    ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-border-gold)]'
                }`}
              >
                {cachingVolume ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--wird-accent)]" />
                    <span>
                      جارٍ الحفظ… {cacheProgress ? `${cacheProgress.completed}/${cacheProgress.total}` : ''}
                    </span>
                  </>
                ) : offlineStatus.complete ? (
                  <>
                    <HardDrive className="w-4 h-4" />
                    <span>{activeVolumeMeta?.shortTitle} محفوظ بدون إنترنت</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[var(--wird-accent)]" />
                    <span>حفظ {activeVolumeMeta?.shortTitle} بدون إنترنت</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Direct Printed-Page Jumper */}
          <form onSubmit={handleDirectPageJump} className="flex items-center gap-2">
            <label htmlFor="seerah-page-jump" className="text-xs font-semibold text-[var(--wird-muted)] whitespace-nowrap flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              <span>صفحة ({activeVolumeMeta?.firstPage}–{activeVolumeMeta?.lastPage}):</span>
            </label>
            <input
              id="seerah-page-jump"
              type="number"
              min={activeVolumeMeta?.firstPage || 1}
              max={activeVolumeMeta?.lastPage || 717}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(activePageTarget)}
              className="w-20 min-h-10 px-2.5 py-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-mono text-center text-[var(--wird-text)]"
            />
            <button
              type="submit"
              className="min-h-10 px-3 py-1 rounded-xl bg-[var(--wird-primary)] text-white text-xs font-bold"
            >
              انتقال
            </button>
          </form>
        </div>

        {/* Collapsible Full-Text Search Drawer */}
        {searchOpen && (
          <div className="pt-3 border-t border-[var(--wird-border)] space-y-4">
            <form onSubmit={(e) => void handleRunSearch(e)} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="البحث النصي الكامل في موسوعة السيرة النبوية لابن كثير"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ابحث في كامل نص المجلدات الأربعة (مثل: غزوة بدر، حليمة السعدية، فتح مكة، حجة الوداع)..."
                  className="w-full min-h-11 pr-10 pl-3 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs md:text-sm text-[var(--wird-text)]"
                />
              </div>
              <select
                aria-label="نطاق المجلد للبحث"
                value={String(searchVolumeScope)}
                onChange={(e) =>
                  setSearchVolumeScope(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="min-h-11 px-3 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)]"
              >
                <option value="all">جميع المجلدات (2,475 ص)</option>
                {manifest.volumes.map((v) => (
                  <option key={v.volume} value={v.volume}>
                    {v.shortTitle} ({v.pageCount} ص)
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={searching}
                className="min-h-11 px-5 py-2 rounded-xl bg-[var(--wird-primary)] text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{searching ? 'جارٍ البحث…' : 'بحث'}</span>
              </button>
            </form>

            {searchError && (
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{searchError}</p>
            )}

            {searchResults !== null && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[var(--wird-muted)]">
                  <span>
                    نتائج البحث عن «<strong className="text-[var(--wird-text)]">{lastSearchedTerm}</strong>»:{' '}
                    <strong className="font-mono">{searchResults.length}</strong> نتيجة
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchResults(null)}
                    className="inline-flex items-center gap-1 text-[11px] hover:text-[var(--wird-text)]"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>مسح النتائج</span>
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[var(--wird-surface-muted)] text-center text-xs text-[var(--wird-muted)]">
                    لم يُعثر على نتائج مطابقة في النطاق المحدد. جرّب كلمات أبسط أو البحث في «جميع المجلدات».
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 pl-1">
                    {searchResults.map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        onClick={() => handleOpenSearchHit(hit)}
                        className="w-full p-3.5 rounded-xl bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-surface)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-right transition-all space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                            {hit.matchType === 'section' ? 'باب مطابق: ' : ''}
                            {hit.sectionTitle}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--wird-surface)] border border-[var(--wird-border)] font-mono text-[10px] text-[var(--wird-muted)]">
                            ج {hit.volume} · ص {hit.page}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--wird-text)] leading-relaxed line-clamp-2">
                          {hit.snippet}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Split Workspace: Volume TOC Sidebar + Editorial Book Reader */}
      <div
        ref={readerTopRef}
        className={`grid grid-cols-1 gap-5 ${
          store.focusMode ? '' : 'lg:grid-cols-12'
        }`}
      >
        {/* TOC Sidebar */}
        {!store.focusMode && (
          <aside
            aria-label="فهرس أبواب المجلد النشط"
            className={`lg:col-span-4 xl:col-span-3 ${
              mobileTocOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="wird-card p-4 space-y-3 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--wird-border)]">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-[var(--wird-accent)]" />
                  <h3 className="text-xs font-extrabold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                    فهرس {activeVolumeMeta?.shortTitle} ({volumeSections.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTocOpen(false)}
                  className="lg:hidden p-1 text-[var(--wird-muted)]"
                  aria-label="إغلاق الفهرس"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="search"
                aria-label="تصفية أبواب المجلد"
                value={tocFilter}
                onChange={(e) => setTocFilter(e.target.value)}
                placeholder="تصفية عناوين المجلد..."
                className="w-full min-h-10 px-3 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs text-[var(--wird-text)]"
              />

              <div className="max-h-[65vh] overflow-y-auto space-y-1.5 pl-1">
                {filteredVolumeSections.map((sec) => {
                  const isCurrent = activeSection?.id === sec.id;
                  const isDone = store.readSectionIds.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={() => navigateToSection(sec)}
                      className={`w-full p-3 rounded-xl border text-right transition-all space-y-1 ${
                        isCurrent
                          ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
                          : isDone
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-[var(--wird-text)] hover:border-[var(--wird-border-gold)]'
                          : 'bg-[var(--wird-surface-muted)] border-transparent text-[var(--wird-text)] hover:border-[var(--wird-border)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold leading-snug">
                          {sec.order}. {sec.title}
                        </span>
                        {isDone && (
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              isCurrent ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          />
                        )}
                      </div>
                      <div
                        className={`flex items-center justify-between text-[10px] font-mono ${
                          isCurrent ? 'text-white/80' : 'text-[var(--wird-muted)]'
                        }`}
                      >
                        <span>{sec.eraTag}</span>
                        <span>ص {sec.startPage}–{sec.endPage}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Editorial Book Reader Pane */}
        <article
          className={
            store.focusMode ? 'max-w-4xl mx-auto w-full space-y-5' : 'lg:col-span-8 xl:col-span-9 space-y-5'
          }
        >
          {activeSection && (
            <div className="wird-card p-5 sm:p-7 md:p-9 space-y-6">
              {/* Section Header & Reader Controls */}
              <header className="space-y-4 pb-5 border-b border-[var(--wird-border)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/40 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold">
                      {activeVolumeMeta?.shortTitle} · الباب {activeSection.order} من {volumeSections.length}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-semibold text-[var(--wird-text)]">
                      {activeSection.eraTag}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-mono text-[11px] text-[var(--wird-muted)]">
                      ص {activeSection.startPage} – {activeSection.endPage} ({activeSection.pageCount} صفحة)
                    </span>
                  </div>

                  {/* Font size + Focus Mode + Mark Read */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      role="group"
                      aria-label="حجم خط القراءة"
                      className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]"
                    >
                      <Type className="w-3.5 h-3.5 text-[var(--wird-muted)] mx-1" />
                      {(['sm', 'md', 'lg', 'xl'] as SeerahEncyclopediaFontSize[]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          aria-pressed={store.fontSize === sz}
                          onClick={() => onStoreChange(setEncyclopediaFontSize(sz))}
                          className={`min-h-8 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                            store.fontSize === sz
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
                      aria-pressed={store.focusMode}
                      onClick={() => onStoreChange(setEncyclopediaFocusMode(!store.focusMode))}
                      className="min-h-10 px-3 py-1.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] flex items-center gap-1.5"
                    >
                      {store.focusMode ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                          <span>إظهار الفهرس</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                          <span>قراءة صافية</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      aria-pressed={isSectionRead}
                      onClick={() => handleToggleSectionRead(activeSection.id)}
                      className={`min-h-10 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        isSectionRead
                          ? 'bg-emerald-700 text-white'
                          : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSectionRead ? 'تمت قراءة الباب' : 'تسجيل الباب كمقروء'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-quran text-[var(--wird-primary)] dark:text-[var(--wird-text)] leading-snug">
                    {activeSection.title}
                  </h2>
                  <p className="text-xs text-[var(--wird-muted)]">
                    {manifest.classicalWork} — {manifest.author} · نحو {activeSection.wordCount.toLocaleString('ar-EG')} كلمة
                  </p>
                </div>

                {/* Inner Page Window Switcher for long sections */}
                {totalPageWindows > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs">
                    <span className="font-semibold text-[var(--wird-muted)] flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                      <span>
                        الجزء {safeWindowIndex + 1} من {totalPageWindows} داخل هذا الباب (الصفحات{' '}
                        {visiblePages[0]?.page} – {visiblePages[visiblePages.length - 1]?.page})
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeWindowIndex === 0}
                        onClick={() => {
                          setPageWindowIndex((w) => Math.max(0, w - 1));
                          readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="min-h-9 px-3 py-1 rounded-lg bg-[var(--wird-surface)] border border-[var(--wird-border)] font-bold disabled:opacity-40"
                      >
                        صفحات سابقة
                      </button>
                      <button
                        type="button"
                        disabled={safeWindowIndex >= totalPageWindows - 1}
                        onClick={() => {
                          setPageWindowIndex((w) => Math.min(totalPageWindows - 1, w + 1));
                          readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="min-h-9 px-3 py-1 rounded-lg bg-[var(--wird-primary)] text-white font-bold disabled:opacity-40"
                      >
                        صفحات تالية
                      </button>
                    </div>
                  </div>
                )}
              </header>

              {/* Printed Pages Body */}
              {loadingPages ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-[var(--wird-muted)]">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--wird-accent)]" />
                  <span className="text-xs font-semibold">جارٍ تحميل صفحات الباب…</span>
                </div>
              ) : pagesError ? (
                <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-xs text-rose-700 dark:text-rose-300">
                  {pagesError}
                </div>
              ) : (
                <div className="space-y-8">
                  {visiblePages.map((pg) => {
                    const bmId = `v${activeSection.volume}:p${pg.page}`;
                    const bookmark = store.bookmarks.find((b) => b.id === bmId);
                    const isHighlightedPage = pg.page === activePageTarget;

                    return (
                      <section
                        key={pg.page}
                        id={`ency-page-v${activeSection.volume}-p${pg.page}`}
                        className={`space-y-4 pb-6 border-b border-[var(--wird-border)]/70 last:border-b-0 ${
                          isHighlightedPage ? 'scroll-mt-24' : ''
                        }`}
                      >
                        {/* Printed-Page Citation Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px] font-mono text-[var(--wird-muted)]">
                            <BookOpen className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                            <span>
                              المجلد {activeSection.volume} · صفحة {pg.page} (مطابق للمطبوع)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {bookmark && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteBookmarkId(
                                    editingNoteBookmarkId === bookmark.id ? null : bookmark.id
                                  );
                                  setNoteDraft(bookmark.note || '');
                                }}
                                className="min-h-9 px-2.5 py-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px] font-bold text-[var(--wird-text)] flex items-center gap-1"
                              >
                                <StickyNote className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                                <span>{bookmark.note ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              aria-pressed={Boolean(bookmark)}
                              onClick={() => handleTogglePageBookmark(pg.page)}
                              className={`min-h-9 px-3 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                                bookmark
                                  ? 'bg-[var(--wird-accent)]/15 border-[var(--wird-border-gold)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                              }`}
                            >
                              {bookmark ? (
                                <>
                                  <BookmarkCheck className="w-3.5 h-3.5" />
                                  <span>محفوظة</span>
                                </>
                              ) : (
                                <>
                                  <Bookmark className="w-3.5 h-3.5" />
                                  <span>علامة</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Saved Personal Note or Editor */}
                        {bookmark && editingNoteBookmarkId === bookmark.id && (
                          <div className="p-3.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] space-y-2">
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="دوّن فائدة أو ملاحظة شخصية حول هذه الصفحة..."
                              className="w-full p-2.5 rounded-lg bg-[var(--wird-surface)] border border-[var(--wird-border)] text-xs text-[var(--wird-text)]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingNoteBookmarkId(null)}
                                className="min-h-9 px-3 py-1 rounded-lg text-xs text-[var(--wird-muted)]"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveBookmarkNote(bookmark.id)}
                                className="min-h-9 px-3.5 py-1 rounded-lg bg-[var(--wird-primary)] text-white text-xs font-bold"
                              >
                                حفظ الملاحظة
                              </button>
                            </div>
                          </div>
                        )}

                        {bookmark?.note && editingNoteBookmarkId !== bookmark.id && (
                          <div className="p-3 rounded-xl bg-[var(--wird-surface-muted)] border-r-4 border-[var(--wird-border-gold)] text-xs text-[var(--wird-text)]">
                            <strong className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">ملاحظتك: </strong>
                            {bookmark.note}
                          </div>
                        )}

                        {/* Classical Arabic Paragraphs */}
                        <div className="space-y-3.5">
                          {pg.paragraphs.map((para, pIdx) => {
                            if (isOpeningBasmalah(para)) {
                              return (
                                <p
                                  key={pIdx}
                                  className="text-center font-quran text-lg md:text-xl font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] py-2"
                                >
                                  {para}
                                </p>
                              );
                            }

                            if (isPoetryLine(para)) {
                              const [firstHalf, secondHalf] = para.split(' * ');
                              return (
                                <div
                                  key={pIdx}
                                  className="my-2 px-4 py-2.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-quran text-center grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm md:text-base text-[var(--wird-text)]"
                                >
                                  <span>{firstHalf}</span>
                                  <span>{secondHalf}</span>
                                </div>
                              );
                            }

                            return (
                              <p
                                key={pIdx}
                                className={`font-quran text-[var(--wird-text)] ${FONT_SIZE_CLASSES[store.fontSize]}`}
                              >
                                {para}
                              </p>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {/* Bottom Inner-Section Pagination */}
              {totalPageWindows > 1 && (
                <div className="pt-4 border-t border-[var(--wird-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    disabled={safeWindowIndex === 0}
                    onClick={() => {
                      setPageWindowIndex((w) => Math.max(0, w - 1));
                      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] font-bold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>الصفحات السابقة في الباب</span>
                  </button>
                  <span className="font-mono text-[var(--wird-muted)]">
                    صفحة {visiblePages[0]?.page} – {visiblePages[visiblePages.length - 1]?.page} (من {activeSection.startPage} إلى {activeSection.endPage})
                  </span>
                  <button
                    type="button"
                    disabled={safeWindowIndex >= totalPageWindows - 1}
                    onClick={() => {
                      setPageWindowIndex((w) => Math.min(totalPageWindows - 1, w + 1));
                      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-primary)] text-white font-bold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <span>الصفحات التالية في الباب</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Previous / Next Section Footer */}
              <footer className="pt-5 border-t border-[var(--wird-border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prevSection ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigateToSection(prevSection);
                      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="min-h-14 p-4 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-right flex items-center justify-between gap-3 transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-[var(--wird-accent)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-[var(--wird-muted)]">
                        الباب السابق (ج {prevSection.volume} · ص {prevSection.startPage})
                      </div>
                      <div className="text-xs md:text-sm font-bold text-[var(--wird-text)] truncate">
                        {prevSection.title}
                      </div>
                    </div>
                  </button>
                ) : (
                  <div />
                )}

                {nextSection ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigateToSection(nextSection);
                      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="min-h-14 p-4 rounded-2xl bg-[var(--wird-primary)] text-white border border-[var(--wird-border-gold)] text-right flex items-center justify-between gap-3 transition-all shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-white/80">
                        الباب التالي (ج {nextSection.volume} · ص {nextSection.startPage})
                      </div>
                      <div className="text-xs md:text-sm font-bold truncate">
                        {nextSection.title}
                      </div>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-[var(--wird-accent)] shrink-0" />
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                    تمّ بحمد الله آخر أبواب المجلد الرابع من السيرة النبوية لابن كثير
                  </div>
                )}
              </footer>

              {/* Scholarly Provenance & Attribution */}
              <div className="p-4 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px] text-[var(--wird-muted)] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>التوثيق العلمي والعزو:</span>
                </div>
                <p>{manifest.editionAlignment}</p>
                <p>{manifest.licenseNotice}</p>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
};
