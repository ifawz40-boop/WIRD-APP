import fs from 'fs';
import path from 'path';
import {
  DEFAULT_THEME_PREFERENCES,
  WIRD_THEME_PRESETS,
  normalizeThemePreferences,
  getThemePresetMeta,
} from '../services/themePreferences';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runDesignSystemV2Tests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ❌ ${name}:`, error);
    }
  };

  test('WIRD Design System V2 defines 3 curated Day/Night theme presets with valid hex palettes', () => {
    assert(WIRD_THEME_PRESETS.length === 3, 'Expected exactly 3 curated visual presets');
    const ids = WIRD_THEME_PRESETS.map((p) => p.id);
    assert(
      ids.includes('emerald-editorial') &&
        ids.includes('mushaf-parchment') &&
        ids.includes('classic-midnight'),
      'All 3 expected theme preset IDs must be registered'
    );
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const preset of WIRD_THEME_PRESETS) {
      for (const palette of [preset.day, preset.night]) {
        assert(hexPattern.test(palette.bg), `${preset.id} bg must be hex`);
        assert(hexPattern.test(palette.surface), `${preset.id} surface must be hex`);
        assert(hexPattern.test(palette.primary), `${preset.id} primary must be hex`);
        assert(hexPattern.test(palette.accent), `${preset.id} accent must be hex`);
        assert(hexPattern.test(palette.ink), `${preset.id} ink must be hex`);
      }
    }
  });

  test('normalizeThemePreferences validates untrusted input and falls back safely to defaults', () => {
    const fallback = normalizeThemePreferences(null);
    assert(
      fallback.preset === DEFAULT_THEME_PREFERENCES.preset &&
        fallback.density === 'comfortable' &&
        fallback.corners === 'refined',
      'Null input must fall back to defaults'
    );

    const malformed = normalizeThemePreferences({
      preset: 'unknown-theme',
      density: 'huge',
      corners: 'sharp',
    });
    assert(
      malformed.preset === 'emerald-editorial' &&
        malformed.density === 'comfortable' &&
        malformed.corners === 'refined',
      'Invalid enum values must fall back safely'
    );

    const valid = normalizeThemePreferences({
      preset: 'mushaf-parchment',
      density: 'compact',
      corners: 'soft',
    });
    assert(
      valid.preset === 'mushaf-parchment' &&
        valid.density === 'compact' &&
        valid.corners === 'soft',
      'Valid theme preferences must be preserved'
    );
    assert(
      getThemePresetMeta('mushaf-parchment').id === 'mushaf-parchment',
      'getThemePresetMeta must return matching preset metadata'
    );
  });

  test('wird-identity.css declares all 3 theme cascades (Day & Night) and preserves required legacy tokens', () => {
    const css = fs.readFileSync(path.resolve('./src/wird-identity.css'), 'utf8');
    for (const selector of [
      ":root[data-wird-theme='emerald-editorial']",
      ".dark[data-wird-theme='emerald-editorial']",
      ":root[data-wird-theme='mushaf-parchment']",
      ".dark[data-wird-theme='mushaf-parchment']",
      ":root[data-wird-theme='classic-midnight']",
      ".dark[data-wird-theme='classic-midnight']",
      '--wird-hero-gradient:',
      '--wird-primary-ink:',
      '--wird-accent-ink:',
      '.wird-hero-surface',
      '.wird-nav-indicator',
      '.wird-view-enter',
      '.wird-skeleton',
    ]) {
      assert(css.includes(selector), `wird-identity.css must declare ${selector}`);
    }
  });

  test('Application Shell wires ThemeCustomizerSheet, WirdViewSkeleton, and WIRD_COMPLETE_REBUILD_BLUEPRINT exists', () => {
    const appSource = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf8');
    const headerSource = fs.readFileSync(path.resolve('./src/components/layout/Header.tsx'), 'utf8');
    const blueprint = fs.readFileSync(path.resolve('./WIRD_COMPLETE_REBUILD_BLUEPRINT.md'), 'utf8');

    assert(appSource.includes('<ThemeCustomizerSheet'), 'App.tsx must mount ThemeCustomizerSheet');
    assert(appSource.includes('<WirdViewSkeleton'), 'App.tsx Suspense must render WirdViewSkeleton');
    assert(appSource.includes('wird-view-enter'), 'App.tsx must apply smooth view transition');
    assert(headerSource.includes('onOpenThemeCustomizer'), 'Header.tsx must expose theme customizer trigger');
    assert(
      blueprint.includes('Ummah Library') &&
        blueprint.includes('AGPL-3.0') &&
        blueprint.includes('emerald-editorial') &&
        blueprint.includes('mushaf-parchment') &&
        blueprint.includes('classic-midnight'),
      'WIRD_COMPLETE_REBUILD_BLUEPRINT.md must document reference license boundaries and all 3 visual presets'
    );
  });

  test('Wave 4A: Printed Mushaf defaults active, exposes opposite-page Tafsir toggle + bottom nav, and harmonizes Dashboard/Library tokens', () => {
    const dashboard = fs.readFileSync(path.resolve('./src/components/dashboard/DashboardView.tsx'), 'utf8');
    const reader = fs.readFileSync(path.resolve('./src/components/library/QuranMushafReader.tsx'), 'utf8');
    const spread = fs.readFileSync(path.resolve('./src/components/library/PrintedMushafSpread.tsx'), 'utf8');
    const tafsir = fs.readFileSync(path.resolve('./src/components/library/TafsirContentPane.tsx'), 'utf8');
    const khatma = fs.readFileSync(path.resolve('./src/components/library/ReadingKhatmaPanel.tsx'), 'utf8');
    const library = fs.readFileSync(path.resolve('./src/components/library/QuranLibraryView.tsx'), 'utf8');

    assert(dashboard.includes('wird-hero-surface'), 'DashboardView must use .wird-hero-surface');
    assert(!dashboard.includes('#0B132B'), 'DashboardView must not keep legacy hardcoded #0B132B surfaces');
    assert(dashboard.includes('id="dashboard-prayer-card"'), 'DashboardView must preserve decoupled prayer card');

    assert(
      reader.includes("localStorage.getItem('wird.quran.readerLayout.v1') === 'flow' ? 'flow' : 'printed'"),
      'QuranMushafReader must default to printed Mushaf layout'
    );
    assert(
      reader.includes('aria-label="التنقل السفلي بين صفحات المصحف"'),
      'QuranMushafReader must render bottom page navigation bar'
    );
    assert(
      reader.includes('تخطي صفحتين'),
      'QuranMushafReader must expose explicit +2 spread jump when opposite Tafsir is open'
    );

    assert(
      spread.includes('عرض التفسير مكان المقابلة') && spread.includes('العودة لعرض الصفحتين'),
      'PrintedMushafSpread must expose direct 1-tap opposite-page Tafsir toggle'
    );
    assert(tafsir.includes('var(--wird-surface)'), 'TafsirContentPane must use V2 semantic surface tokens');
    assert(khatma.includes('var(--wird-surface)'), 'ReadingKhatmaPanel must use V2 semantic surface tokens');
    assert(library.includes('wird-hero-surface'), 'QuranLibraryView must use .wird-hero-surface');
  });

  test('Wave 4B: Memorization, Plans, Revision, Tests, and Progress views use V2 semantic tokens without legacy hex surfaces', () => {
    const wave4BFiles = [
      './src/components/session/MemorizationSessionView.tsx',
      './src/components/session/SessionTafsirPanel.tsx',
      './src/components/plans/MemorizationPlansView.tsx',
      './src/components/plans/PlanningEngineWizard.tsx',
      './src/components/plans/ExistingMemorizedPicker.tsx',
      './src/components/revision/RevisionCenterView.tsx',
      './src/components/tests/MemorizationTestsView.tsx',
      './src/components/progress/ProgressAnalyticsView.tsx',
    ];
    for (const rel of wave4BFiles) {
      const content = fs.readFileSync(path.resolve(rel), 'utf8');
      assert(content.includes('var(--wird-'), `${rel} must use WIRD V2 semantic CSS tokens`);
      assert(!content.includes('#0B132B'), `${rel} must not contain legacy #0B132B surfaces`);
      assert(!content.includes('#111F36'), `${rel} must not contain legacy #111F36 surfaces`);
      assert(!content.includes('#1C4E46'), `${rel} must not contain legacy #1C4E46 colors`);
      assert(!content.includes('#1E4A47'), `${rel} must not contain legacy #1E4A47 colors`);
    }
  });

  return { passed, failed };
}
