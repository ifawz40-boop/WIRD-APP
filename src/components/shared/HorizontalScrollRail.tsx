import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface HorizontalScrollRailProps {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
  activeKey?: string | number;
  showArrowsOnDesktop?: boolean;
}

/**
 * Smooth horizontal scrollable rail with drag/wheel scrolling, RTL-aware arrow controls,
 * and automatic centering of the active item.
 */
export const HorizontalScrollRail: React.FC<HorizontalScrollRailProps> = ({
  children,
  ariaLabel,
  className = '',
  contentClassName = '',
  activeKey,
  showArrowsOnDesktop = true
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const updateScrollBounds = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 4) {
      setCanScrollStart(false);
      setCanScrollEnd(false);
      return;
    }
    const left = Math.abs(el.scrollLeft);
    setCanScrollStart(left > 6);
    setCanScrollEnd(left < maxScroll - 6);
  }, []);

  useEffect(() => {
    updateScrollBounds();
    const el = scrollerRef.current;
    if (!el) return;
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollBounds) : null;
    resizeObserver?.observe(el);
    window.addEventListener('resize', updateScrollBounds);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateScrollBounds);
    };
  }, [updateScrollBounds, children]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || activeKey === undefined) return;
    const activeEl = el.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"], [data-rail-active="true"]');
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeKey]);

  const scrollStep = (direction: 'prev' | 'next') => {
    const el = scrollerRef.current;
    if (!el) return;
    // In RTL, negative scrollLeft moves toward end (left visually) and positive moves toward start (right visually)
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const delta = Math.max(180, Math.round(el.clientWidth * 0.55));
    const offset = direction === 'next' ? (isRtl ? -delta : delta) : (isRtl ? delta : -delta);
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth + 4) {
      el.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className={`relative flex items-center gap-1.5 min-w-0 w-full ${className}`}>
      {showArrowsOnDesktop && canScrollStart && (
        <button
          type="button"
          onClick={() => scrollStep('prev')}
          aria-label={`التمرير للخلف في ${ariaLabel}`}
          className="hidden sm:inline-flex shrink-0 min-h-10 min-w-10 items-center justify-center rounded-xl bg-[var(--wird-surface)]/95 border border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-surface-muted)] shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <div
        ref={scrollerRef}
        onScroll={updateScrollBounds}
        onWheel={handleWheel}
        role="region"
        aria-label={ariaLabel}
        className={`flex-1 min-w-0 overflow-x-auto no-scrollbar wird-scroll-rail flex items-center gap-2 py-0.5 ${contentClassName}`}
      >
        {children}
      </div>

      {showArrowsOnDesktop && canScrollEnd && (
        <button
          type="button"
          onClick={() => scrollStep('next')}
          aria-label={`التمرير للأمام في ${ariaLabel}`}
          className="hidden sm:inline-flex shrink-0 min-h-10 min-w-10 items-center justify-center rounded-xl bg-[var(--wird-surface)]/95 border border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-surface-muted)] shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
