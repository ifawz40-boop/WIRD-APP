import {
  getSpreadPairForPage,
  stepSpreadPage,
  resolveEffectiveSpreadMode,
  getSavedMushafSpreadMode,
  saveMushafSpreadMode,
  getSavedMushafTafsirLayout,
  saveMushafTafsirLayout,
  getSavedMushafTafsirPagePreferences,
  saveMushafTafsirPagePreferences,
  TOTAL_MUSHAF_PAGES
} from './mushafSpreadService';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.has(key) ? store.get(key)! : null; },
    key(index: number) { return Array.from(store.keys())[index] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, String(value)); }
  };
}

export function runMushafSpreadServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  test('Canonical RTL Mushaf pairs odd pages with the following even page', () => {
    assert(getSpreadPairForPage(1).join(',') === '1,2', 'Page 1 must pair with Page 2');
    assert(getSpreadPairForPage(2).join(',') === '1,2', 'Page 2 must anchor to spread [1,2]');
    assert(getSpreadPairForPage(3).join(',') === '3,4', 'Page 3 must pair with Page 4');
    assert(getSpreadPairForPage(120).join(',') === '119,120', 'Page 120 must pair [119,120]');
    assert(getSpreadPairForPage(TOTAL_MUSHAF_PAGES).join(',') === '603,604', 'Final spread must be [603,604]');
  });

  test('Two-page spread stepping advances by pairs and respects boundaries 1..604', () => {
    assert(stepSpreadPage(1, 'next', true) === 3, 'Next from spread [1,2] must reach 3');
    assert(stepSpreadPage(2, 'prev', true) === 1, 'Prev from spread [1,2] must clamp at 1');
    assert(stepSpreadPage(604, 'next', true) === 603, 'Next from final spread must clamp at 603');
    assert(stepSpreadPage(604, 'prev', true) === 601, 'Prev from final spread [603,604] must jump to 601');
    assert(stepSpreadPage(5, 'next', false) === 6, 'Single-page next advances by 1');
  });

  test('Viewport resolution chooses 2 pages on desktop >= 768px and 1 page on mobile', () => {
    assert(resolveEffectiveSpreadMode('auto', 1280) === 'double', 'Desktop default should be double spread');
    assert(resolveEffectiveSpreadMode('auto', 390) === 'single', 'Mobile default should be single page');
    assert(resolveEffectiveSpreadMode('single', 1280) === 'single', 'Manual single override on desktop must hold');
    assert(resolveEffectiveSpreadMode('double', 390) === 'single', 'Mobile viewport stays single page safely');
  });

  test('Spread mode and desktop Tafsir layout persist independently for library vs session', () => {
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true });
    try {
      saveMushafSpreadMode('library', 'single');
      saveMushafSpreadMode('session', 'double');
      assert(getSavedMushafSpreadMode('library') === 'single', 'Library spread mode mismatch');
      assert(getSavedMushafSpreadMode('session') === 'double', 'Session spread mode mismatch');

      saveMushafTafsirLayout('library', 'replace_opposite');
      saveMushafTafsirLayout('session', 'panel');
      assert(getSavedMushafTafsirLayout('library') === 'replace_opposite', 'Library Tafsir layout mismatch');
      assert(getSavedMushafTafsirLayout('session') === 'panel', 'Session Tafsir layout mismatch');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
    }
  });


  test('Per-source-page Tafsir preferences persist locally and reject invalid page IDs', () => {
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true });
    try {
      saveMushafTafsirPagePreferences('library', {
        sourcePages: { 1: true, 2: true, 605: true, 0: true },
        preferredSourcePage: 2
      });
      const saved = getSavedMushafTafsirPagePreferences('library');
      assert(saved.sourcePages[1] === true && saved.sourcePages[2] === true, 'Valid source-page preferences must persist');
      assert(saved.sourcePages[605] !== true && saved.sourcePages[0] !== true, 'Out-of-range page preferences must be rejected');
      assert(saved.preferredSourcePage === 2, 'Most recently selected source page must persist');
      saveMushafTafsirPagePreferences('session', { sourcePages: { 3: true }, preferredSourcePage: 3 });
      assert(getSavedMushafTafsirPagePreferences('session').preferredSourcePage === 3, 'Session preference must be independent');
      assert(getSavedMushafTafsirPagePreferences('library').preferredSourcePage === 2, 'Library preference must remain unchanged');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
    }
  });

  return { passed, failed };
}
