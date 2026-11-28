import {
  clampMushafPage,
  getSpreadPairForPage,
  TOTAL_MUSHAF_PAGES,
} from './mushafSpreadService';

export type MushafTurnDirection = 'next' | 'prev';
export type GesturePointerKind = 'touch' | 'pen' | 'mouse';
export type GestureAxisLock = 'pending' | 'x' | 'y';

export interface Point2D {
  x: number;
  y: number;
}

export interface MushafTurnPages {
  direction: MushafTurnDirection;
  isTwoPage: boolean;
  /** Which half of the book lifts off: 'left' for RTL forward, 'right' for RTL backward. */
  turningSide: 'left' | 'right';
  /** The page currently facing up on the turning leaf (stays visible on the un-peeled side). */
  frontPage: number;
  /** The destination page revealed underneath as the turning leaf peels back. */
  underPage: number;
  /**
   * In 2-page mode, the real printed verso page on the back of the turning leaf
   * (e.g., page 5 when turning spread [3,4] -> [5,6]). In 1-page mode, null (warm paper reverse).
   */
  backPage: number | null;
  /** The stationary opposite page in 2-page mode (stays completely unmoved while the leaf turns). */
  stationaryPage: number | null;
  /** Resulting anchor page after the turn commits. */
  targetAnchorPage: number;
}

export interface PageCurlGeometryInput {
  bookWidth: number;
  bookHeight: number;
  isTwoPage: boolean;
  direction: MushafTurnDirection;
  /** Normalized turn progress in [0, 1]. 0 = flat at rest, 1 = completely turned. */
  progress: number;
  /** Vertical ratio [0, 1] where the user grabbed the page (0 = top, 1 = bottom). */
  gripYRatio: number;
  /** Optional vertical drag offset in px (positive = down, negative = up) for organic hand follow. */
  verticalDragPx?: number;
}

export interface PageCurlGeometry {
  progress: number;
  /** Width of a single page slot (bookWidth / 2 in 2-page mode, bookWidth in 1-page mode). */
  pageWidth: number;
  bookWidth: number;
  bookHeight: number;
  /** Original corner of the turning leaf in book coordinates. */
  corner: Point2D;
  /** Spine-constrained current position of the lifted corner in book coordinates. */
  draggedCorner: Point2D;
  /** Midpoint on the fold crease line in book coordinates. */
  foldMidpoint: Point2D;
  /** Unit normal pointing from the lifted corner toward the spine / dragged target. */
  foldNormal: Point2D;
  /** Angle of foldNormal in radians. */
  foldAngleRad: number;
  /** Rotation applied to the verso back-leaf in radians (exact 2 * foldAngleRad, orientation-preserving). */
  backRotationRad: number;
  /** Top-left origin (tx, ty) of the verso back-leaf in book coordinates. */
  backOrigin: Point2D;
  /** CSS transform for the verso back-leaf (`transform-origin: 0 0`). */
  backTransformCss: string;
  /**
   * CSS `clip-path: polygon(...)` in the `under` slot's LOCAL coordinates [0..pageWidth, 0..bookHeight].
   * Reveals the peeled corner (`d <= 1.5px` slight overlap underneath the opaque crease edge to prevent hairline seams).
   */
  underClipCss: string;
  /**
   * CSS `clip-path: polygon(...)` in FULL BOOK coordinates [0..bookWidth, 0..bookHeight].
   * Clips the folded verso leaf cleanly along the fold line (`d >= 0`).
   */
  foldClipCss: string;
  /** Visual crease line metrics in book coordinates for realistic paper highlight & cast shadow. */
  crease: {
    /** Center point on the crease line in book coordinates. */
    x: number;
    y: number;
    /** CSS rotation in degrees so the strip runs perpendicular to the fold normal (along the crease). */
    angleDeg: number;
    /** Length of the crease strip (long enough to span the book diagonally). */
    lengthPx: number;
    /** Width of the soft cast shadow on the under page (px). */
    underShadowWidthPx: number;
    /** Width of the curved lighting/shading gradient on the folded back leaf (px). */
    foldShadeWidthPx: number;
    /** Normalized shading intensity in [0, 1] — smoothly fades to 0 at rest (t=0) and flat landing (t=1). */
    intensity: number;
  };
}

export const MUSHAF_GESTURE_CONSTANTS = {
  /** Touch requires a clear 22px horizontal intent before a page ever begins to lift (prevents accidental taps). */
  AXIS_LOCK_TOUCH_PX: 22,
  /** Mouse drag starts briskly at 12px. */
  AXIS_LOCK_MOUSE_PX: 12,
  /** Horizontal travel must clearly dominate vertical travel (<= ~31deg from horizontal). */
  HORIZONTAL_SLOPE_RATIO: 1.65,
  /** Dragging past 34% of the page turn commits automatically on release. */
  COMMIT_PROGRESS_THRESHOLD: 0.34,
  /** Minimum horizontal travel (px) for a quick touch flick to commit — eliminates tap/micro-jitter flips. */
  FLICK_MIN_PX_TOUCH: 72,
  /** Minimum horizontal travel (px) for a quick mouse flick to commit. */
  FLICK_MIN_PX_MOUSE: 56,
  /** Maximum duration (ms) for a swipe to qualify as a fast flick. */
  FLICK_MAX_MS: 320,
  /** Minimum horizontal velocity (px/ms) for a fast flick. */
  FLICK_MIN_VELOCITY_PX_MS: 0.45,
} as const;

export function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Resolves the exact printed pages participating in an RTL Mushaf page turn.
 * Returns null if the requested direction is out of bounds (before page 1 or after page 604).
 */
export function resolveMushafTurnPages(params: {
  anchorPage: number;
  isTwoPage: boolean;
  direction: MushafTurnDirection;
  totalPages?: number;
}): MushafTurnPages | null {
  const total = params.totalPages ?? TOTAL_MUSHAF_PAGES;
  const safe = clampMushafPage(params.anchorPage);

  if (params.isTwoPage) {
    const [rightPage, leftPage] = getSpreadPairForPage(safe);
    if (params.direction === 'next') {
      const nextRight = rightPage + 2;
      const nextLeft = leftPage + 2;
      if (nextRight > total) return null;
      return {
        direction: 'next',
        isTwoPage: true,
        turningSide: 'left',
        frontPage: leftPage,
        backPage: nextRight,
        underPage: Math.min(total, nextLeft),
        stationaryPage: rightPage,
        targetAnchorPage: nextRight,
      };
    }

    const prevRight = rightPage - 2;
    const prevLeft = leftPage - 2;
    if (prevRight < 1) return null;
    return {
      direction: 'prev',
      isTwoPage: true,
      turningSide: 'right',
      frontPage: rightPage,
      backPage: prevLeft,
      underPage: prevRight,
      stationaryPage: leftPage,
      targetAnchorPage: prevRight,
    };
  }

  // Single-page mode
  if (params.direction === 'next') {
    if (safe >= total) return null;
    return {
      direction: 'next',
      isTwoPage: false,
      turningSide: 'left',
      frontPage: safe,
      backPage: null,
      underPage: safe + 1,
      stationaryPage: null,
      targetAnchorPage: safe + 1,
    };
  }

  if (safe <= 1) return null;
  return {
    direction: 'prev',
    isTwoPage: false,
    turningSide: 'right',
    frontPage: safe,
    backPage: null,
    underPage: safe - 1,
    stationaryPage: null,
    targetAnchorPage: safe - 1,
  };
}

function clampPointInsideCircle(point: Point2D, center: Point2D, radius: number): Point2D {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distSq = dx * dx + dy * dy;
  const rSq = radius * radius;
  if (distSq <= rSq || distSq === 0) {
    return point;
  }
  const scale = radius / Math.sqrt(distSq);
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

/**
 * Enforces physical binding constraints so the turning leaf never tears away from the spine:
 * the lifted outer corner must stay within its original distance to BOTH spine endpoints.
 */
export function computeConstrainedCorner(params: {
  corner: Point2D;
  rawTarget: Point2D;
  spineTop: Point2D;
  spineBottom: Point2D;
}): Point2D {
  const { corner, rawTarget, spineTop, spineBottom } = params;
  const radiusBottom = Math.hypot(corner.x - spineBottom.x, corner.y - spineBottom.y);
  const radiusTop = Math.hypot(corner.x - spineTop.x, corner.y - spineTop.y);

  // Two alternating projections converge immediately for intersecting circles
  let p = { ...rawTarget };
  for (let i = 0; i < 3; i++) {
    p = clampPointInsideCircle(p, spineBottom, radiusBottom);
    p = clampPointInsideCircle(p, spineTop, radiusTop);
  }
  return p;
}

function reflectPointAcrossLine(point: Point2D, linePoint: Point2D, unitNormal: Point2D): Point2D {
  const signedDist = (point.x - linePoint.x) * unitNormal.x + (point.y - linePoint.y) * unitNormal.y;
  return {
    x: point.x - 2 * signedDist * unitNormal.x,
    y: point.y - 2 * signedDist * unitNormal.y,
  };
}

function buildHalfPlanePolygonCss(
  linePoint: Point2D,
  unitNormal: Point2D,
  extent: number,
  keepPositiveSide: boolean,
  offsetPx: number,
  originShiftX = 0,
  originShiftY = 0
): string {
  const sign = keepPositiveSide ? 1 : -1;
  // Normal pointing into the KEPT side
  const nx = unitNormal.x * sign;
  const ny = unitNormal.y * sign;
  // Tangent along the fold line
  const tx = -unitNormal.y;
  const ty = unitNormal.x;

  // Shift line slightly along kept/other side if overlap is requested
  const mx = linePoint.x - nx * offsetPx - originShiftX;
  const my = linePoint.y - ny * offsetPx - originShiftY;

  const p1x = mx - tx * extent;
  const p1y = my - ty * extent;
  const p2x = mx + tx * extent;
  const p2y = my + ty * extent;
  const p3x = p2x + nx * extent;
  const p3y = p2y + ny * extent;
  const p4x = p1x + nx * extent;
  const p4y = p1y + ny * extent;

  return `polygon(${p1x.toFixed(1)}px ${p1y.toFixed(1)}px, ${p2x.toFixed(1)}px ${p2y.toFixed(1)}px, ${p3x.toFixed(1)}px ${p3y.toFixed(1)}px, ${p4x.toFixed(1)}px ${p4y.toFixed(1)}px)`;
}

/**
 * Computes exact planar paper-folding geometry (clip polygons, verso rigid transform, and crease lighting)
 * for both 2-page RTL facing spreads and 1-page reading mode.
 */
export function computePageCurlGeometry(input: PageCurlGeometryInput): PageCurlGeometry {
  const bookWidth = Math.max(100, input.bookWidth);
  const bookHeight = Math.max(100, input.bookHeight);
  const pageWidth = input.isTwoPage ? bookWidth / 2 : bookWidth;
  const t = Math.max(0, Math.min(1, input.progress));
  const gripYRatio = Math.max(0, Math.min(1, input.gripYRatio));
  const verticalDragPx = input.verticalDragPx ?? 0;

  // Bottom grip for lower/middle grabs (most natural for reading), top grip when grabbing upper third
  const isTopGrip = gripYRatio < 0.36;
  const cornerY = isTopGrip ? 0 : bookHeight;

  const isForward = input.direction === 'next';

  // Spine x-coordinate & outer corner x-coordinate in book coordinates [0..bookWidth]
  // - 2-page forward ('next'): Left page [0..W] lifts from x=0, bound at center spine x=W, lands on [W..2W]
  // - 2-page backward ('prev'): Right page [W..2W] lifts from x=2W, bound at center spine x=W, lands on [0..W]
  // - 1-page forward ('next'): Page [0..W] lifts from x=0, bound at right spine x=W, peels off to [W..2W]
  // - 1-page backward ('prev'): Page [0..W] lifts from x=W, bound at left edge x=0, peels off to [-W..0]
  const cornerX = isForward ? 0 : bookWidth;
  const spineX = input.isTwoPage ? pageWidth : isForward ? pageWidth : 0;

  const corner: Point2D = { x: cornerX, y: cornerY };
  const spineTop: Point2D = { x: spineX, y: 0 };
  const spineBottom: Point2D = { x: spineX, y: bookHeight };

  // Avoid degenerate zero-vector at t=0 by enforcing a tiny epsilon for vector math
  const effectiveT = Math.max(0.0005, t);

  // Horizontal sweep spans 2 * pageWidth so at t=1 the fold midpoint reaches spineX
  const targetX = isForward
    ? cornerX + effectiveT * 2 * pageWidth
    : cornerX - effectiveT * 2 * pageWidth;

  // Gentle organic paper arch peaking in the middle of the turn and flattening cleanly at t=0 and t=1
  const archSin = Math.sin(Math.PI * t);
  const baseTiltFactor = isTopGrip ? 1 : -1;
  // Slightly stronger tilt when grabbed nearer to the corner, softer near vertical center
  const cornerAffinity = 0.72 + 0.38 * Math.abs(gripYRatio - 0.5) * 2;
  const naturalArchY = baseTiltFactor * archSin * bookHeight * 0.22 * cornerAffinity;
  const clampedUserVerticalY = Math.max(
    -bookHeight * 0.3,
    Math.min(bookHeight * 0.3, verticalDragPx * 0.45 * archSin)
  );
  const rawTarget: Point2D = {
    x: targetX,
    y: cornerY + naturalArchY + clampedUserVerticalY,
  };

  // At t === 1, force exact flat landing on opposite corner for 0.00px precision
  const draggedCorner =
    t >= 0.9999
      ? { x: isForward ? cornerX + 2 * pageWidth : cornerX - 2 * pageWidth, y: cornerY }
      : computeConstrainedCorner({
          corner,
          rawTarget,
          spineTop,
          spineBottom,
        });

  const vx = draggedCorner.x - corner.x;
  const vy = draggedCorner.y - corner.y;
  const vLen = Math.hypot(vx, vy) || 1;
  const foldNormal: Point2D = { x: vx / vLen, y: vy / vLen };
  const foldMidpoint: Point2D = {
    x: (corner.x + draggedCorner.x) / 2,
    y: (corner.y + draggedCorner.y) / 2,
  };

  const foldAngleRad = Math.atan2(foldNormal.y, foldNormal.x);
  // Composition of horizontal paper-flip (pre-fold) and reflection across fold line
  // equals an exact rigid rotation by 2 * foldAngleRad (no text mirroring!).
  const backRotationRad = 2 * foldAngleRad;

  // Pre-fold top-left origin of the verso page in book coordinates:
  // - Forward (left leaf [0..W]): verso's x'=0 is spine (x=W), so (0,0) starts at (W, 0)
  // - Backward (right leaf [W..2W] in 2-page, or [0..W] in 1-page): verso's x'=0 is outer edge (x=bookWidth),
  //   so (0,0) starts at (bookWidth, 0)
  const preFoldBackOrigin: Point2D = isForward
    ? { x: pageWidth, y: 0 }
    : { x: bookWidth, y: 0 };

  const backOrigin = reflectPointAcrossLine(preFoldBackOrigin, foldMidpoint, foldNormal);

  // Normalize tiny floating-point noise near 2*PI to 0 for cleaner CSS transforms
  let normalizedRot = backRotationRad;
  while (normalizedRot > Math.PI) normalizedRot -= 2 * Math.PI;
  while (normalizedRot < -Math.PI) normalizedRot += 2 * Math.PI;
  if (Math.abs(normalizedRot) < 1e-4) normalizedRot = 0;

  const backTransformCss = `translate3d(${backOrigin.x.toFixed(2)}px, ${backOrigin.y.toFixed(2)}px, 0) rotate(${normalizedRot.toFixed(5)}rad)`;

  const extent = 4 * (bookWidth + bookHeight);
  // Under-slot origin in book coordinates:
  // - Forward: left slot starts at x = 0
  // - Backward: in 2-page mode right slot starts at x = pageWidth; in 1-page mode starts at x = 0
  const underSlotOriginX = !isForward && input.isTwoPage ? pageWidth : 0;

  // Under page shows the peeled corner (d <= 0), with 1.5px overlap hidden under the opaque crease edge
  const underClipCss = buildHalfPlanePolygonCss(
    foldMidpoint,
    foldNormal,
    extent,
    false,
    1.5,
    underSlotOriginX,
    0
  );

  // Folded verso page sits strictly on the spine/folded side of the crease (d >= 0)
  const foldClipCss = buildHalfPlanePolygonCss(
    foldMidpoint,
    foldNormal,
    extent,
    true,
    0,
    0,
    0
  );

  // Crease visual lighting: smoothly ramps in at lift-off and softens to 0 as leaf flattens onto opposite page
  const edgeFade = Math.sin(Math.PI * t);
  const intensity = Math.max(0, Math.min(1, Math.pow(edgeFade, 0.62)));
  const diagLen = Math.hypot(bookWidth, bookHeight) * 1.6;
  const creaseNormalDeg = (foldAngleRad * 180) / Math.PI;

  return {
    progress: t,
    pageWidth,
    bookWidth,
    bookHeight,
    corner,
    draggedCorner,
    foldMidpoint,
    foldNormal,
    foldAngleRad,
    backRotationRad: normalizedRot,
    backOrigin,
    backTransformCss,
    underClipCss,
    foldClipCss,
    crease: {
      x: foldMidpoint.x,
      y: foldMidpoint.y,
      angleDeg: creaseNormalDeg,
      lengthPx: diagLen,
      underShadowWidthPx: Math.max(36, pageWidth * 0.2 * intensity),
      foldShadeWidthPx: Math.max(30, pageWidth * 0.18 * intensity),
      intensity,
    },
  };
}

/**
 * Classifies pointer movement into 'pending' (still a tap/jitter), 'x' (deliberate page curl),
 * or 'y' (vertical page scroll — cancels horizontal page turn for the rest of the gesture).
 */
export function evaluateGestureAxisLock(
  dx: number,
  dy: number,
  pointerType: GesturePointerKind
): GestureAxisLock {
  const lockPx =
    pointerType === 'mouse'
      ? MUSHAF_GESTURE_CONSTANTS.AXIS_LOCK_MOUSE_PX
      : MUSHAF_GESTURE_CONSTANTS.AXIS_LOCK_TOUCH_PX;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < lockPx && absY < lockPx) {
    return 'pending';
  }

  // Must be unambiguously horizontal; any vertical or ambiguous diagonal motion yields to native scroll
  if (absX >= absY * MUSHAF_GESTURE_CONSTANTS.HORIZONTAL_SLOPE_RATIO) {
    return 'x';
  }
  return 'y';
}

/**
 * Converts horizontal drag delta (after axis lock) into normalized curl progress [0, 1].
 * At book boundaries (canTurn === false), applies gentle rubber-band resistance capped at 0.055.
 */
export function computeDragProgress(params: {
  dxAfterLock: number;
  bookWidth: number;
  isTwoPage: boolean;
  direction: MushafTurnDirection;
  canTurn: boolean;
}): number {
  const signedTravel = params.direction === 'next' ? params.dxAfterLock : -params.dxAfterLock;
  if (signedTravel <= 0) return 0;

  const fullSpan = Math.max(180, params.bookWidth * (params.isTwoPage ? 0.78 : 0.88));
  const raw = signedTravel / fullSpan;

  if (!params.canTurn) {
    // Soft rubber-band resistance at first/last page — never peels open
    return Math.min(0.055, raw * 0.12);
  }
  return Math.max(0, Math.min(1, raw));
}

/**
 * Decides whether releasing a drag commits the page turn or springs cleanly back to rest.
 * Strictly guards against accidental touch taps, vertical scrolls, and cancelled/multi-touch gestures.
 */
export function shouldCommitPageTurn(params: {
  progress: number;
  totalDx: number;
  totalDy: number;
  elapsedMs: number;
  pointerType: GesturePointerKind;
  canTurn: boolean;
  cancelled: boolean;
}): boolean {
  if (params.cancelled || !params.canTurn) return false;

  // 1. Deliberate drag past 34% of the turn span
  if (params.progress >= MUSHAF_GESTURE_CONSTANTS.COMMIT_PROGRESS_THRESHOLD) {
    return true;
  }

  // 2. Deliberate fast horizontal flick (must still exceed generous minimum px to avoid touch-tap jitter)
  const absX = Math.abs(params.totalDx);
  const absY = Math.abs(params.totalDy);
  const minFlickPx =
    params.pointerType === 'mouse'
      ? MUSHAF_GESTURE_CONSTANTS.FLICK_MIN_PX_MOUSE
      : MUSHAF_GESTURE_CONSTANTS.FLICK_MIN_PX_TOUCH;

  if (
    absX >= minFlickPx &&
    absX >= absY * 1.6 &&
    params.elapsedMs > 0 &&
    params.elapsedMs <= MUSHAF_GESTURE_CONSTANTS.FLICK_MAX_MS
  ) {
    const velocity = absX / params.elapsedMs;
    if (velocity >= MUSHAF_GESTURE_CONSTANTS.FLICK_MIN_VELOCITY_PX_MS) {
      return true;
    }
  }

  return false;
}
