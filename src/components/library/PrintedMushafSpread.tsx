import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Columns2, FileText, PanelLeft } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import {
  DESKTOP_SPREAD_BREAKPOINT_PX,
  getSavedMushafSpreadMode,
  getSavedMushafTafsirLayout,
  resolveEffectiveSpreadMode,
  resolveSpreadLayout,
  saveMushafSpreadMode,
  saveMushafTafsirLayout,
  stepSpreadPage,
  type MushafSpreadMode,
  type MushafSurfaceId,
  type MushafTafsirDesktopLayout
} from '../../services/mushafSpreadService';
import type { MushafRibbonBookmark } from '../../services/mushafRibbonBookmarksService';
import {
  MushafPaperFlipStage,
  type ProgrammaticTurnRequest
} from './MushafPaperFlipStage';
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
  playingAyah?: Ayah | null;
  ribbons?: MushafRibbonBookmark[];
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
  playingAyah,
  ribbons,
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
  const [settledAnchorPage, setSettledAnchorPage] = useState<number>(anchorPage);
  const [programmaticTurn, setProgrammaticTurn] = useState<ProgrammaticTurnRequest | null>(null);
  const dragCommittedTargetRef = useRef<number | null>(null);
  const turnRequestCounterRef = useRef<number>(0);

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

  // Reset any in-flight programmatic curl cleanly when layout switches between 1-page and 2-page
  const prevIsTwoPageRef = useRef<boolean>(isTwoPage);
  useEffect(() => {
    if (prevIsTwoPageRef.current !== isTwoPage) {
      prevIsTwoPageRef.current = isTwoPage;
      dragCommittedTargetRef.current = null;
      setProgrammaticTurn(null);
      setSettledAnchorPage(anchorPage);
    }
  }, [isTwoPage, anchorPage]);

  // Determine whether an external anchorPage change (buttons/arrows) is a 1-spread step
  // that should play the smooth single-leaf curl animation, vs a completed drag or big jump.
  useEffect(() => {
    if (anchorPage === settledAnchorPage) return;

    if (dragCommittedTargetRef.current === anchorPage) {
      dragCommittedTargetRef.current = null;
      setProgrammaticTurn(null);
      setSettledAnchorPage(anchorPage);
      return;
    }

    const isOppositeTafsir =
      isDesktopViewport &&
      Boolean(activeTafsirAyah) &&
      isTwoPage &&
      desktopTafsirLayout === 'replace_opposite';
    const nextStep = stepSpreadPage(settledAnchorPage, 'next', isTwoPage, {
      isOppositeTafsirActive: isOppositeTafsir,
    });
    const prevStep = stepSpreadPage(settledAnchorPage, 'prev', isTwoPage, {
      isOppositeTafsirActive: isOppositeTafsir,
    });

    if (anchorPage === nextStep && anchorPage !== settledAnchorPage) {
      turnRequestCounterRef.current += 1;
      setProgrammaticTurn({
        id: turnRequestCounterRef.current,
        direction: 'next',
        targetAnchorPage: anchorPage,
      });
      return;
    }
    if (anchorPage === prevStep && anchorPage !== settledAnchorPage) {
      turnRequestCounterRef.current += 1;
      setProgrammaticTurn({
        id: turnRequestCounterRef.current,
        direction: 'prev',
        targetAnchorPage: anchorPage,
      });
      return;
    }

    // Large multi-page jump (e.g. Surah/Juz selector) -> settle immediately
    setProgrammaticTurn(null);
    setSettledAnchorPage(anchorPage);
  }, [
    anchorPage,
    settledAnchorPage,
    isDesktopViewport,
    activeTafsirAyah,
    isTwoPage,
    desktopTafsirLayout,
  ]);

  const handleProgrammaticTurnComplete = useCallback(
    (requestId: number) => {
      setProgrammaticTurn((current) => {
        if (!current || current.id !== requestId) return current;
        setSettledAnchorPage(current.targetAnchorPage);
        return null;
      });
    },
    []
  );

  // Use settledAnchorPage for visual layout during an in-flight programmatic curl so the
  // old spread stays underneath until the turning leaf finishes landing seamlessly.
  const visualAnchorPage = programmaticTurn ? settledAnchorPage : anchorPage;

  const spreadLayout = useMemo(
    () =>
      resolveSpreadLayout({
        anchorPage: visualAnchorPage,
        isTwoPage,
        isDesktopViewport,
        desktopTafsirLayout,
        isTafsirOpen: Boolean(activeTafsirAyah)
      }),
    [visualAnchorPage, isTwoPage, isDesktopViewport, desktopTafsirLayout, activeTafsirAyah]
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

  const handleOpenPageTafsir = (targetPage: number, preferredLayout?: MushafTafsirDesktopLayout) => {
    const ayahs = resolvedByPage[targetPage];
    if (!ayahs?.length) return;
    if (preferredLayout) {
      handleChangeTafsirLayout(preferredLayout);
    }
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
      {/* Compact Spread & Opposite-Page Tafsir Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--wird-radius-card)] border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)]/85 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
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
                className="min-h-10 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>تفسير صفحة {pageNum}</span>
              </button>
            );
          })}

          {/* Direct 1-tap Opposite-Page Tafsir shortcut in 2-page desktop mode */}
          {isDesktopViewport && isTwoPage && (
            <button
              type="button"
              aria-pressed={isOppositeTafsirActive}
              disabled={!isOppositeTafsirActive && !resolvedByPage[readingPage]?.length}
              onClick={() => {
                if (isOppositeTafsirActive) {
                  handleCloseTafsir();
                } else {
                  handleOpenPageTafsir(readingPage, 'replace_opposite');
                }
              }}
              className={`min-h-10 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] border px-3 py-1.5 font-bold transition-colors whitespace-nowrap disabled:opacity-40 ${
                isOppositeTafsirActive
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                  : 'bg-[var(--wird-surface)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border-[var(--wird-border-gold)] hover:bg-[var(--wird-accent-soft)]'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span>{isOppositeTafsirActive ? 'العودة لعرض الصفحتين' : 'عرض التفسير مكان المقابلة'}</span>
            </button>
          )}
        </div>

        {isDesktopViewport && (
          <div
            role="group"
            aria-label="نمط صفحات المصحف المطبوع"
            className="inline-flex rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] bg-[var(--wird-surface)] p-0.5"
          >
            <button
              type="button"
              aria-pressed={isTwoPage}
              onClick={() => handleToggleSpreadMode('double')}
              className={`min-h-9 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-colors whitespace-nowrap ${
                isTwoPage
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                  : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>صفحتان متقابلتان</span>
            </button>
            <button
              type="button"
              aria-pressed={!isTwoPage}
              onClick={() => handleToggleSpreadMode('single')}
              className={`min-h-9 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-colors whitespace-nowrap ${
                !isTwoPage
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                  : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>صفحة واحدة</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Facing Spread inside Planar RTL Physical Paper-Curl Stage + Optional Desktop Side Panel */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4" dir="rtl">
        <div className="flex-1 min-w-0">
          {isOppositeTafsirActive && activeTafsirAyah ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 items-stretch">
              {spreadSlots.map(pageNum => {
                const shouldReplaceThisSlot =
                  (pageNum === rightPage && replaceRightSlotWithTafsir) ||
                  (pageNum === leftPage && replaceLeftSlotWithTafsir);

                if (shouldReplaceThisSlot) {
                  return (
                    <section
                      key={`opposite-tafsir-${pageNum}`}
                      aria-label="التفسير بدلاً من الصفحة المقابلة"
                      className="flex flex-col min-h-[520px] max-h-[820px] rounded-[var(--wird-radius-card)] border border-[var(--wird-border-gold)] shadow-lg overflow-hidden bg-[var(--wird-surface)]"
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
                  <div key={`opposite-mushaf-slot-${pageNum}`} className="min-w-0">
                    <MushafPaperFlipStage
                      anchorPage={readingPage}
                      isTwoPage={false}
                      canTurnNext={readingPage < 604}
                      canTurnPrev={readingPage > 1}
                      onTurnNext={() => {
                        const target = stepSpreadPage(readingPage, 'next', isTwoPage, {
                          isOppositeTafsirActive: true,
                        });
                        dragCommittedTargetRef.current = target;
                        onAnchorPageChange?.(target);
                      }}
                      onTurnPrev={() => {
                        const target = stepSpreadPage(readingPage, 'prev', isTwoPage, {
                          isOppositeTafsirActive: true,
                        });
                        dragCommittedTargetRef.current = target;
                        onAnchorPageChange?.(target);
                      }}
                      ribbons={ribbons}
                      visiblePages={visiblePages}
                      programmaticTurn={programmaticTurn}
                      onProgrammaticTurnComplete={handleProgrammaticTurnComplete}
                    >
                      <QuranMushafFacsimilePage
                        page={pageNum}
                        onAyahsResolved={handleAyahsResolved}
                        selectedAyah={autoOpenTafsirOnSelect ? (activeTafsirAyah || selectedAyah) : (selectedAyah || activeTafsirAyah)}
                        playingAyah={playingAyah}
                        onSelectAyah={ayah => handleSelectAyahFromPage(ayah, pageNum)}
                        onFallback={onFallback}
                        maxWidthClass="max-w-none"
                        sessionAyahKeys={sessionAyahKeys}
                        bookHalf="single"
                        showPageHeader
                        isActiveReadingPage={pageNum === readingPage}
                      />
                    </MushafPaperFlipStage>
                  </div>
                );
              })}
            </div>
          ) : (
            <MushafPaperFlipStage
              anchorPage={readingPage}
              isTwoPage={isTwoPage}
              canTurnNext={isTwoPage ? leftPage < 604 : readingPage < 604}
              canTurnPrev={isTwoPage ? rightPage > 1 : readingPage > 1}
              onTurnNext={() => {
                const target = stepSpreadPage(readingPage, 'next', isTwoPage, {
                  isOppositeTafsirActive: false,
                });
                dragCommittedTargetRef.current = target;
                onAnchorPageChange?.(target);
              }}
              onTurnPrev={() => {
                const target = stepSpreadPage(readingPage, 'prev', isTwoPage, {
                  isOppositeTafsirActive: false,
                });
                dragCommittedTargetRef.current = target;
                onAnchorPageChange?.(target);
              }}
              ribbons={ribbons}
              visiblePages={visiblePages}
              programmaticTurn={programmaticTurn}
              onProgrammaticTurnComplete={handleProgrammaticTurnComplete}
            >
              <div
                className={`grid items-stretch ${
                  isTwoPage ? 'grid-cols-1 md:grid-cols-2 gap-0' : 'grid-cols-1'
                }`}
              >
                {spreadSlots.map(pageNum => (
                  <div key={`spread-page-${pageNum}`} className="min-w-0 h-full">
                    <QuranMushafFacsimilePage
                      page={pageNum}
                      onAyahsResolved={handleAyahsResolved}
                      selectedAyah={autoOpenTafsirOnSelect ? (activeTafsirAyah || selectedAyah) : (selectedAyah || activeTafsirAyah)}
                      playingAyah={playingAyah}
                      onSelectAyah={ayah => handleSelectAyahFromPage(ayah, pageNum)}
                      onFallback={onFallback}
                      maxWidthClass="max-w-none"
                      sessionAyahKeys={sessionAyahKeys}
                      bookHalf={
                        isTwoPage
                          ? pageNum === rightPage
                            ? 'right'
                            : 'left'
                          : 'single'
                      }
                      showPageHeader={isTwoPage}
                      isActiveReadingPage={pageNum === readingPage}
                    />
                  </div>
                ))}
              </div>
            </MushafPaperFlipStage>
          )}
        </div>

        {/* Desktop Slide-Over Side Panel Option (keeps both facing pages visible) */}
        {showSideSlideOverPanel && activeTafsirAyah && (
          <aside
            aria-label="لوحة التفسير الجانبية"
            className="w-full lg:w-[400px] xl:w-[440px] shrink-0 rounded-[var(--wird-radius-card)] border border-[var(--wird-border-gold)] shadow-xl overflow-hidden max-h-[820px] flex flex-col bg-[var(--wird-surface)]"
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
