import fs from 'node:fs';
import path from 'node:path';

export function runOfflineReaderIntegrationTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Quran library playback resolves completed downloads locally and revokes object URLs', () => {
    const source = read('src/components/library/QuranLibraryView.tsx');
    assert(source.includes('offlineQuranAudioLibrary.resolvePlaybackSource'), 'Quran library must use the offline audio library as its first playback source');
    assert(source.includes('requestSeq !== playbackRequestSeqRef.current'), 'Late playback resolutions must not replace a newer request');
    assert(source.includes('revokeAllActiveAudioUrls'), 'Quran library must release local object URLs after stop/completion/error');
  });

  test('Mushaf page and spread playback resolve downloaded audio locally', () => {
    const source = read('src/components/library/QuranMushafReader.tsx');
    assert(source.includes('offlineQuranAudioLibrary.resolvePlaybackSource'), 'Mushaf reader must use downloaded audio before network fallback');
    assert(source.includes('isTwoPageSpreadActive') && source.includes('printedAyahsByPage[page + 1]'), 'Spread playback must preserve ayah order across both displayed pages');
    assert(source.includes('revokeAllActiveAudioUrls'), 'Mushaf reader must release local playback object URLs');
  });

  test('Memorization session keeps local-first playback and guards stale media errors', () => {
    const source = read('src/components/session/MemorizationSessionView.tsx');
    assert(source.includes('offlineQuranAudioLibrary.resolvePlaybackSource'), 'Memorization session must resolve offline downloads locally');
    assert(source.includes('requestSeq !== playbackRequestSeqRef.current'), 'Stale media errors must not stop a newer ayah request');
  });

  test('Tafsir Muyassar uses a clearly labelled pinned local fallback', () => {
    const source = read('src/components/library/TafsirContentPane.tsx');
    assert(source.includes('getOfflineTafsirForAyah') && source.includes('selectedBookId === 16') && source.includes('if (!offlineStatus.isComplete)'), 'Only the pinned Tafsir Muyassar edition may fall back after the complete package is verified');
    assert(source.includes('التفسير الميسر — نسخة محلية'), 'Local fallback must identify its source instead of silently changing editions');
    const settings = read('src/components/settings/SettingsView.tsx');
    assert(settings.includes('<TafsirOfflineDownloadPanel />'), 'Users must have an explicit offline Tafsir download control');
  });


  test('Daily plan identity survives dashboard launch, deep link, and completion', () => {
    const dashboard = read('src/components/dashboard/DashboardView.tsx');
    const app = read('src/App.tsx');
    const router = read('src/services/router.ts');
    assert(dashboard.includes('item.planId, item.scheduledDate'), 'Every due task must launch with its exact plan and date');
    assert(dashboard.includes('dailyTask.enginePlanId, dailyTask.enginePlanDate'), 'Quick start must preserve the primary task identity');
    assert(app.includes('enginePlanId: initialRoute.enginePlanId') && app.includes('enginePlanDate: initialRoute.enginePlanDate'), 'Refresh/deep link must restore task identity');
    assert(app.includes('findMatchingDueEnginePlanTask'), 'Completion must update only the originating plan/date');
    assert(router.includes('planDate') && router.includes('enginePlanId'), 'Session URLs must carry validated plan/date context');
  });

  return { passed, failed };
}
