import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeConstrainedCorner,
  computeDragProgress,
  computePageCurlGeometry,
  easeInOutCubic,
  easeOutCubic,
  evaluateGestureAxisLock,
  resolveMushafTurnPages,
  shouldCommitPageTurn,
} from '../services/mushafPaperCurlEngine';

test('resolveMushafTurnPages: 2-page RTL forward keeps right page stationary and turns left leaf', () => {
  const turn = resolveMushafTurnPages({
    anchorPage: 3,
    isTwoPage: true,
    direction: 'next',
  });
  assert.ok(turn);
  assert.equal(turn.turningSide, 'left');
  assert.equal(turn.stationaryPage, 3);
  assert.equal(turn.frontPage, 4);
  assert.equal(turn.backPage, 5);
  assert.equal(turn.underPage, 6);
  assert.equal(turn.targetAnchorPage, 5);
});

test('resolveMushafTurnPages: 2-page RTL backward keeps left page stationary and turns right leaf', () => {
  const turn = resolveMushafTurnPages({
    anchorPage: 3,
    isTwoPage: true,
    direction: 'prev',
  });
  assert.ok(turn);
  assert.equal(turn.turningSide, 'right');
  assert.equal(turn.stationaryPage, 4);
  assert.equal(turn.frontPage, 3);
  assert.equal(turn.backPage, 2);
  assert.equal(turn.underPage, 1);
  assert.equal(turn.targetAnchorPage, 1);
});

test('resolveMushafTurnPages: respects book boundaries 1..604 in 2-page and 1-page modes', () => {
  assert.equal(
    resolveMushafTurnPages({ anchorPage: 1, isTwoPage: true, direction: 'prev' }),
    null
  );
  assert.equal(
    resolveMushafTurnPages({ anchorPage: 2, isTwoPage: true, direction: 'prev' }),
    null
  );
  assert.equal(
    resolveMushafTurnPages({ anchorPage: 603, isTwoPage: true, direction: 'next' }),
    null
  );
  assert.equal(
    resolveMushafTurnPages({ anchorPage: 604, isTwoPage: true, direction: 'next' }),
    null
  );

  const singleNext = resolveMushafTurnPages({
    anchorPage: 3,
    isTwoPage: false,
    direction: 'next',
  });
  assert.ok(singleNext);
  assert.equal(singleNext.turningSide, 'left');
  assert.equal(singleNext.frontPage, 3);
  assert.equal(singleNext.underPage, 4);
  assert.equal(singleNext.backPage, null);
  assert.equal(singleNext.targetAnchorPage, 4);

  const singlePrev = resolveMushafTurnPages({
    anchorPage: 3,
    isTwoPage: false,
    direction: 'prev',
  });
  assert.ok(singlePrev);
  assert.equal(singlePrev.turningSide, 'right');
  assert.equal(singlePrev.frontPage, 3);
  assert.equal(singlePrev.underPage, 2);
  assert.equal(singlePrev.backPage, null);
  assert.equal(singlePrev.targetAnchorPage, 2);

  assert.equal(
    resolveMushafTurnPages({ anchorPage: 1, isTwoPage: false, direction: 'prev' }),
    null
  );
  assert.equal(
    resolveMushafTurnPages({ anchorPage: 604, isTwoPage: false, direction: 'next' }),
    null
  );
});

test('computeConstrainedCorner: never tears leaf past spine circle radii', () => {
  const W = 400;
  const H = 600;
  const corner = { x: 0, y: H };
  const spineTop = { x: W, y: 0 };
  const spineBottom = { x: W, y: H };

  // Pull wildly up and right beyond physical paper bounds
  const p = computeConstrainedCorner({
    corner,
    rawTarget: { x: 950, y: -300 },
    spineTop,
    spineBottom,
  });

  const distBottom = Math.hypot(p.x - spineBottom.x, p.y - spineBottom.y);
  const distTop = Math.hypot(p.x - spineTop.x, p.y - spineTop.y);
  const maxBottom = Math.hypot(corner.x - spineBottom.x, corner.y - spineBottom.y);
  const maxTop = Math.hypot(corner.x - spineTop.x, corner.y - spineTop.y);

  assert.ok(distBottom <= maxBottom + 0.01, `distBottom ${distBottom} exceeded ${maxBottom}`);
  assert.ok(distTop <= maxTop + 0.01, `distTop ${distTop} exceeded ${maxTop}`);
});

test('computePageCurlGeometry: 2-page forward turn lands verso flush on right half [W..2W] with 0 rotation', () => {
  const geom = computePageCurlGeometry({
    bookWidth: 800,
    bookHeight: 600,
    isTwoPage: true,
    direction: 'next',
    progress: 1,
    gripYRatio: 0.7,
  });

  assert.equal(geom.pageWidth, 400);
  assert.ok(Math.abs(geom.backOrigin.x - 400) < 0.05, `Expected backOrigin.x=400, got ${geom.backOrigin.x}`);
  assert.ok(Math.abs(geom.backOrigin.y - 0) < 0.05, `Expected backOrigin.y=0, got ${geom.backOrigin.y}`);
  assert.ok(Math.abs(geom.backRotationRad) < 0.001, `Expected 0 rotation at t=1, got ${geom.backRotationRad}`);
  assert.ok(Math.abs(geom.crease.intensity) < 0.001, 'Crease shadow must fade to 0 when flat');
});

test('computePageCurlGeometry: 2-page backward turn lands verso flush on left half [0..W] with 0 rotation', () => {
  const geom = computePageCurlGeometry({
    bookWidth: 800,
    bookHeight: 600,
    isTwoPage: true,
    direction: 'prev',
    progress: 1,
    gripYRatio: 0.7,
  });

  assert.ok(Math.abs(geom.backOrigin.x - 0) < 0.05, `Expected backOrigin.x=0, got ${geom.backOrigin.x}`);
  assert.ok(Math.abs(geom.backOrigin.y - 0) < 0.05, `Expected backOrigin.y=0, got ${geom.backOrigin.y}`);
  assert.ok(Math.abs(geom.backRotationRad) < 0.001, `Expected 0 rotation at t=1, got ${geom.backRotationRad}`);
});

test('computePageCurlGeometry: mid-turn produces non-zero organic crease tilt and valid polygon clips', () => {
  const mid = computePageCurlGeometry({
    bookWidth: 800,
    bookHeight: 600,
    isTwoPage: true,
    direction: 'next',
    progress: 0.45,
    gripYRatio: 0.72,
  });

  assert.ok(mid.crease.intensity > 0.7, 'Mid-turn crease lighting should be strong');
  assert.ok(mid.underClipCss.startsWith('polygon('), 'underClipCss must be a polygon');
  assert.ok(mid.foldClipCss.startsWith('polygon('), 'foldClipCss must be a polygon');
  assert.ok(mid.backTransformCss.includes('translate3d(') && mid.backTransformCss.includes('rotate('));
  // Bottom grip tilts the fold upward slightly so backRotationRad is non-zero negative
  assert.ok(mid.backRotationRad < -0.01, `Expected organic bottom-corner curl tilt, got ${mid.backRotationRad}`);
});

test('evaluateGestureAxisLock: touch ignores taps/micro-jitter and yields vertical/diagonal scroll to browser', () => {
  // Short touch taps or slight thumb wiggle (< 22px) stay pending
  assert.equal(evaluateGestureAxisLock(0, 0, 'touch'), 'pending');
  assert.equal(evaluateGestureAxisLock(18, 4, 'touch'), 'pending');
  assert.equal(evaluateGestureAxisLock(-20, 10, 'touch'), 'pending');

  // Vertical scrolling locks 'y'
  assert.equal(evaluateGestureAxisLock(12, -45, 'touch'), 'y');
  assert.equal(evaluateGestureAxisLock(30, 120, 'touch'), 'y');

  // Ambiguous diagonal thumb movement (dx=38, dy=30 -> ratio 1.26 < 1.65) locks 'y', NEVER triggers flip
  assert.equal(evaluateGestureAxisLock(38, 30, 'touch'), 'y');

  // Deliberate horizontal touch swipe (dx=30, dy=6 -> ratio 5 >= 1.65) locks 'x'
  assert.equal(evaluateGestureAxisLock(30, 6, 'touch'), 'x');
  assert.equal(evaluateGestureAxisLock(-35, 10, 'touch'), 'x');

  // Mouse locks cleanly at 12px horizontal
  assert.equal(evaluateGestureAxisLock(10, 0, 'mouse'), 'pending');
  assert.equal(evaluateGestureAxisLock(14, 2, 'mouse'), 'x');
});

test('shouldCommitPageTurn: never flips on accidental touch taps, short flicks, vertical drags, or cancelled gestures', () => {
  // Accidental short touch flick (45px in 70ms) MUST NOT commit
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.14,
      totalDx: 45,
      totalDy: 6,
      elapsedMs: 70,
      pointerType: 'touch',
      canTurn: true,
      cancelled: false,
    }),
    false
  );

  // Diagonal fast swipe (80px x, 60px y) MUST NOT commit as flick
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.22,
      totalDx: 80,
      totalDy: 60,
      elapsedMs: 120,
      pointerType: 'touch',
      canTurn: true,
      cancelled: false,
    }),
    false
  );

  // Deliberate fast horizontal touch flick (95px in 170ms -> 0.56 px/ms) DOES commit
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.25,
      totalDx: 95,
      totalDy: 10,
      elapsedMs: 170,
      pointerType: 'touch',
      canTurn: true,
      cancelled: false,
    }),
    true
  );

  // Slow drag past 34% threshold DOES commit
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.4,
      totalDx: 180,
      totalDy: 12,
      elapsedMs: 900,
      pointerType: 'touch',
      canTurn: true,
      cancelled: false,
    }),
    true
  );

  // Slow drag below 34% snaps back
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.24,
      totalDx: 110,
      totalDy: 8,
      elapsedMs: 700,
      pointerType: 'touch',
      canTurn: true,
      cancelled: false,
    }),
    false
  );

  // Cancelled (e.g. multi-touch pinch or browser scroll takeover) NEVER commits even at high progress
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.85,
      totalDx: 320,
      totalDy: 5,
      elapsedMs: 200,
      pointerType: 'touch',
      canTurn: true,
      cancelled: true,
    }),
    false
  );

  // Out-of-bounds (page 1 prev or page 604 next) NEVER commits
  assert.equal(
    shouldCommitPageTurn({
      progress: 0.5,
      totalDx: 250,
      totalDy: 0,
      elapsedMs: 150,
      pointerType: 'mouse',
      canTurn: false,
      cancelled: false,
    }),
    false
  );
});

test('computeDragProgress and easing curves stay bounded within [0, 1]', () => {
  assert.equal(
    computeDragProgress({
      dxAfterLock: -20,
      bookWidth: 800,
      isTwoPage: true,
      direction: 'next',
      canTurn: true,
    }),
    0
  );
  // Rubber-band cap at boundary
  const boundaryPull = computeDragProgress({
    dxAfterLock: 500,
    bookWidth: 800,
    isTwoPage: true,
    direction: 'next',
    canTurn: false,
  });
  assert.ok(boundaryPull > 0 && boundaryPull <= 0.055);

  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});
