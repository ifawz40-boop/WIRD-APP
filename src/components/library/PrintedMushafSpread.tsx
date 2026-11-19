import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Columns2, FileText } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import {
  DESKTOP_SPREAD_BREAKPOINT_PX,
  getSavedMushafSpreadMode,
  getSavedMushafTafsirLayout,
  resolveEffectiveSpreadMode,
  resolveSpreadLayout,
  saveMushafSpreadMode,
  saveMushafTafsirLayout,
  type MushafSpreadMode,
  type MushafSurfaceId,
  type MushafTafsirDesktopLayout
} from '../../services/mushafSpreadService';
import { QuranMushafFacsimilePage } from './QuranMushafFacsimilePage';
import { TafsirContentPane } from './TafsirContentPane';
import { TafsirSheet } from './TafsirSheet';

export interface PrintedMushafSpreadContext {
  isTwoPage: boolean;
  isOppositeTafsirActive: boolean;
  visiblePages: number[];
  readingPage: number;
}

interface PrintedMushafSpreadProps {
  surface: MushafSurfaceId;
  anchorPage: number;
  onAnchorPageChange?: (page: number) => void;
  selectedAyah: Ayah | null;
  onSelectAyah: (ayah: Ayah | null) => void;
  tafsirAyah?: Ayah | null;
  onTafsirAyahChange?: (ayah: Ayah | null) => void;
  onAyahsResolved?: (resolved: { page: number; ayahs: Ayah[] }) => void;
  onFallback: () => void;
  maxWidthClass?: string;
  sessionAyahKeys?: Set<string>;
  autoOpenTafsirOnSelect?: boolean;
  onSpreadContextChange?: (context: PrintedMushafSpreadContext) => void;
}

export const PrintedMushafSpread: React.FC<PrintedMushafSpreadProps> = ({
  surface,
  anchorPage,
  onAnchorPageChange,
  selectedAyah,
  onSelectAyah,
  tafsirAyah,
  onTafsirAyahChange,
  onAyahsResolved,
  onFallback,
  maxWidthClass = 'max-w-5xl',
  sessionAyahKeys,
  autoOpenTafsirOnSelect = true,
  onSpreadContextChange
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDesktopViewport = viewportWidth >= DESKTOP_SPREAD_BREAKPOINT_PX;
  const effectiveSpreadMode = resolveEffectiveSpreadMode(spreadModePref, viewportWidth);
  const isTwoPage = effectiveSpreadMode === 'double';

  const isControlledTafsir = tafsirAyah !== undefined;
  const activeTafsirAyah = isControlledTafsir ? tafsirAyah : selectedAyah;

  const spreadLayout = useMemo(
    () =>
      resolveSpreadLayout({
        anchorPage,
        isTwoPage,
        isDesktopViewport,
        desktopTafsirLayout,
        isTafsirOpen: Boolean(activeTafsirAyah)
      }),
    [anchorPage, isTwoPage, isDesktopViewport, desktopTafsirLayout, activeTafsirAyah]
  );

  const {
    rightPage,
    leftPage,
    visiblePages,
    readingPage,
    isOppositeTafsirActive,
    replaceRightSlotWithTafsir,
    replaceLeftSlotWithTafsir,
    showSideSlideOverPanel
  } = spreadLayout;

  useEffect(() => {
    onSpreadContextChange?.({
      isTwoPage,
      isOppositeTafsirActive,
      visiblePages,
      readingPage
    });
  }, [onSpreadContextChange, isTwoPage, isOppositeTafsirActive, visiblePages, readingPage]);

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
      if (ownerPage !== anchorPage) {
        onAnchorPageChange?.(ownerPage);
      }
      onSelectAyah(ayah);
      const shouldUpdateTafsir = autoOpenTafsirOnSelect || Boolean(activeTafsirAyah);
      if (shouldUpdateTafsir) {
        setActiveTafsirPage(ownerPage);
        if (onTafsirAyahChange) {
          onTafsirAyahChange(ayah);
        }
      }
    },
    [anchorPage, onAnchorPageChange, onSelectAyah, autoOpenTafsirOnSelect, activeTafsirAyah, onTafsirAyahChange]
  );

  const handleOpenPageTafsir = (targetPage: number) => {
    const ayahs = resolvedByPage[targetPage];
    if (!ayahs?.length) return;
    if (targetPage !== anchorPage) {
      onAnchorPageChange?.(targetPage);
    }
    setActiveTafsirPage(targetPage);
    setTafsirTarget(ayahs[0]);
  };

  const handleCloseTafsir = () => {
    setActiveTafsirPage(null);
    setTafsirTarget(null);
  };

  // Determine which page owns the currently inspected ayah for index display & quick jump
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
    return activeTafsirPage || readingPage;
  }, [activeTafsirAyah, visiblePages, resolvedByPage, activeTafsirPage, readingPage]);

  const activePageAyahs = inspectedOwnerPage ? resolvedByPage[inspectedOwnerPage] : undefined;
  const readingPageAyahs = resolvedByPage[readingPage];
  const syncReadingPageAction =
    isOppositeTafsirActive &&
    inspectedOwnerPage !== readingPage &&
    Boolean(readingPageAyahs?.length)
      ? {
          pageNumber: readingPage,
          onSync: () => handleOpenPageTafsir(readingPage)
        }
      : undefined;

  const spreadSlots = useMemo(
    () => (isTwoPage ? [rightPage, leftPage] : [readingPage]),
    [isTwoPage, rightPage, leftPage, readingPage]
  );

  return (
    <div className={`mx-auto w-full ${maxWidthClass} space-y-3`}>
      {/* Compact Spread & Page Tafsir Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#C59B27]/30 bg-[#F2EDE2]/70 dark:border-[#E0A96D]/25 dark:bg-[#111F36]/80 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums">
            {isOppositeTafsirActive
              ? `الصفحة ${readingPage} · التفسير مقابلها`
              : isTwoPage
              ? `الصفحتان ${rightPage} – ${leftPage}`
              : `الصفحة ${readingPage}`}
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
          {spreadSlots.map(pageNum => {
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
                    syncReadingPageAction={syncReadingPageAction}
                    compactHeader
                  />
                </section>
              );
            }

            return (
              <div key={`spread-page-${pageNum}`} className="min-w-0 flex flex-col gap-1.5">
                {isTwoPage && (
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                    <span>صفحة {pageNum}</span>
                    {pageNum === readingPage && (
                      <span className="text-[#1C4E46] dark:text-[#E0A96D]">الصفحة الحالية</span>
                    )}
                  </div>
                )}
                <QuranMushafFacsimilePage
                  page={pageNum}
                  onAyahsResolved={handleAyahsResolved}
                  selectedAyah={activeTafsirAyah || selectedAyah}
                  onSelectAyah={ayah => handleSelectAyahFromPage(ayah, pageNum)}
                  onFallback={onFallback}
                  maxWidthClass="max-w-none"
                  sessionAyahKeys={sessionAyahKeys}
                />
              </div>
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
              pageNumber={inspectedOwnerPage || readingPage}
              pageAyahs={activePageAyahs}
              desktopLayout={isTwoPage ? desktopTafsirLayout : undefined}
              onChangeDesktopLayout={isTwoPage ? handleChangeTafsirLayout : undefined}
              compactHeader
            />
          </aside>
        )}
      </div>

      {/* Mobile Modal Tafsir Sheet */}
      {!isDesktopViewport && activeTafsirAyah && (
        <TafsirSheet
          ayah={activeTafsirAyah}
          onSelectAyah={next => {
            setTafsirTarget(next);
            onSelectAyah(next);
          }}
          onClose={handleCloseTafsir}
          pageNumber={inspectedOwnerPage || readingPage}
          pageAyahs={activePageAyahs}
        />
      )}
    </div>
  );
};

