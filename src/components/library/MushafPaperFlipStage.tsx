import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MushafRibbonBookmark } from '../../services/mushafRibbonBookmarksService';
import {
  getCachedMushafFacsimilePageSync,
  loadMushafFacsimilePage,
  preloadAdjacentMushafPages,
  type MushafFacsimilePageData,
} from '../../services/mushafFacsimileService';
import {
  computeDragProgress,
  computePageCurlGeometry,
  easeInOutCubic,
  easeOutCubic,
  evaluateGestureAxisLock,
  resolveMushafTurnPages,
  shouldCommitPageTurn,
  type GestureAxisLock,
  type GesturePointerKind,
  type MushafTurnDirection,
  type MushafTurnPages,
} from '../../services/mushafPaperCurlEngine';

export interface ProgrammaticTurnRequest {
  id: number;
  direction: MushafTurnDirection;
  targetAnchorPage: number;
}

interface MushafPaperFlipStageProps {
  anchorPage: number;
  isTwoPage: boolean;
  canTurnNext: boolean;
  canTurnPrev: boolean;
  onTurnNext: () => void;
  onTurnPrev: () => void;
  ribbons?: MushafRibbonBookmark[];
  visiblePages: number[];
  /** Optional smooth animated turn triggered by external buttons or keyboard arrows. */
  programmaticTurn?: ProgrammaticTurnRequest | null;
  onProgrammaticTurnComplete?: (requestId: number) => void;
  children: React.ReactNode;
}

/**
 * Lightweight, zero-overhead static visual preview of a printed Mushaf page used
 * exclusively on the `under` and `fold` layers during a 60fps physical page curl.
 * Never attaches duplicate DOM IDs, ARIA buttons, or click listeners.
 */
const MushafStaticPageLeaf: React.FC<{
  page: number;
  bookHalf: 'single' | 'right' | 'left';
  showPageHeader: boolean;
}> = memo(({ page, bookHalf, showPageHeader }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<MushafFacsimilePageData | null>(() =>
    getCachedMushafFacsimilePageSync(page)
  );

  useEffect(() => {
    const cached = getCachedMushafFacsimilePageSync(page);
    if (cached) {
      setData(cached);
      return;
    }
    let cancelled = false;
    void loadMushafFacsimilePage(page)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch(() => {
        // Keep clean parchment fallback frame if offline and uncached
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !data) return;
    const svg = host.querySelector('svg');
    if (!(svg instanceof SVGSVGElement)) return;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.maxHeight = '100%';
    svg.style.display = 'block';
    if (page <= 2) {
      try {
        const bounds = svg.getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          const padding = Math.max(bounds.width, bounds.height) * 0.04;
          svg.setAttribute(
            'viewBox',
            `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
          );
        }
      } catch {
        // Keep publisher viewBox
      }
    }
  }, [data, page]);

  const shapeClass =
    bookHalf === 'right'
      ? 'rounded-r-2xl rounded-l-none border-l-0'
      : bookHalf === 'left'
        ? 'rounded-l-2xl rounded-r-none border-r-0'
        : 'rounded-2xl';

  return (
    <figure
      className={`mushaf-printed-leaf relative flex h-full w-full flex-col justify-between overflow-hidden border border-[#C59B27]/45 bg-[var(--wird-mushaf-paper)] p-2 dark:border-[#E0A96D]/35 dark:bg-[#0E1A2F] sm:p-4 ${shapeClass}`}
    >
      {showPageHeader && (
        <div className="mb-1.5 shrink-0 flex items-center justify-between px-1 text-[11px] font-bold text-[var(--wird-muted)] tabular-nums">
          <span>صفحة {page}</span>
        </div>
      )}
      {data ? (
        <div
          ref={hostRef}
          className="mushaf-facsimile-svg min-h-0 w-full flex-1 flex items-center justify-center overflow-hidden"
          dangerouslySetInnerHTML={{ __html: data.svgMarkup }}
        />
      ) : (
        <div className="flex flex-1 min-h-0 items-center justify-center text-xs font-semibold text-[var(--wird-muted)]">
          صفحة {page}
        </div>
      )}
      <figcaption className="mt-2 shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-[#C59B27]/30 px-2 pt-2 text-[10px] text-[#5B6F6B] dark:border-[#E0A96D]/25 dark:text-[#8B9E9B]">
        <span>رسم الصفحة: مجمع الملك فهد لطباعة المصحف الشريف</span>
        <span>مواضع الآيات التفاعلية: Quran.ws · الإصدار 1.1.1</span>
      </figcaption>
    </figure>
  );
});
MushafStaticPageLeaf.displayName = 'MushafStaticPageLeaf';

/**
 * Realistic paper back-face used in 1-page reading mode when a single sheet curls away,
 * showing warm paper grain and a faint reverse-bleed silhouette of the turning page.
 */
const MushafSinglePaperBackLeaf: React.FC<{ frontPage: number }> = memo(({ frontPage }) => {
  const [data] = useState<MushafFacsimilePageData | null>(() =>
    getCachedMushafFacsimilePageSync(frontPage)
  );
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#C59B27]/40 bg-[var(--wird-mushaf-paper)] dark:border-[#E0A96D]/30 dark:bg-[#0C172A] p-3 sm:p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(197, 155, 39, 0.06) 0%, rgba(255, 252, 244, 0.08) 45%, rgba(20, 14, 6, 0.07) 100%)',
        }}
      />
      {data && (
        <div
          className="mushaf-facsimile-svg w-full h-full opacity-[0.07] dark:opacity-[0.09] scale-x-[-1]"
          dangerouslySetInnerHTML={{ __html: data.svgMarkup }}
        />
      )}
    </div>
  );
});
MushafSinglePaperBackLeaf.displayName = 'MushafSinglePaperBackLeaf';

interface ActiveTurnOverlayState {
  turn: MushafTurnPages;
  phase: 'dragging' | 'animating';
  committing: boolean;
  canTurn: boolean;
  gripYRatio: number;
}

interface PointerSession {
  pointerId: number;
  pointerType: GesturePointerKind;
  originX: number;
  originY: number;
  lockX: number;
  lockY: number;
  startTime: number;
  axis: GestureAxisLock;
  direction: MushafTurnDirection | null;
  canTurn: boolean;
  gripYRatio: number;
  progress: number;
  verticalDragPx: number;
  dragActive: boolean;
}

function normalizePointerKind(raw: string): GesturePointerKind {
  if (raw === 'mouse') return 'mouse';
  if (raw === 'pen') return 'pen';
  return 'touch';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Realistic RTL Physical Mushaf Binding & Single-Leaf Planar Page-Curl Stage.
 *
 * - In 2-page spread mode: ONLY the turning leaf curls across the center spine while
 *   the opposite page stays completely stationary; the true destination page reveals
 *   underneath (`under`) and the real verso page rides upright on the folded back (`fold`).
 * - In 1-page mode: the active page peels smoothly from the dragged edge, revealing
 *   the target page directly underneath with realistic crease lighting and cast shadow.
 * - Strict touch/multi-touch ergonomics: taps (< 22px), vertical scrolls, diagonal thumb
 *   drifts, and pinch-to-zoom gestures NEVER accidentally flip pages.
 */
export const MushafPaperFlipStage: React.FC<MushafPaperFlipStageProps> = ({
  anchorPage,
  isTwoPage,
  canTurnNext,
  canTurnPrev,
  onTurnNext,
  onTurnPrev,
  ribbons = [],
  visiblePages,
  programmaticTurn,
  onProgrammaticTurnComplete,
  children,
}) => {
  const bookRef = useRef<HTMLDivElement | null>(null);
  const underLayerRef = useRef<HTMLDivElement | null>(null);
  const underShadowRef = useRef<HTMLDivElement | null>(null);
  const foldClipRef = useRef<HTMLDivElement | null>(null);
  const foldLeafRef = useRef<HTMLDivElement | null>(null);
  const creaseHighlightRef = useRef<HTMLDivElement | null>(null);

  const activePointersRef = useRef<Set<number>>(new Set());
  const sessionRef = useRef<PointerSession | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const clearOverlayRafRef = useRef<number | null>(null);
  const latestGeometryArgsRef = useRef<{
    direction: MushafTurnDirection;
    progress: number;
    gripYRatio: number;
    verticalDragPx: number;
    isTwoPage: boolean;
  } | null>(null);
  const lastHandledProgrammaticIdRef = useRef<number>(0);

  const [activeTurn, setActiveTurn] = useState<ActiveTurnOverlayState | null>(null);

  // Warm adjacent spreads into RAM whenever anchorPage changes so curls start in 0ms
  useEffect(() => {
    preloadAdjacentMushafPages(anchorPage);
  }, [anchorPage]);

  const cancelRunningAnimation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (clearOverlayRafRef.current !== null) {
      cancelAnimationFrame(clearOverlayRafRef.current);
      clearOverlayRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    const releasePointer = (ev: PointerEvent) => {
      activePointersRef.current.delete(ev.pointerId);
    };
    const clearAllPointers = () => {
      activePointersRef.current.clear();
    };
    window.addEventListener('pointerup', releasePointer, true);
    window.addEventListener('pointercancel', releasePointer, true);
    window.addEventListener('blur', clearAllPointers);
    return () => {
      window.removeEventListener('pointerup', releasePointer, true);
      window.removeEventListener('pointercancel', releasePointer, true);
      window.removeEventListener('blur', clearAllPointers);
      cancelRunningAnimation();
    };
  }, [cancelRunningAnimation]);

  /**
   * Applies planar page-curl clip polygons, rigid verso transform, and crease lighting
   * directly onto DOM refs for rock-solid 60fps with zero React re-renders per frame.
   */
  const paintCurlFrame = useCallback(
    (params: {
      direction: MushafTurnDirection;
      progress: number;
      gripYRatio: number;
      verticalDragPx: number;
      isTwoPage: boolean;
    }) => {
      latestGeometryArgsRef.current = params;
      const bookEl = bookRef.current;
      if (!bookEl) return;

      const rect = bookEl.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) return;

      const geom = computePageCurlGeometry({
        bookWidth: rect.width,
        bookHeight: rect.height,
        isTwoPage: params.isTwoPage,
        direction: params.direction,
        progress: params.progress,
        gripYRatio: params.gripYRatio,
        verticalDragPx: params.verticalDragPx,
      });

      bookEl.dataset.mushafTurnProgress = geom.progress.toFixed(3);

      const underEl = underLayerRef.current;
      if (underEl) {
        underEl.style.clipPath = geom.underClipCss;
        (underEl.style as CSSStyleDeclaration & { webkitClipPath?: string }).webkitClipPath =
          geom.underClipCss;
      }

      const foldClipEl = foldClipRef.current;
      if (foldClipEl) {
        foldClipEl.style.clipPath = geom.foldClipCss;
        (foldClipEl.style as CSSStyleDeclaration & { webkitClipPath?: string }).webkitClipPath =
          geom.foldClipCss;
      }

      const foldLeafEl = foldLeafRef.current;
      if (foldLeafEl) {
        foldLeafEl.style.width = `${geom.pageWidth.toFixed(2)}px`;
        foldLeafEl.style.height = `${geom.bookHeight.toFixed(2)}px`;
        foldLeafEl.style.transform = geom.backTransformCss;
        const dropAlpha = (0.28 * geom.crease.intensity).toFixed(3);
        const dropBlur = Math.round(18 + 20 * geom.crease.intensity);
        // Composited box-shadow avoids expensive per-frame SVG filter rasterization on mobile/CPU
        foldLeafEl.style.boxShadow =
          geom.crease.intensity > 0.01
            ? `0 10px ${dropBlur}px -4px rgba(18, 13, 5, ${dropAlpha})`
            : 'none';
      }

      const underSlotOriginX =
        params.direction === 'prev' && params.isTwoPage ? geom.pageWidth : 0;

      const underShadowEl = underShadowRef.current;
      if (underShadowEl) {
        const localX = geom.crease.x - underSlotOriginX;
        const localY = geom.crease.y;
        const sw = Math.max(38, geom.crease.underShadowWidthPx);
        const a1 = (0.38 * geom.crease.intensity).toFixed(3);
        const a2 = (0.17 * geom.crease.intensity).toFixed(3);
        const a3 = (0.05 * geom.crease.intensity).toFixed(3);
        underShadowEl.style.width = `${sw.toFixed(1)}px`;
        underShadowEl.style.height = `${geom.crease.lengthPx.toFixed(1)}px`;
        underShadowEl.style.transform = `translate3d(${localX.toFixed(1)}px, ${(localY - geom.crease.lengthPx / 2).toFixed(1)}px, 0) rotate(${geom.crease.angleDeg.toFixed(2)}deg) translateX(-100%)`;
        underShadowEl.style.transformOrigin = `0 ${(geom.crease.lengthPx / 2).toFixed(1)}px`;
        underShadowEl.style.background = `linear-gradient(to left, rgba(16, 11, 4, ${a1}) 0%, rgba(16, 11, 4, ${a2}) 32%, rgba(16, 11, 4, ${a3}) 68%, transparent 100%)`;
        underShadowEl.style.opacity = geom.crease.intensity > 0.005 ? '1' : '0';
      }

      const highlightEl = creaseHighlightRef.current;
      if (highlightEl) {
        const fw = Math.max(36, geom.crease.foldShadeWidthPx * 1.55);
        const edgeDark = (0.34 * geom.crease.intensity).toFixed(3);
        const ridgeGlow = (0.46 * geom.crease.intensity).toFixed(3);
        const innerShade = (0.16 * geom.crease.intensity).toFixed(3);
        highlightEl.style.width = `${fw.toFixed(1)}px`;
        highlightEl.style.height = `${geom.crease.lengthPx.toFixed(1)}px`;
        highlightEl.style.transform = `translate3d(${geom.crease.x.toFixed(1)}px, ${(geom.crease.y - geom.crease.lengthPx / 2).toFixed(1)}px, 0) rotate(${geom.crease.angleDeg.toFixed(2)}deg)`;
        highlightEl.style.transformOrigin = `0 ${(geom.crease.lengthPx / 2).toFixed(1)}px`;
        highlightEl.style.background = `linear-gradient(to right, rgba(22, 15, 5, ${edgeDark}) 0%, rgba(255, 251, 240, ${ridgeGlow}) 18%, rgba(24, 17, 7, ${innerShade}) 48%, transparent 100%)`;
        highlightEl.style.opacity = geom.crease.intensity > 0.005 ? '1' : '0';
      }
    },
    []
  );

  // Immediately paint geometry on the very frame activeTurn mounts so there is zero unclipped flash
  useLayoutEffect(() => {
    if (!activeTurn || !latestGeometryArgsRef.current) return;
    paintCurlFrame(latestGeometryArgsRef.current);
  }, [activeTurn, paintCurlFrame]);

  const animateCurl = useCallback(
    (opts: {
      fromProgress: number;
      toProgress: number;
      fromVerticalPx: number;
      direction: MushafTurnDirection;
      gripYRatio: number;
      turnIsTwoPage: boolean;
      durationMs: number;
      easing: (t: number) => number;
      onDone: () => void;
    }) => {
      cancelRunningAnimation();
      const startTime = performance.now();
      const duration = Math.max(60, opts.durationMs);

      const step = (now: number) => {
        const rawT = Math.min(1, (now - startTime) / duration);
        const eased = opts.easing(rawT);
        const currentProgress =
          opts.fromProgress + (opts.toProgress - opts.fromProgress) * eased;
        const currentVert = opts.fromVerticalPx * (1 - eased);

        paintCurlFrame({
          direction: opts.direction,
          progress: currentProgress,
          gripYRatio: opts.gripYRatio,
          verticalDragPx: currentVert,
          isTwoPage: opts.turnIsTwoPage,
        });

        if (rawT < 1) {
          rafIdRef.current = requestAnimationFrame(step);
        } else {
          rafIdRef.current = null;
          opts.onDone();
        }
      };

      rafIdRef.current = requestAnimationFrame(step);
    },
    [cancelRunningAnimation, paintCurlFrame]
  );

  const settleOverlayCleanly = useCallback(() => {
    // Wait two frames so the updated React spread underneath paints before removing the overlay
    clearOverlayRafRef.current = requestAnimationFrame(() => {
      clearOverlayRafRef.current = requestAnimationFrame(() => {
        clearOverlayRafRef.current = null;
        latestGeometryArgsRef.current = null;
        setActiveTurn(null);
      });
    });
  }, []);

  // Support smooth single-leaf curl when Next/Prev buttons or keyboard arrows turn the page
  useEffect(() => {
    if (!programmaticTurn) return;
    if (programmaticTurn.id === lastHandledProgrammaticIdRef.current) return;
    lastHandledProgrammaticIdRef.current = programmaticTurn.id;

    if (prefersReducedMotion()) {
      onProgrammaticTurnComplete?.(programmaticTurn.id);
      return;
    }

    const turnPages = resolveMushafTurnPages({
      anchorPage,
      isTwoPage,
      direction: programmaticTurn.direction,
    });
    if (!turnPages) {
      onProgrammaticTurnComplete?.(programmaticTurn.id);
      return;
    }

    latestGeometryArgsRef.current = {
      direction: programmaticTurn.direction,
      progress: 0.001,
      gripYRatio: 0.76,
      verticalDragPx: 0,
      isTwoPage,
    };
    setActiveTurn({
      turn: turnPages,
      phase: 'animating',
      committing: true,
      canTurn: true,
      gripYRatio: 0.76,
    });

    animateCurl({
      fromProgress: 0.001,
      toProgress: 1,
      fromVerticalPx: 0,
      direction: programmaticTurn.direction,
      gripYRatio: 0.76,
      turnIsTwoPage: isTwoPage,
      durationMs: 360,
      easing: easeInOutCubic,
      onDone: () => {
        onProgrammaticTurnComplete?.(programmaticTurn.id);
        settleOverlayCleanly();
      },
    });
  }, [
    programmaticTurn,
    anchorPage,
    isTwoPage,
    animateCurl,
    onProgrammaticTurnComplete,
    settleOverlayCleanly,
  ]);

  const cancelActiveDrag = useCallback(() => {
    const st = sessionRef.current;
    sessionRef.current = null;
    if (!st || !st.dragActive || !st.direction) return;

    const dir = st.direction;
    const startP = st.progress;
    const startVert = st.verticalDragPx;
    const gripY = st.gripYRatio;
    const snapMs = Math.round(140 + Math.min(1, startP) * 140);

    setActiveTurn((prev) => (prev ? { ...prev, phase: 'animating', committing: false } : null));
    animateCurl({
      fromProgress: startP,
      toProgress: 0,
      fromVerticalPx: startVert,
      direction: dir,
      gripYRatio: gripY,
      turnIsTwoPage: isTwoPage,
      durationMs: snapMs,
      easing: easeOutCubic,
      onDone: () => {
        latestGeometryArgsRef.current = null;
        setActiveTurn(null);
      },
    });
  }, [animateCurl, isTwoPage]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.add(e.pointerId);

    // Multi-touch (pinch-to-zoom or two-finger gesture): cancel any pending/active page drag immediately
    if (activePointersRef.current.size > 1 || !e.isPrimary) {
      cancelActiveDrag();
      return;
    }

    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Never interrupt an active committing turn, but allow a new gesture to cleanly interrupt a cancel snap-back
    if (activeTurn?.phase === 'animating') {
      if (activeTurn.committing) return;
      cancelRunningAnimation();
      latestGeometryArgsRef.current = null;
      setActiveTurn(null);
    }

    // Ignore gestures starting inside controls, side/opposite Tafsir panes, links, or dialogs
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'aside, [aria-label="التفسير بدلاً من الصفحة المقابلة"], [role="dialog"], button:not(.mushaf-ayah-hit-area), select, input, textarea, a'
      )
    ) {
      return;
    }

    // Prevent accidental mouse text-selection drag across the book; keep touch native for smooth vertical scroll
    if (e.pointerType === 'mouse') {
      e.preventDefault();
    }

    const bookEl = bookRef.current;
    const rect = bookEl?.getBoundingClientRect();
    const gripYRatio =
      rect && rect.height > 0
        ? Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height))
        : 0.72;

    sessionRef.current = {
      pointerId: e.pointerId,
      pointerType: normalizePointerKind(e.pointerType),
      originX: e.clientX,
      originY: e.clientY,
      lockX: e.clientX,
      lockY: e.clientY,
      startTime: performance.now(),
      axis: 'pending',
      direction: null,
      canTurn: false,
      gripYRatio,
      progress: 0,
      verticalDragPx: 0,
      dragActive: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = sessionRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    if (activePointersRef.current.size > 1) {
      cancelActiveDrag();
      return;
    }

    const rawDx = e.clientX - st.originX;
    const rawDy = e.clientY - st.originY;

    if (st.axis === 'y') return;

    if (st.axis === 'pending') {
      const decision = evaluateGestureAxisLock(rawDx, rawDy, st.pointerType);
      if (decision === 'pending') return;
      st.axis = decision;
      if (decision === 'y') {
        // Vertical scroll — release control back to the browser
        return;
      }

      // Locked horizontal! Determine RTL turn direction:
      // Left-to-Right (dx > 0) lifts left leaf -> NEXT page in RTL
      // Right-to-Left (dx < 0) lifts right leaf -> PREVIOUS page in RTL
      const direction: MushafTurnDirection = rawDx > 0 ? 'next' : 'prev';
      const canTurn = direction === 'next' ? canTurnNext : canTurnPrev;
      const turnPages = resolveMushafTurnPages({
        anchorPage,
        isTwoPage,
        direction,
      });

      // Reset drag lock origin to current pointer position so the corner lifts smoothly with zero jump
      st.direction = direction;
      st.canTurn = canTurn && Boolean(turnPages);
      st.lockX = e.clientX;
      st.lockY = e.clientY;
      st.dragActive = true;

      try {
        bookRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer cannot be captured
      }

      if (turnPages && !prefersReducedMotion()) {
        latestGeometryArgsRef.current = {
          direction,
          progress: 0.001,
          gripYRatio: st.gripYRatio,
          verticalDragPx: 0,
          isTwoPage,
        };
        setActiveTurn({
          turn: turnPages,
          phase: 'dragging',
          committing: false,
          canTurn: st.canTurn,
          gripYRatio: st.gripYRatio,
        });
      }
      return;
    }

    if (!st.dragActive || !st.direction) return;

    const bookWidth = bookRef.current?.clientWidth || 720;
    const dxAfterLock = e.clientX - st.lockX;
    const dyAfterLock = e.clientY - st.lockY;
    const progress = computeDragProgress({
      dxAfterLock,
      bookWidth,
      isTwoPage,
      direction: st.direction,
      canTurn: st.canTurn,
    });

    st.progress = progress;
    st.verticalDragPx = dyAfterLock;

    if (!prefersReducedMotion()) {
      paintCurlFrame({
        direction: st.direction,
        progress,
        gripYRatio: st.gripYRatio,
        verticalDragPx: dyAfterLock,
        isTwoPage,
      });
    }
  };

  const finishPointerGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    activePointersRef.current.delete(e.pointerId);
    const st = sessionRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    sessionRef.current = null;

    try {
      if (bookRef.current?.hasPointerCapture(e.pointerId)) {
        bookRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Already released
    }

    // Pure tap or vertical scroll — never entered drag mode -> let ayah clicks work untouched!
    if (!st.dragActive || !st.direction) return;

    // Suppress the trailing synthetic click event right after a page drag so Tafsir does not pop open
    const suppressClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', suppressClick, { capture: true, once: true });
    window.setTimeout(
      () => window.removeEventListener('click', suppressClick, { capture: true }),
      120
    );

    const totalDx = e.clientX - st.originX;
    const totalDy = e.clientY - st.originY;
    const elapsedMs = Math.max(1, performance.now() - st.startTime);

    const commit = shouldCommitPageTurn({
      progress: st.progress,
      totalDx,
      totalDy,
      elapsedMs,
      pointerType: st.pointerType,
      canTurn: st.canTurn,
      cancelled,
    });

    const dir = st.direction;

    if (prefersReducedMotion()) {
      latestGeometryArgsRef.current = null;
      setActiveTurn(null);
      if (commit) {
        if (dir === 'next') onTurnNext();
        else onTurnPrev();
      }
      return;
    }

    const remaining = commit ? 1 - st.progress : st.progress;
    const durationMs = commit
      ? Math.round(180 + remaining * 190)
      : Math.round(140 + remaining * 150);

    setActiveTurn((prev) =>
      prev ? { ...prev, phase: 'animating', committing: commit } : null
    );

    animateCurl({
      fromProgress: st.progress,
      toProgress: commit ? 1 : 0,
      fromVerticalPx: st.verticalDragPx,
      direction: dir,
      gripYRatio: st.gripYRatio,
      turnIsTwoPage: isTwoPage,
      durationMs,
      easing: easeOutCubic,
      onDone: () => {
        if (commit) {
          if (dir === 'next') onTurnNext();
          else onTurnPrev();
          settleOverlayCleanly();
        } else {
          latestGeometryArgsRef.current = null;
          setActiveTurn(null);
        }
      },
    });
  };

  // Proportional paper fore-edge stack thickness (1..604)
  const progressRatio = Math.min(1, Math.max(0, (anchorPage - 1) / 603));
  // Pages already read sit on the RIGHT side in an RTL book; unread pages sit on the LEFT side
  const rightStackPx = Math.round(3 + progressRatio * 10);
  const leftStackPx = Math.round(3 + (1 - progressRatio) * 10);

  const activeRibbonsOnVisiblePages = ribbons.filter(
    (r) => r.page !== null && visiblePages.includes(r.page)
  );

  const turnStateAttr = activeTurn ? activeTurn.phase : 'idle';
  const turnDirAttr = activeTurn ? activeTurn.turn.direction : 'none';

  return (
    <div
      data-mushaf-paper-stage={turnStateAttr}
      className="mushaf-book-binding relative select-none rounded-[1.35rem] p-1.5 sm:p-2.5"
      style={{
        paddingRight: `${rightStackPx + 6}px`,
        paddingLeft: `${leftStackPx + 6}px`,
      }}
    >
      {/* Right Stacked Paper Fore-Edge (Pages already read in RTL) */}
      <div
        aria-hidden="true"
        className="mushaf-paper-stack-edge mushaf-paper-stack-right pointer-events-none"
        style={{ width: `${rightStackPx}px` }}
      />

      {/* Left Stacked Paper Fore-Edge (Pages remaining in RTL) */}
      <div
        aria-hidden="true"
        className="mushaf-paper-stack-edge mushaf-paper-stack-left pointer-events-none"
        style={{ width: `${leftStackPx}px` }}
      />

      {/* Hanging Colored Silk Ribbon Bookmarks on Visible Pages */}
      {activeRibbonsOnVisiblePages.length > 0 && (
        <div
          aria-label="الفواصل المرجعية على هذه الصفحة"
          className="pointer-events-none absolute -top-2 inset-x-8 z-30 flex items-start justify-end gap-2 px-4"
        >
          {activeRibbonsOnVisiblePages.map((ribbon) => (
            <div
              key={ribbon.id}
              title={`${ribbon.labelAr} (صفحة ${ribbon.page})`}
              className="flex flex-col items-center drop-shadow-md"
            >
              <div
                className="w-6 sm:w-7 h-9 sm:h-11 rounded-t-xs flex items-start justify-center pt-1.5 text-[9px] font-bold text-white"
                style={{
                  backgroundColor: ribbon.colorHex,
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
                }}
              >
                <span className="sr-only">{ribbon.labelAr}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Book Spread Surface (Vertical scroll + Pinch-zoom stay native via touch-action) */}
      <div
        ref={bookRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPointerGesture(e, false)}
        onPointerCancel={(e) => finishPointerGesture(e, true)}
        data-testid="mushaf-book-surface"
        data-mushaf-turn-state={turnStateAttr}
        data-mushaf-turn-direction={turnDirAttr}
        data-mushaf-turn-progress="0"
        className={`mushaf-book-surface relative z-10 rounded-2xl ${
          activeTurn?.phase === 'dragging' ? 'cursor-grabbing' : ''
        } ${!isTwoPage ? 'overflow-hidden' : ''}`}
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        {/* Base Stationary Spread (Neither page ever tilts or shakes as a rigid block!) */}
        {children}

        {/* Center Book Spine Gutter Shadow in 2-Page Facing Spread Mode */}
        {isTwoPage && (
          <div
            aria-hidden="true"
            className="mushaf-center-spine-gutter hidden md:block pointer-events-none"
          />
        )}

        {/* Planar Single-Leaf Page-Curl Overlay (Mounted ONLY during active drag/turn) */}
        {activeTurn && (
          <div
            aria-hidden="true"
            data-testid="mushaf-turn-overlay"
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl"
          >
            {/* Layer 1: Revealed destination page underneath the peeled corner */}
            <div
              ref={underLayerRef}
              data-testid="mushaf-turn-under"
              className="absolute top-0 bottom-0 overflow-hidden"
              style={{
                left:
                  activeTurn.turn.isTwoPage && activeTurn.turn.turningSide === 'right'
                    ? '50%'
                    : '0%',
                width: activeTurn.turn.isTwoPage ? '50%' : '100%',
              }}
            >
              <MushafStaticPageLeaf
                page={activeTurn.turn.underPage}
                bookHalf={
                  activeTurn.turn.isTwoPage
                    ? activeTurn.turn.turningSide === 'left'
                      ? 'left'
                      : 'right'
                    : 'single'
                }
                showPageHeader={activeTurn.turn.isTwoPage}
              />
              {/* Soft shadow cast by the curling leaf onto the newly revealed page below */}
              <div
                ref={underShadowRef}
                className="pointer-events-none absolute left-0 top-0 will-change-transform"
              />
            </div>

            {/* Layer 2: Folded verso leaf + cylindrical crease lighting, clipped cleanly at the fold line */}
            <div
              ref={foldClipRef}
              data-testid="mushaf-turn-fold"
              className="absolute inset-0 overflow-hidden"
            >
              <div
                ref={foldLeafRef}
                className="absolute left-0 top-0 origin-top-left will-change-transform"
              >
                {activeTurn.turn.isTwoPage && activeTurn.turn.backPage !== null ? (
                  <MushafStaticPageLeaf
                    page={activeTurn.turn.backPage}
                    bookHalf={activeTurn.turn.turningSide === 'left' ? 'right' : 'left'}
                    showPageHeader={true}
                  />
                ) : (
                  <MushafSinglePaperBackLeaf frontPage={activeTurn.turn.frontPage} />
                )}
              </div>

              {/* Curved paper-ridge specular highlight & fold shadow running along the crease */}
              <div
                ref={creaseHighlightRef}
                className="pointer-events-none absolute left-0 top-0 will-change-transform"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
