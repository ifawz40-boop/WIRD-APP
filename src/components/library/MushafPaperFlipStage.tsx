import React, { useEffect, useRef, useState } from 'react';
import type { MushafRibbonBookmark } from '../../services/mushafRibbonBookmarksService';

interface MushafPaperFlipStageProps {
  anchorPage: number;
  isTwoPage: boolean;
  canTurnNext: boolean;
  canTurnPrev: boolean;
  onTurnNext: () => void;
  onTurnPrev: () => void;
  ribbons?: MushafRibbonBookmark[];
  visiblePages: number[];
  children: React.ReactNode;
}

/**
 * Realistic RTL Physical Mushaf Binding & Interactive 3D Paper Drag-to-Curl Stage.
 * - Dragging Left-to-Right (dx > 0) lifts the left page edge and turns forward (NEXT page in RTL).
 * - Dragging Right-to-Left (dx < 0) lifts the right page edge and turns backward (PREVIOUS page in RTL).
 * - Short taps (< 12px) pass straight through to interactive SVG ayah polygons without interference.
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
  children,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    dragging: boolean;
  } | null>(null);

  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDraggingPaper, setIsDraggingPaper] = useState(false);
  const [turnAnim, setTurnAnim] = useState<'idle' | 'turning-next' | 'turning-prev'>('idle');
  const prevAnchorRef = useRef<number>(anchorPage);

  // Trigger crisp 3D leaf-settle animation whenever anchorPage changes (via buttons, swipe, or keys)
  useEffect(() => {
    if (prevAnchorRef.current === anchorPage) return;
    const dir = anchorPage > prevAnchorRef.current ? 'turning-next' : 'turning-prev';
    prevAnchorRef.current = anchorPage;
    setTurnAnim(dir);
    const timer = window.setTimeout(() => setTurnAnim('idle'), 340);
    return () => window.clearTimeout(timer);
  }, [anchorPage]);

  // Proportional paper fore-edge stack thickness (1..604)
  const progressRatio = Math.min(1, Math.max(0, (anchorPage - 1) / 603));
  // Pages already read sit on the RIGHT side in an RTL book; unread pages sit on the LEFT side
  const rightStackPx = Math.round(3 + progressRatio * 10);
  const leftStackPx = Math.round(3 + (1 - progressRatio) * 10);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Ignore drags starting inside scrollable side/opposite Tafsir panes or form controls
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'aside, [aria-label="التفسير بدلاً من الصفحة المقابلة"], button:not(.mushaf-ayah-hit-area), select, input, textarea, a'
      )
    ) {
      return;
    }
    pointerStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      dragging: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = pointerStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    if (!st.dragging) {
      if (Math.abs(dx) < 14) return;
      // If user is scrolling vertically, cancel paper drag immediately
      if (Math.abs(dy) > Math.abs(dx) * 0.8) {
        pointerStateRef.current = null;
        return;
      }
      st.dragging = true;
      setIsDraggingPaper(true);
    }

    // Clamp resistance if at the start or end of the Mushaf
    if (dx > 0 && !canTurnNext) {
      setDragDeltaX(Math.min(28, dx * 0.2));
      return;
    }
    if (dx < 0 && !canTurnPrev) {
      setDragDeltaX(Math.max(-28, dx * 0.2));
      return;
    }
    setDragDeltaX(Math.max(-280, Math.min(280, dx)));
  };

  const finishPointerGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = pointerStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    pointerStateRef.current = null;

    if (!st.dragging) {
      setDragDeltaX(0);
      setIsDraggingPaper(false);
      return;
    }

    const dx = e.clientX - st.startX;
    const elapsedMs = Math.max(1, Date.now() - st.startTime);
    const velocity = Math.abs(dx) / elapsedMs; // px/ms
    const passedThreshold = Math.abs(dx) > 68 || (Math.abs(dx) > 32 && velocity > 0.45);

    setDragDeltaX(0);
    setIsDraggingPaper(false);

    if (passedThreshold) {
      // Prevent accidental synthetic click on ayah polygon right after a page-flip drag
      const suppressClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', suppressClick, { capture: true, once: true });
      window.setTimeout(
        () => window.removeEventListener('click', suppressClick, { capture: true }),
        80
      );

      if (dx > 0 && canTurnNext) {
        onTurnNext();
      } else if (dx < 0 && canTurnPrev) {
        onTurnPrev();
      }
    }
  };

  // Compute live 3D curl angle from dragDeltaX
  const stageWidth = stageRef.current?.clientWidth || 720;
  const normalizedDrag = Math.max(-1, Math.min(1, dragDeltaX / (stageWidth * 0.55)));
  const curlDegrees = normalizedDrag * 32; // Smooth physical 3D rotation
  const curlIntensity = Math.min(1, Math.abs(normalizedDrag));

  const activeRibbonsOnVisiblePages = ribbons.filter(
    (r) => r.page !== null && visiblePages.includes(r.page)
  );

  const dynamicTransformStyle: React.CSSProperties = isDraggingPaper
    ? {
        transform: `perspective(2200px) rotateY(${curlDegrees.toFixed(2)}deg) translateX(${(
          dragDeltaX * 0.14
        ).toFixed(1)}px)`,
        transformOrigin: dragDeltaX >= 0 ? 'right center' : 'left center',
        transition: 'none',
        cursor: 'grabbing',
      }
    : {};

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerGesture}
      onPointerCancel={() => {
        pointerStateRef.current = null;
        setDragDeltaX(0);
        setIsDraggingPaper(false);
      }}
      data-mushaf-paper-stage={turnAnim}
      className="mushaf-book-binding relative select-none touch-pan-y rounded-[1.35rem] p-1.5 sm:p-2.5"
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
          className="pointer-events-none absolute -top-2 inset-x-8 z-20 flex items-start justify-end gap-2 px-4"
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

      {/* Main 3D Turning Sheet Container */}
      <div
        className={`relative z-10 will-change-transform ${
          !isDraggingPaper && turnAnim === 'turning-next'
            ? 'animate-mushaf-curl-next'
            : !isDraggingPaper && turnAnim === 'turning-prev'
              ? 'animate-mushaf-curl-prev'
              : ''
        }`}
        style={dynamicTransformStyle}
      >
        {/* Center Book Spine Gutter Shadow in 2-Page Facing Spread Mode */}
        {isTwoPage && (
          <div
            aria-hidden="true"
            className="mushaf-center-spine-gutter hidden md:block pointer-events-none"
          />
        )}

        {children}

        {/* Dynamic Paper-Curl Sheen & Fold Shadow Overlay During Live Drag */}
        {isDraggingPaper && curlIntensity > 0.03 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl z-30 transition-opacity"
            style={{
              background:
                dragDeltaX > 0
                  ? `linear-gradient(to right, rgba(0,0,0,${(0.22 * curlIntensity).toFixed(
                      3
                    )}) 0%, rgba(255,250,235,${(0.28 * curlIntensity).toFixed(
                      3
                    )}) 14%, rgba(0,0,0,${(0.08 * curlIntensity).toFixed(
                      3
                    )}) 28%, transparent 58%)`
                  : `linear-gradient(to left, rgba(0,0,0,${(0.22 * curlIntensity).toFixed(
                      3
                    )}) 0%, rgba(255,250,235,${(0.28 * curlIntensity).toFixed(
                      3
                    )}) 14%, rgba(0,0,0,${(0.08 * curlIntensity).toFixed(
                      3
                    )}) 28%, transparent 58%)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
