import fs from 'fs';
import path from 'path';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function runSessionStudyUiTests(): { passed: number; failed: number } {
  let passed = 0; let failed = 0;
  const test = (name: string, callback: () => void) => { try { callback(); passed++; console.log(`  ✅ ${name}`); } catch (error) { failed++; console.error(`  ❌ ${name}:`, error); } };
  const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
  test('shared memorize and review session renders cancelable, accessible tafsir and paginated linked hadith', () => { const session = read('src/components/session/MemorizationSessionView.tsx'); const panel = read('src/components/session/SessionTafsirPanel.tsx'); const hadith = read('src/components/shared/RelatedHadithPanel.tsx'); assert(session.includes('<SessionTafsirPanel ayah={currentAyah} />'), 'shared session must show the panel'); assert(panel.includes('getTafsir(ayah.surahNumber, ayah.numberInSurah'), 'query must match current ayah'); assert(panel.includes('controller.abort()'), 'stale requests must cancel'); assert(panel.includes('aria-labelledby="session-tafsir-title"') && panel.includes('role="status"') && panel.includes('role="alert"'), 'panel must announce state accessibly'); assert(panel.includes('<RelatedHadithPanel ayah={ayah} />'), 'session must offer explicit verse-linked hadith'); assert(hadith.includes('تحميل مراجع إضافية') && hadith.includes('result.hasMore'), 'hadith results must support pagination'); });
  test('reading khatma stays separate, retains completed cycles, and marks pages only explicitly', () => { const library = read('src/components/library/QuranLibraryView.tsx'); const reader = read('src/components/library/QuranMushafReader.tsx'); const panel = read('src/components/library/ReadingKhatmaPanel.tsx'); const service = read('src/services/readingKhatmaService.ts'); assert(library.includes('<ReadingKhatmaPanel'), 'library must expose tracker'); assert(library.includes('markReadingPage(page)'), 'page reads must persist separately'); assert(reader.includes('onMarkPageRead?.(page)') && reader.includes('تسجيل الصفحة كمقروءة'), 'reader must expose explicit read control'); assert(panel.includes('aria-label="تقدم ختمة القراءة"') && panel.includes('بدء ختمة جديدة'), 'progress and new cycles must be accessible'); assert(service.includes('completedCycles'), 'new cycles must retain prior completed cycles'); });
  test('paper Mushaf supports touch and button navigation', () => { const reader = read('src/components/library/QuranMushafReader.tsx'); assert(reader.includes('onTouchStart') && reader.includes('onTouchEnd'), 'touch swipe must be available'); assert(reader.includes('الصفحة التالية') && reader.includes('الصفحة السابقة'), 'button navigation remains available'); });
  test('memorization session offers adjustable typography, compact spacing, and whole-session verse navigation', () => {
    const session = read('src/components/session/MemorizationSessionView.tsx');
    const preferences = read('src/services/memorizationDisplayPreferences.ts');
    assert(session.includes('aria-label="حجم خط الآيات"'), 'font size control must be accessible');
    assert(session.includes('aria-label="عرض مساحة صفحة الحفظ"') && session.includes('data-session-page-width={displayPreferences.pageWidth}'), 'session page width must be adjustable and exposed accessibly');
    assert(session.includes('activePageAyahRef.current?.scrollIntoView'), 'direct ayah jumps must keep the selected verse visible in the whole-session view');
    assert(session.includes('إعادة ضبط العرض'), 'display preferences must have a one-action reset');
    assert(preferences.includes('pageWidth: \'comfortable\'') && preferences.includes('MemorizationSessionPageWidth'), 'page width must be persisted as a validated device-local preference');
    assert(session.includes('aria-label="حجم واجهة جلسة الحفظ"') && session.includes('style={{ zoom: displayPreferences.uiScale / 100 }}'), 'overall session interface must be resizable without changing Quran text content');
    assert(session.includes('sticky bottom-2') && session.includes('aria-label="التنقل بين آيات جلسة الحفظ"'), 'previous/next navigation must remain reachable while scrolling');
    assert(session.includes('min-h-14'), 'navigation touch targets must remain at least 44px after the minimum 80% interface scale');
    assert(session.includes('aria-label="كثافة عرض العناصر"') && session.includes("density: 'compact'"), 'compact spacing control must be available');
    assert(session.includes('viewMode === \'page\'') && session.includes('كل آيات الجلسة'), 'whole-session verse view must be available');
    assert(session.includes('aria-pressed={index === currentAyahIndex}'), 'active verse must be announced to assistive technology');
    assert(session.includes('role="progressbar"') && session.includes('aria-valuetext={`الآية'), 'session progress must expose its current ayah and total');
    assert(session.includes('aria-pressed={!isMaskingDisabled && maskLevel === m.level}'), 'mask level selection must expose its selected state only when active');
    assert(session.includes('words.length === 0 ? <span role="status"'), 'session must announce local ayah text preparation');
    assert(session.includes('loadSimpleAyahRange(') && session.includes('{pageDisplayTexts[index]}'), 'whole-session view must use the same verified Tanzil Simple source as word masking');
    assert(session.includes('لم نعرض نصًا بديلًا'), 'Missing verified page text must fail closed instead of switching Quran text sources');
    assert(preferences.toLowerCase().includes('device-local') && preferences.includes('wird:memorization-display:v1'), 'presentation preferences must remain device-local and separate from cloud sync');
  });
  test('memorization session consolidates display/audio settings and supports connected/printed Mushaf without duplicating verses', () => {
    const session = read('src/components/session/MemorizationSessionView.tsx');
    const header = read('src/components/layout/Header.tsx');
    assert(session.includes('إعدادات العرض والصوت'), 'unified settings toggle must be present');
    assert(session.includes('aria-label="إعدادات عرض جلسة الحفظ"') && session.includes('aria-label="إعدادات الصوت والمقطع الصوتي"'), 'unified settings grid must group display and audio controls clearly');
    assert(session.includes('wird:memorization-display-panel-open:v1'), 'settings drawer open state must persist cleanly');
    assert(session.includes('<PrintedMushafSpread') && session.includes('mushaf-page-frame'), 'all-ayahs view must offer both shared printed spread and connected Mushaf frame');
    assert(header.includes("currentTab !== 'dashboard' && currentTab !== 'session'"), 'header must hide redundant session shortcut inside an active session');
  });
  test('whole-session verified text loader waits for loaded sessionAyahs and uses bounded session bounds', () => {
    const session = read('src/components/session/MemorizationSessionView.tsx');
    assert(
      session.includes('isLoadingAyahs ||') &&
      session.includes('sessionAyahs.length === 0 ||') &&
      session.includes('sessionAyahs[0].surahNumber !== surahNumber'),
      'whole-session Tanzil Simple loader must wait until surah verses finish loading before comparing lengths'
    );
    assert(
      session.includes('const rangeStart = sessionAyahs[0].numberInSurah;') &&
      session.includes('const rangeEnd = sessionAyahs[sessionAyahs.length - 1].numberInSurah;') &&
      session.includes('loadSimpleAyahRange(surahNumber, rangeStart, rangeEnd)'),
      'whole-session Tanzil Simple loader must query the exact loaded session ayah bounds'
    );
  });
  test('session supports inline word masking across connected & focused views (disabled only in printed spread) and verifies tokenized Quran text', () => {
    const session = read('src/components/session/MemorizationSessionView.tsx');
    const library = read('src/components/library/QuranLibraryView.tsx');
    const testsView = read('src/components/tests/MemorizationTestsView.tsx');

    assert(
      session.includes('تغيير النطاق') &&
      session.includes('applySessionRange(') &&
      !session.includes('initialEndAyah || 10'),
      'session must allow selecting any surah and ayah range beyond 10 verses'
    );
    assert(
      !library.includes('Math.min(10, surah.versesCount)') &&
      !library.includes('Math.min(10, selectedSurah.versesCount)') &&
      library.includes('sessionRangeStart') &&
      library.includes('sessionRangeEnd'),
      'library must remove the 10-ayah cap and offer custom/full range selection'
    );
    assert(
      session.includes("const isMaskingDisabled = displayPreferences.viewMode === 'page' && displayPreferences.mushafStyle === 'printed';") &&
      session.includes('disabled={isMaskingDisabled}') &&
      session.includes('العودة للعرض المتصل') &&
      session.includes('active-connected-ayah') &&
      session.includes('tokenized.join(\' \') !== normalizedInput') &&
      session.includes("'•'.repeat(dotCount)"),
      'word masking must support connected + single-ayah views, disable cleanly in printed SVG spread, and verify runtime tokenization'
    );
    assert(
      testsView.includes('const finalScore = score;') &&
      !testsView.includes('score + (selectedOption === currentQ.correctIndex ? 1 : 0)') &&
      testsView.includes('إنهاء الاختبار وعرض النتيجة') &&
      testsView.includes('handleSwitchTestType('),
      'memorization tests must not double-count the final question score or run duplicate generation on mode switch'
    );
  });
  test('Phase 1 stabilization: reactive spread stepping, inline khatma quick-start, scoped khatma presets, and decoupled session tafsir', () => {
    const reader = read('src/components/library/QuranMushafReader.tsx');
    const panel = read('src/components/library/ReadingKhatmaPanel.tsx');
    const session = read('src/components/session/MemorizationSessionView.tsx');
    const spread = read('src/components/library/PrintedMushafSpread.tsx');

    assert(reader.includes('printedSpreadContext.isTwoPage'), 'Mushaf reader must derive two-page stepping reactively from spread context');
    assert(reader.includes('onQuickStartReadingKhatma') && reader.includes('بدء ختمة قراءة الآن'), 'Mushaf reader must allow starting a khatma directly when none is active');
    assert(reader.includes('visibleSpreadPages.filter(p => !readingKhatma.completedPages.includes(p))'), 'Spread undo must only revert newly marked pages');
    assert(panel.includes("newScopeMode === 'juz'") && panel.includes("newScopeMode === 'surah'") && panel.includes('QURAN_PAGE_INDEX'), 'ReadingKhatmaPanel must support Juz and Surah scope presets grounded in generated indices');
    assert(!session.includes('if (nextAyah) handlePrintedSelectAyah(nextAyah);'), 'Browsing Tafsir in printed session must not mutate active memorization ayah');
    assert(session.includes('const confirmed = confirmFinalSegmentMastery(cumulativeProgress);') && session.includes('saveCumulativeSessionProgress(confirmed);'), 'Cumulative final confirmation must persist synchronously before session completion');
    assert(spread.includes('autoOpenTafsirOnSelect ? (activeTafsirAyah || selectedAyah) : (selectedAyah || activeTafsirAyah)'), 'PrintedMushafSpread must keep active memorization ayah highlighted when autoOpenTafsirOnSelect is false');
  });
  return { passed, failed };
}
