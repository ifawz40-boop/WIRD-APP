import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Columns2, FileText } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import {
  DESKTOP_SPREAD_BREAKPOINT_PX,
  getSavedMushafSpreadMode,
  getSavedMushafTafsirLayout,
  getSavedMushafTafsirPagePreferences,
  getSpreadPairForPage,
  resolveEffectiveSpreadMode,
  saveMushafSpreadMode,
  saveMushafTafsirLayout,
  saveMushafTafsirPagePreferences,
  type MushafSpreadMode,
  type MushafSurfaceId,
  type MushafTafsirDesktopLayout
} from '../../services/mushafSpreadService';
import { QuranMushafFacsimilePage } from './QuranMushafFacsimilePage';
import { TafsirContentPane } from './TafsirContentPane';
import { TafsirMushafPage } from './TafsirMushafPage';
import { TafsirSheet } from './TafsirSheet';

interface PrintedMushafSpreadProps {
  surface: MushafSurfaceId;
  anchorPage: number;
  selectedAyah: Ayah | null;
  onSelectAyah: (ayah: Ayah | null) => void;
  tafsirAyah?: Ayah | null;
  onTafsirAyahChange?: (ayah: Ayah | null) => void;
  onAyahsResolved?: (resolved: { page: number; ayahs: Ayah[] }) => void;
  onFallback: () => void;
  onNavigateToAyah?: (surahNumber: number, ayahNumber: number) => number | null | Promise<number | null>;
  maxWidthClass?: string;
}

export const PrintedMushafSpread: React.FC<PrintedMushafSpreadProps> = ({
  surface,
  anchorPage,
  selectedAyah,
  onSelectAyah,
  tafsirAyah,
  onTafsirAyahChange,
  onAyahsResolved,
  onFallback,
  onNavigateToAyah,
  maxWidthClass = 'max-w-5xl'
}) => {
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [spreadModePref, setSpreadModePref] = useState<MushafSpreadMode>(() =>
    getSavedMushafSpreadMode(surface)
  );
  const [desktopTafsirLayout, setDesktopTafsirLayout] = useState<MushafTafsirDesktopLayout>(() =>
    getSavedMushafTafsirLayout(surface)
  );
  const [resolvedByPage, setResolvedByPage] = useState<Record<number, Ayah[]>>({});
  const [activeTafsirPage, setActiveTafsirPage] = useState<number | null>(null);
  const [pageTafsirPreferences, setPageTafsirPreferences] = useState<Record<number, boolean>>(() => getSavedMushafTafsirPagePreferences(surface).sourcePages);
  const [preferredTafsirPage, setPreferredTafsirPage] = useState<number | null>(() => getSavedMushafTafsirPagePreferences(surface).preferredSourcePage);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDesktopViewport = viewportWidth >= DESKTOP_SPREAD_BREAKPOINT_PX;
  const effectiveSpreadMode = resolveEffectiveSpreadMode(spreadModePref, viewportWidth);
  const isTwoPage = effectiveSpreadMode === 'double';

  const [rightPage, leftPage] = useMemo(
    () => getSpreadPairForPage(anchorPage),
    [anchorPage]
  );

  const visiblePages = useMemo(
    () => (isTwoPage ? [rightPage, leftPage] : [anchorPage]),
    [isTwoPage, rightPage, leftPage, anchorPage]
  );

  // Preferences are keyed by the Quran source page. In a facing spread,
  // Tafsir occupies the opposite visual slot while the Quran page remains visible.
  const effectiveTafsirSourcePage = useMemo(() => {
    if (
      preferredTafsirPage !== null &&
      visiblePages.includes(preferredTafsirPage) &&
      pageTafsirPreferences[preferredTafsirPage]
    ) return preferredTafsirPage;
    return visiblePages.find(page => pageTafsirPreferences[page]) ?? null;
  }, [preferredTafsirPage, visiblePages, pageTafsirPreferences]);
  const effectiveTafsirDisplayPage = effectiveTafsirSourcePage === null
    ? null
    : isTwoPage
      ? (effectiveTafsirSourcePage === rightPage ? leftPage : rightPage)
      : effectiveTafsirSourcePage;


  const handleAyahsResolved = useCallback(
    (resolved: { page: number; ayahs: Ayah[] }) => {
      setResolvedByPage(prev => ({
        ...prev,
        [resolved.page]: resolved.ayahs
      }));
      onAyahsResolved?.(resolved);
    },
    [onAyahsResolved]
  );

  const handleToggleSpreadMode = (mode: 'single' | 'double') => {
    const saved = saveMushafSpreadMode(surface, mode);
    setSpreadModePref(saved);
  };

  const handleChangeTafsirLayout = (layout: MushafTafsirDesktopLayout) => {
    const saved = saveMushafTafsirLayout(surface, layout);
    setDesktopTafsirLayout(saved);
  };

  const isControlledTafsir = tafsirAyah !== undefined;
  const activeTafsirAyah = isControlledTafsir ? tafsirAyah : selectedAyah;
  const setTafsirTarget = useCallback(
    (next: Ayah | null) => {
      if (onTafsirAyahChange) {
        onTafsirAyahChange(next);
      } else {
        onSelectAyah(next);
      }
    },
    [onTafsirAyahChange, onSelectAyah]
  );

  const handleSelectAyahFromPage = useCallback(
    (ayah: Ayah, ownerPage: number) => {
      setActiveTafsirPage(ownerPage);
      onSelectAyah(ayah);
      if (onTafsirAyahChange) {
        onTafsirAyahChange(ayah);
      }
    },
    [onSelectAyah, onTafsirAyahChange]
  );

  const handleSetSourcePageMode = (sourcePage: number, mode: 'quran' | 'tafsir') => {
    const nextPreferred = mode === 'tafsir'
      ? sourcePage
      : preferredTafsirPage === sourcePage ? null : preferredTafsirPage;
    setPageTafsirPreferences(prev => {
      const nextPages = { ...prev, [sourcePage]: mode === 'tafsir' };
      saveMushafTafsirPagePreferences(surface, {
        sourcePages: nextPages,
        preferredSourcePage: nextPreferred
      });
      return nextPages;
    });
    setPreferredTafsirPage(nextPreferred);
    if (mode === 'tafsir') {
      setActiveTafsirPage(sourcePage);
      const sourceAyahs = resolvedByPage[sourcePage] || [];
      const current = [activeTafsirAyah, selectedAyah].find(candidate =>
        candidate && sourceAyahs.some(item =>
          item.surahNumber === candidate.surahNumber && item.numberInSurah === candidate.numberInSurah
        )
      );
      const target = current || sourceAyahs[0];
      if (target) setTafsirTarget(target);
    } else if (activeTafsirPage === sourcePage) {
      setActiveTafsirPage(null);
      setTafsirTarget(null);
    }
  };

  const getSourcePageForSlot = (slotPage: number) =>
    isTwoPage ? (slotPage === rightPage ? leftPage : rightPage) : slotPage;

  const handleSetPageContentMode = (slotPage: number, mode: 'quran' | 'tafsir') => {
    handleSetSourcePageMode(getSourcePageForSlot(slotPage), mode);
  };

  const handleNavigateFromTafsir = async (surahNumber: number, ayahNumber: number) => {
    const targetPage = await (onNavigateToAyah?.(surahNumber, ayahNumber) ?? null);
    if (targetPage !== null) {
      setPageTafsirPreferences(prev => {
        const nextPages = { ...prev, [targetPage]: true };
        saveMushafTafsirPagePreferences(surface, {
          sourcePages: nextPages,
          preferredSourcePage: targetPage
        });
        return nextPages;
      });
      setPreferredTafsirPage(targetPage);
      setActiveTafsirPage(targetPage);
    }
  };

  const handleOpenPageTafsir = (targetPage: number) => {
    if (!resolvedByPage[targetPage]?.length) return;
    handleSetSourcePageMode(targetPage, 'tafsir');
  };

  const handleCloseTafsir = () => {
    setActiveTafsirPage(null);
    setTafsirTarget(null);
  };

  // Determine which page owns the currently inspected ayah for opposite-page replacement
  const inspectedOwnerPage = useMemo(() => {
    if (!activeTafsirAyah) return null;
    for (const pageNum of visiblePages) {
      const list = resolvedByPage[pageNum] || [];
      if (
        list.some(
          item =>
            item.surahNumber === activeTafsirAyah.surahNumber &&
            item.numberInSurah === activeTafsirAyah.numberInSurah
        )
      ) {
        return pageNum;
      }
    }
    return activeTafsirPage || anchorPage;
  }, [activeTafsirAyah, visiblePages, resolvedByPage, activeTafsirPage, anchorPage]);

  const activePageAyahs = inspectedOwnerPage ? resolvedByPage[inspectedOwnerPage] : undefined;
  const isTafsirOpenDesktop = isDesktopViewport && Boolean(activeTafsirAyah) && effectiveTafsirSourcePage === null;
  const replaceRightSlotWithTafsir =
    isTafsirOpenDesktop &&
    isTwoPage &&
    desktopTafsirLayout === 'replace_opposite' &&
    inspectedOwnerPage === leftPage;
  const replaceLeftSlotWithTafsir =
    isTafsirOpenDesktop &&
    isTwoPage &&
    desktopTafsirLayout === 'replace_opposite' &&
    inspectedOwnerPage !== leftPage;
  const showSideSlideOverPanel =
    isTafsirOpenDesktop &&
    (!isTwoPage || desktopTafsirLayout === 'panel');

  return (
    <div className={`mx-auto w-full ${maxWidthClass} space-y-3`}>
      {/* Compact Spread & Page Tafsir Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#C59B27]/30 bg-[#F2EDE2]/70 dark:border-[#E0A96D]/25 dark:bg-[#111F36]/80 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums">
            {isTwoPage ? `الصفحتان ${rightPage} – ${leftPage}` : `الصفحة ${anchorPage}`}
          </span>
          {visiblePages.map(pageNum => {
            const pageAyahs = resolvedByPage[pageNum];
            return (
              <button
                key={`page-tafsir-${pageNum}`}
                type="button"
                disabled={!pageAyahs?.length}
                onClick={() => handleOpenPageTafsir(pageNum)}
                className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 py-1.5 font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#1C4E46] dark:text-[#E0A96D]" />
                <span>تفسير صفحة {pageNum}</span>
              </button>
            );
          })}
        </div>

        {isDesktopViewport && (
          <div
            role="group"
            aria-label="نمط صفحات المصحف المطبوع"
            className="inline-flex rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] p-0.5"
          >
            <button
              type="button"
              aria-pressed={isTwoPage}
              onClick={() => handleToggleSpreadMode('double')}
              className={`min-h-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-colors whitespace-nowrap ${
                isTwoPage
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white'
                  : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>صفحتان متقابلتان</span>
            </button>
            <button
              type="button"
              aria-pressed={!isTwoPage}
              onClick={() => handleToggleSpreadMode('single')}
              className={`min-h-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-colors whitespace-nowrap ${
                !isTwoPage
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white'
                  : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>صفحة واحدة</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Facing Spread + Optional Desktop Side Panel */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4" dir="rtl">
        <div className={`flex-1 min-w-0 grid gap-4 ${isTwoPage ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {visiblePages.map(pageNum => {
            const shouldReplaceThisSlot =
              (pageNum === rightPage && replaceRightSlotWithTafsir) ||
              (pageNum === leftPage && replaceLeftSlotWithTafsir);

            if (shouldReplaceThisSlot && activeTafsirAyah) {
              return (
                <section
                  key={`opposite-tafsir-${pageNum}`}
                  aria-label="التفسير بدلاً من الصفحة المقابلة"
                  className="flex flex-col min-h-[520px] max-h-[820px] rounded-2xl border border-[#C59B27]/50 dark:border-[#E0A96D]/35 shadow-xl overflow-hidden bg-[#F9F6EE] dark:bg-[#111F36]"
                >
                  <TafsirContentPane
                    ayah={activeTafsirAyah}
                    onSelectAyah={next => {
                      setTafsirTarget(next);
                      onSelectAyah(next);
                    }}
                    onClose={handleCloseTafsir}
                    returnToMushafLabel="العودة لصفحة المصحف"
                    pageNumber={inspectedOwnerPage || pageNum}
                    pageAyahs={activePageAyahs}
                    desktopLayout={desktopTafsirLayout}
                    onChangeDesktopLayout={handleChangeTafsirLayout}
                    compactHeader
                  />
                </section>
              );
            }

            const slotSideLabel = isTwoPage
              ? (pageNum === rightPage ? 'الصفحة اليمنى' : 'الصفحة اليسرى')
              : 'الصفحة';
            const sourcePageNum = getSourcePageForSlot(pageNum);
            const sourceSideLabel = isTwoPage
              ? (sourcePageNum === rightPage ? 'الصفحة اليمنى' : 'الصفحة اليسرى')
              : 'الصفحة';
            const sourceAyahs = resolvedByPage[sourcePageNum] || [];
            const isPageTafsir = effectiveTafsirDisplayPage === pageNum;
            const selectedForPage = [activeTafsirAyah, selectedAyah].find(candidate =>
              candidate && sourceAyahs.some(item =>
                item.surahNumber === candidate.surahNumber && item.numberInSurah === candidate.numberInSurah
              )
            ) || sourceAyahs[0] || null;

            return (
              <section
                key={`spread-page-${pageNum}`}
                role="group"
                aria-label={`محتوى ${slotSideLabel}`}
                className="min-w-0 flex flex-col gap-1.5"
              >
                {isTwoPage && (
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                    <span>صفحة {pageNum}</span>
                    {pageNum === anchorPage && (
                      <span className="text-[#1C4E46] dark:text-[#E0A96D]">الصفحة الحالية</span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1C4E46]/10 dark:border-[#E0A96D]/20 bg-white/80 dark:bg-[#0B132B]/80 p-1.5">
                  <button
                    type="button"
                    aria-pressed={!isPageTafsir}
                    onClick={() => handleSetPageContentMode(pageNum, 'quran')}
                    className={`min-h-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${!isPageTafsir ? 'bg-[#1C4E46] text-white dark:bg-[#1E4A47]' : 'text-[#5B6F6B] dark:text-[#AAB8B4]'}`}
                  >القرآن</button>
                  <button
                    type="button"
                    aria-pressed={isPageTafsir}
                    disabled={!sourceAyahs.length}
                    onClick={() => handleSetPageContentMode(pageNum, 'tafsir')}
                    className={`min-h-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${isPageTafsir ? 'bg-[#1C4E46] text-white dark:bg-[#1E4A47]' : 'text-[#5B6F6B] dark:text-[#AAB8B4] disabled:opacity-40'}`}
                  >التفسير الميسر</button>
                </div>
                {isPageTafsir ? (
                  <TafsirMushafPage
                    pageNumber={pageNum}
                    sourcePageNumber={sourcePageNum}
                    sourceSideLabel={sourceSideLabel}
                    ayahs={sourceAyahs}
                    selectedAyah={selectedForPage}
                    onNavigate={async (surahNumber, ayahNumber) => { await handleNavigateFromTafsir(surahNumber, ayahNumber); }}
                  />
                ) : (
                  <QuranMushafFacsimilePage
                    page={pageNum}
                    onAyahsResolved={handleAyahsResolved}
                    selectedAyah={activeTafsirAyah || selectedAyah}
                    onSelectAyah={ayah => handleSelectAyahFromPage(ayah, pageNum)}
                    onFallback={onFallback}
                    maxWidthClass="max-w-none"
                  />
                )}
              </section>
            );
          })}
        </div>

        {/* Desktop Slide-Over Side Panel Option (keeps both facing pages visible) */}
        {showSideSlideOverPanel && activeTafsirAyah && (
          <aside
            aria-label="لوحة التفسير الجانبية"
            className="w-full lg:w-[400px] xl:w-[440px] shrink-0 rounded-2xl border border-[#C59B27]/45 dark:border-[#E0A96D]/30 shadow-2xl overflow-hidden max-h-[820px] flex flex-col bg-[#F9F6EE] dark:bg-[#111F36]"
          >
            <TafsirContentPane
              ayah={activeTafsirAyah}
              onSelectAyah={next => {
                setTafsirTarget(next);
                onSelectAyah(next);
              }}
              onClose={handleCloseTafsir}
              pageNumber={inspectedOwnerPage || anchorPage}
              pageAyahs={activePageAyahs}
              desktopLayout={isTwoPage ? desktopTafsirLayout : undefined}
              onChangeDesktopLayout={isTwoPage ? handleChangeTafsirLayout : undefined}
              compactHeader
            />
          </aside>
        )}
      </div>

      {/* Mobile Modal Tafsir Sheet */}
      {!isDesktopViewport && activeTafsirAyah && effectiveTafsirPage === null && (
        <TafsirSheet
          ayah={activeTafsirAyah}
          onSelectAyah={next => {
            setTafsirTarget(next);
            onSelectAyah(next);
          }}
          onClose={handleCloseTafsir}
          pageNumber={inspectedOwnerPage || anchorPage}
          pageAyahs={activePageAyahs}
        />
      )}
    </div>
  );
};
