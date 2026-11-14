import {
  DEFAULT_READING_DISPLAY_PREFERENCES,
  clampUiScale,
  formatAyahRangeOptionLabel,
  getReadingDisplayPreferences,
  normalizeReadingDisplayPreferences,
  saveReadingDisplayPreferences,
} from '../services/readingDisplayPreferences';

export function runReadingDisplayPreferencesTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log('  ✅ ' + name);
    } catch (error: unknown) {
      failed++;
      console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });

  try {
    test('normalizes missing, malformed, and out-of-range reading display values safely', () => {
      assert(
        JSON.stringify(normalizeReadingDisplayPreferences(null)) ===
          JSON.stringify(DEFAULT_READING_DISPLAY_PREFERENCES),
        'null input should yield defaults'
      );
      const clamped = normalizeReadingDisplayPreferences({
        uiScale: 147,
        fontSize: 9,
        spacing: 'invalid',
        pageWidth: 'invalid',
      });
      assert(clamped.uiScale === 115, 'uiScale should clamp to max 115');
      assert(clamped.fontSize === 18, 'fontSize should clamp to min 18');
      assert(clamped.spacing === 'comfortable', 'invalid spacing should fall back to comfortable');
      assert(clamped.pageWidth === 'comfortable', 'invalid pageWidth should fall back to comfortable');
    });

    test('persists and isolates display preferences per view ID in device-local storage', () => {
      const libraryPrefs = { uiScale: 110, fontSize: 32, spacing: 'relaxed' as const, pageWidth: 'wide' as const };
      const ruqyahPrefs = { uiScale: 90, fontSize: 22, spacing: 'compact' as const, pageWidth: 'full' as const };
      assert(saveReadingDisplayPreferences('library', libraryPrefs), 'library prefs should save');
      assert(saveReadingDisplayPreferences('ruqyah', ruqyahPrefs), 'ruqyah prefs should save');
      assert(
        JSON.stringify(getReadingDisplayPreferences('library')) === JSON.stringify(libraryPrefs),
        'library prefs should round-trip accurately'
      );
      assert(
        JSON.stringify(getReadingDisplayPreferences('ruqyah')) === JSON.stringify(ruqyahPrefs),
        'ruqyah prefs should stay isolated from library prefs'
      );
      assert(
        JSON.stringify(getReadingDisplayPreferences('tests')) ===
          JSON.stringify(DEFAULT_READING_DISPLAY_PREFERENCES),
        'unmodified tests view should stay at defaults'
      );
    });

    test('handles corrupt localStorage JSON without throwing', () => {
      store.set('wird:reading-display:revision:v1', '{bad-json');
      assert(
        JSON.stringify(getReadingDisplayPreferences('revision')) ===
          JSON.stringify(DEFAULT_READING_DISPLAY_PREFERENCES),
        'corrupt storage value should fall back to defaults'
      );
    });

    test('clampUiScale snaps to 5% increments within bounds', () => {
      assert(clampUiScale(102) === 100, '102 should snap to 100');
      assert(clampUiScale(103) === 105, '103 should snap to 105');
      assert(clampUiScale(60, 80, 115) === 80, '60 should clamp to 80');
      assert(clampUiScale(130, 80, 115) === 115, '130 should clamp to 115');
      assert(clampUiScale(Number.NaN) === 100, 'NaN should default to 100');
    });

    test('formatAyahRangeOptionLabel formats sequential Arabic labels without RTL-ambiguous colons', () => {
      const singleSurah = formatAyahRangeOptionLabel(5, 'الملك', false);
      const multiSurah = formatAyahRangeOptionLabel(1, 'الفاتحة', true);
      assert(singleSurah === 'آية 5' && !singleSurah.includes(':'), 'Single surah option should omit colon');
      assert(
        multiSurah === 'آية 1 (الفاتحة)' && !multiSurah.includes(':'),
        'Multi-surah option should include surah name cleanly without colon'
      );
    });
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }

  return { passed, failed };
}
