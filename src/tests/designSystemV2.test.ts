import fs from 'fs';
import path from 'path';
import {
  DEFAULT_THEME_PREFERENCES,
  WIRD_DESIGNS,
  WIRD_THEME_PRESETS,
  getActiveVariantSummary,
  getDesignMeta,
  mapLegacyPresetToDesign,
  normalizeThemePreferences,
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

  test('Four-Variant Design System defines 2 independent designs (A & B) with valid Light/Dark palettes and preview assets', () => {
    assert(WIRD_DESIGNS.length === 2, 'Expected exactly 2 independent design systems (design-a and design-b)');
    assert(WIRD_THEME_PRESETS === WIRD_DESIGNS, 'Legacy WIRD_THEME_PRESETS alias must match WIRD_DESIGNS');
    const ids = WIRD_DESIGNS.map((d) => d.id);
    assert(
      ids.includes('design-a') && ids.includes('design-b'),
      'Both design-a and design-b must be registered'
    );

    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const design of WIRD_DESIGNS) {
      for (const palette of [design.day, design.night]) {
        assert(hexPattern.test(palette.bg), `${design.id} bg must be hex`);
        assert(hexPattern.test(palette.surface), `${design.id} surface must be hex`);
        assert(hexPattern.test(palette.surfaceMuted), `${design.id} surfaceMuted must be hex`);
        assert(hexPattern.test(palette.primary), `${design.id} primary must be hex`);
        assert(hexPattern.test(palette.accent), `${design.id} accent must be hex`);
        assert(hexPattern.test(palette.ink), `${design.id} ink must be hex`);
        assert(
          palette.previewImage.startsWith('/assets/aistudio/'),
          `${design.id} previewImage must point to local supplied reference asset`
        );
        assert(
          palette.emblemImage.startsWith('/assets/aistudio/'),
          `${design.id} emblemImage must point to local supplied emblem asset`
        );
        const previewAbs = path.resolve('./public', palette.previewImage.replace(/^\//, ''));
        const emblemAbs = path.resolve('./public', palette.emblemImage.replace(/^\//, ''));
        assert(fs.existsSync(previewAbs), `Missing preview image: ${palette.previewImage}`);
        assert(fs.existsSync(emblemAbs), `Missing emblem image: ${palette.emblemImage}`);
      }
    }
  });

  test('normalizeThemePreferences validates input, preserves independence, and migrates legacy presets safely', () => {
    const fallback = normalizeThemePreferences(null);
    assert(
      fallback.design === 'design-a' &&
        fallback.preset === 'design-a' &&
        fallback.density === 'comfortable' &&
        fallback.corners === 'refined',
      'Null input must fall back to Design A defaults'
    );

    assert(mapLegacyPresetToDesign('emerald-editorial') === 'design-a', 'emerald-editorial migrates to design-a');
    assert(mapLegacyPresetToDesign('mushaf-parchment') === 'design-a', 'mushaf-parchment migrates to design-a');
    assert(mapLegacyPresetToDesign('classic-midnight') === 'design-b', 'classic-midnight migrates to design-b');
    assert(mapLegacyPresetToDesign('invalid-theme') === null, 'Unknown preset returns null');

    const migratedLegacy = normalizeThemePreferences({
      preset: 'classic-midnight',
      density: 'compact',
      corners: 'soft',
    });
    assert(
      migratedLegacy.design === 'design-b' &&
        migratedLegacy.preset === 'design-b' &&
        migratedLegacy.density === 'compact' &&
        migratedLegacy.corners === 'soft',
      'Legacy classic-midnight preference must migrate cleanly to design-b'
    );

    const summaryBLight = getActiveVariantSummary('design-b', 'light');
    const summaryBDark = getActiveVariantSummary('design-b', 'dark');
    assert(
      summaryBLight.design.id === 'design-b' &&
        summaryBDark.design.id === 'design-b' &&
        summaryBLight.palette.bg !== summaryBDark.palette.bg,
      'Light and Dark palettes must resolve distinctly for the same design'
    );
    assert(getDesignMeta('design-a').code === 'A', 'getDesignMeta returns matching design metadata');
    assert(DEFAULT_THEME_PREFERENCES.design === 'design-a', 'Default design must be Design A');
  });

  test('wird-identity.css declares all 4 design × appearance cascades and semantic button ink tokens', () => {
    const css = fs.readFileSync(path.resolve('./src/wird-identity.css'), 'utf8');
    for (const selector of [
      ":root[data-wird-design='design-a']",
      ".dark[data-wird-design='design-a']",
      ":root[data-wird-design='design-b']",
      ".dark[data-wird-design='design-b']",
      '--wird-hero-gradient:',
      '--wird-primary-ink:',
      '--wird-accent-ink:',
      '--wird-sidebar-bg:',
      '--wird-mushaf-paper:',
      '.wird-hero-surface',
      '.wird-nav-indicator',
      '.wird-view-enter',
      '.wird-skeleton',
    ]) {
      assert(css.includes(selector), `wird-identity.css must declare ${selector}`);
    }
  });

  test('Application Shell wires AppearanceSelectorPanel in both ThemeCustomizerSheet and SettingsView', () => {
    const appSource = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf8');
    const headerSource = fs.readFileSync(path.resolve('./src/components/layout/Header.tsx'), 'utf8');
    const customizerSource = fs.readFileSync(path.resolve('./src/components/ui/ThemeCustomizerSheet.tsx'), 'utf8');
    const settingsSource = fs.readFileSync(path.resolve('./src/components/settings/SettingsView.tsx'), 'utf8');

    assert(appSource.includes('<ThemeCustomizerSheet'), 'App.tsx must mount ThemeCustomizerSheet');
    assert(appSource.includes('handleResetAppearance'), 'App.tsx must wire unified appearance reset');
    assert(appSource.includes('<WirdViewSkeleton'), 'App.tsx Suspense must render WirdViewSkeleton');
    assert(appSource.includes('wird-view-enter'), 'App.tsx must apply smooth view transition');
    assert(headerSource.includes('onOpenThemeCustomizer'), 'Header.tsx must expose theme customizer trigger');
    assert(customizerSource.includes('<AppearanceSelectorPanel'), 'ThemeCustomizerSheet must render AppearanceSelectorPanel');
    assert(settingsSource.includes('<AppearanceSelectorPanel'), 'SettingsView must render inline AppearanceSelectorPanel');
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
    assert(tafsir.includes('var(--wird-surface)'), 'TafsirContentPane must use semantic surface tokens');
    assert(khatma.includes('var(--wird-surface)'), 'ReadingKhatmaPanel must use semantic surface tokens');
    assert(library.includes('wird-hero-surface'), 'QuranLibraryView must use .wird-hero-surface');
  });

  test('All core application views and shared components use semantic tokens without legacy hex leaks', () => {
    const harmonizedFiles = [
      './src/components/session/MemorizationSessionView.tsx',
      './src/components/session/SessionTafsirPanel.tsx',
      './src/components/plans/MemorizationPlansView.tsx',
      './src/components/plans/PlanningEngineWizard.tsx',
      './src/components/plans/ExistingMemorizedPicker.tsx',
      './src/components/revision/RevisionCenterView.tsx',
      './src/components/tests/MemorizationTestsView.tsx',
      './src/components/progress/ProgressAnalyticsView.tsx',
      './src/components/adhkar/AdhkarView.tsx',
      './src/components/ruqyah/RuqyahView.tsx',
      './src/components/seerah/SeerahView.tsx',
      './src/components/assistant/QuranAdvisorView.tsx',
      './src/components/settings/SettingsView.tsx',
      './src/components/auth/AuthScreen.tsx',
      './src/components/auth/AuthGate.tsx',
      './src/components/shared/HorizontalScrollRail.tsx',
      './src/components/shared/DisplaySettingsMenu.tsx',
      './src/components/shared/RelatedHadithPanel.tsx',
    ];
    for (const rel of harmonizedFiles) {
      const content = fs.readFileSync(path.resolve(rel), 'utf8');
      assert(content.includes('var(--wird-'), `${rel} must use WIRD semantic CSS tokens`);
      assert(!content.includes('#0B132B'), `${rel} must not contain legacy #0B132B surfaces`);
      assert(!content.includes('#111F36'), `${rel} must not contain legacy #111F36 surfaces`);
      assert(!content.includes('#1C4E46'), `${rel} must not contain legacy #1C4E46 colors`);
      assert(!content.includes('#1E4A47'), `${rel} must not contain legacy #1E4A47 colors`);
    }
  });

  return { passed, failed };
}
