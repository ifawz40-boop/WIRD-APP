import fs from 'node:fs';
import path from 'node:path';
import {
  SEERAH_BOOK_STORAGE_KEY,
  computeSeerahBookProgress,
  normalizeSeerahSearchText,
  readSeerahProgress,
  saveSeerahBookPosition,
  searchSeerahItemsSync,
  setSeerahBookFontSize,
  setSeerahChapterReadState,
  toggleSeerahChapterReadState,
  type SeerahBookManifest,
  type SeerahChapterDocument,
  type SeerahCharacterDocument,
  type SeerahSearchItem,
} from '../services/seerahBookService';
import { buildRouteHash, parseRoute } from '../services/router';
import { AUXILIARY_SCOPED_KEYS, StorageService } from '../services/storageService';

export async function runSeerahBookSystemTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      failed++;
    }
  }

  const root = process.cwd();
  const researchDir = path.join(root, 'research');
  const pubDir = path.join(root, 'public/data/seerah');
  const quranPath = path.join(root, 'src/data/completeQuranData.json');

  // 1. Phase 1 & Phase 2 Research Repository Integrity
  const sourceManifest = JSON.parse(
    fs.readFileSync(path.join(researchDir, 'source_manifest.json'), 'utf8')
  );
  const checkpoints = JSON.parse(
    fs.readFileSync(path.join(researchDir, 'processing_checkpoints.json'), 'utf8')
  );
  assert(
    sourceManifest.totalVolumes === 4 &&
      checkpoints.totalPagesTracked === 2566 &&
      checkpoints.extractedMatnPages === 2475 &&
      checkpoints.exception_register.length === 91,
    'All 4 encyclopedia volumes (2,566 PDF pages: 2,475 matn + 91 classified apparatus pages) are documented in research/'
  );

  // 2. Complete Published Chronological Hierarchy (6 Eras -> 12 Sections -> 40 Chapters)
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pubDir, 'manifest.json'), 'utf8')
  ) as SeerahBookManifest;

  assert(
    manifest.totalEras === 6 &&
      manifest.eras.length === 6 &&
      manifest.totalSections === 12 &&
      manifest.sections.length === 12 &&
      manifest.totalChapters === 40 &&
      manifest.chapters.length === 40 &&
      manifest.totalCharacters === 32 &&
      manifest.characters.length === 32,
    'Published Seerah book defines 6 eras, 12 sections, 40 chapters, and 32 historical character profiles'
  );

  const uniqueChapterIds = new Set(manifest.chapters.map((c) => c.id));
  const uniqueChapterTitles = new Set(manifest.chapters.map((c) => c.title));
  const validChain = manifest.chapters.every((ch, idx) => {
    const expPrev = idx === 0 ? null : manifest.chapters[idx - 1].id;
    const expNext = idx === manifest.chapters.length - 1 ? null : manifest.chapters[idx + 1].id;
    return ch.order === idx + 1 && ch.previousChapterId === expPrev && ch.nextChapterId === expNext;
  });

  assert(
    uniqueChapterIds.size === 40 && uniqueChapterTitles.size === 40 && validChain,
    'All 40 Seerah chapters have unique IDs/titles and form an unbroken doubly-linked chronological chain'
  );

  // 3. Sacred Quotation Verbatim Verification & Editorial Review Gates across all 40 Chapters
  const quranCorpus = JSON.parse(fs.readFileSync(quranPath, 'utf8')) as Record<
    string,
    Array<{ numberInSurah: number; text: string }>
  >;
  const hadithBank = new Map<string, { verbatimText: string }>(
    JSON.parse(
      fs.readFileSync(path.join(researchDir, 'quotations/hadith_and_athar_quotations.json'), 'utf8')
    ).quotations.map((h: { quoteId: string; verbatimText: string }) => [h.quoteId, h])
  );

  const charSet = new Set(manifest.characters.map((c) => c.id));
  const placeSet = new Set(manifest.places.map((p) => p.id));
  const sourceSet = new Set(manifest.sources.map((s) => s.id));

  let allChaptersValid = true;
  let quranQuotesChecked = 0;
  let hadithQuotesChecked = 0;

  for (const card of manifest.chapters) {
    const chFile = path.join(pubDir, 'chapters', `${card.id}.json`);
    if (!fs.existsSync(chFile)) {
      allChaptersValid = false;
      break;
    }
    const ch = JSON.parse(fs.readFileSync(chFile, 'utf8')) as SeerahChapterDocument;
    if (
      ch.status !== 'Published' ||
      ch.reviews.historical !== 'passed' ||
      ch.reviews.language !== 'passed' ||
      ch.reviews.quotation !== 'passed' ||
      ch.scenes.length < 3 ||
      ch.wordCount < 450 ||
      ch.characterIds.some((cid) => !charSet.has(cid)) ||
      ch.placeIds.some((pid) => !placeSet.has(pid)) ||
      ch.sourceIds.some((sid) => !sourceSet.has(sid))
    ) {
      allChaptersValid = false;
    }

    for (const sc of ch.scenes) {
      for (const blk of sc.blocks) {
        if (blk.type === 'quran') {
          const ayahs = (quranCorpus[String(blk.surahNumber)] || []).filter(
            (a) => a.numberInSurah >= blk.startAyah && a.numberInSurah <= blk.endAyah
          );
          const expected =
            ayahs.length === 1
              ? ayahs[0].text.trim()
              : ayahs.map((a) => `${a.text.trim()} ﴿${a.numberInSurah}﴾`).join(' ');
          if (blk.verbatimText !== expected) {
            allChaptersValid = false;
          }
          quranQuotesChecked++;
        } else if (blk.type === 'hadith') {
          const ref = hadithBank.get(blk.quoteId);
          if (!ref || blk.verbatimText !== ref.verbatimText) {
            allChaptersValid = false;
          }
          hadithQuotesChecked++;
        } else {
          if (blk.text.includes('﴿') || blk.text.includes('﴾')) {
            allChaptersValid = false;
          }
        }
      }
    }
  }

  assert(
    allChaptersValid && quranQuotesChecked >= 45 && hadithQuotesChecked >= 35,
    `All 40 published chapters pass 3-stage editorial review and 100% verbatim Quran (${quranQuotesChecked}) & Hadith (${hadithQuotesChecked}) checks`
  );

  // 4. Character Stories & Bidirectional Cross-Link Integrity
  const charsBundle = JSON.parse(
    fs.readFileSync(path.join(pubDir, 'characters/characters.json'), 'utf8')
  ) as { characters: SeerahCharacterDocument[] };

  const allCharactersValid =
    charsBundle.characters.length === 32 &&
    charsBundle.characters.every(
      (c) =>
        c.status === 'Published' &&
        c.reviews.historical === 'passed' &&
        c.reviews.language === 'passed' &&
        c.reviews.quotation === 'passed' &&
        c.narrativeStoryParagraphs.length >= 4 &&
        c.linkedChapterIds.length >= 1 &&
        c.linkedChapterIds.every((cid) => uniqueChapterIds.has(cid)) &&
        c.chronologicalMoments.every((m) => uniqueChapterIds.has(m.chapterId))
    );

  assert(
    allCharactersValid,
    'All 32 character profiles contain approved continuous narratives and valid bidirectional chapter links'
  );

  // 5. Search & Deep-Link Router Integration
  const searchPayload = JSON.parse(
    fs.readFileSync(path.join(pubDir, 'search-index.json'), 'utf8')
  ) as { items: SeerahSearchItem[] };

  const badrResults = searchSeerahItemsSync('غزوة بدر', searchPayload.items, 'all');
  const siddiqResults = searchSeerahItemsSync('أبو بكر الصديق', searchPayload.items, 'character');

  assert(
    normalizeSeerahSearchText('إِسْلامُ عُمَرَ بْنِ الخَطَّابِ') === 'اسلام عمر بن الخطاب' &&
      badrResults.some((r) => r.kind === 'chapter' && r.id === 'ch-22') &&
      siddiqResults.some((r) => r.kind === 'character' && r.id === 'abu-bakr-al-siddiq'),
    'Normalized Arabic search accurately locates both Seerah chapters and character narratives'
  );

  const chHash = buildRouteHash({ tab: 'seerah', seerahChapterId: 'ch-10' });
  const charHash = buildRouteHash({ tab: 'seerah', seerahCharacterId: 'khadijah-bint-khuwaylid' });
  const dirHash = buildRouteHash({ tab: 'seerah', seerahView: 'characters' });

  assert(
    chHash === '#/seerah?chapter=ch-10' &&
      parseRoute(chHash).seerahChapterId === 'ch-10' &&
      charHash === '#/seerah?character=khadijah-bint-khuwaylid' &&
      parseRoute(charHash).seerahCharacterId === 'khadijah-bint-khuwaylid' &&
      dirHash === '#/seerah?view=characters' &&
      parseRoute(dirHash).seerahView === 'characters',
    'Router parses and builds deep-links for Seerah chapters, character directory, and character profiles'
  );

  // 6. Guest & UID-Scoped Authenticated Reading Progress Isolation
  assert(
    (AUXILIARY_SCOPED_KEYS as readonly string[]).includes(SEERAH_BOOK_STORAGE_KEY),
    'wird.seerah.v2 is registered in AUXILIARY_SCOPED_KEYS for guest-to-account migration and UID isolation'
  );

  const mem = new Map<string, string>();
  const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
  };

  try {
    // Guest session
    StorageService.setStorageScope('guest', 'keep-guest');
    toggleSeerahChapterReadState('ch-01', mockStorage);
    saveSeerahBookPosition('ch-02', 'ch-02-scene-1', 0.4, mockStorage);
    const guestState = readSeerahProgress(mockStorage);

    // Authenticated UID A
    StorageService.setStorageScope('user:seerah_uid_a', 'keep-guest');
    setSeerahChapterReadState('ch-01', true, mockStorage);
    setSeerahChapterReadState('ch-02', true, mockStorage);
    setSeerahChapterReadState('ch-10', true, mockStorage);
    setSeerahChapterReadState('ch-02', false, mockStorage); // Unmark test
    saveSeerahBookPosition('ch-10', 'ch-10-scene-2', 0.5, mockStorage);
    setSeerahBookFontSize('lg', mockStorage);
    const uidAState = readSeerahProgress(mockStorage);
    const uidASummary = computeSeerahBookProgress(uidAState, manifest);

    // Authenticated UID B
    StorageService.setStorageScope('user:seerah_uid_b', 'keep-guest');
    const uidBState = readSeerahProgress(mockStorage);
    const uidBSummary = computeSeerahBookProgress(uidBState, manifest);

    assert(
      guestState.completedChapterIds.length === 1 &&
        guestState.lastPosition?.chapterId === 'ch-02' &&
        uidAState.completedChapterIds.length === 2 &&
        uidAState.completedChapterIds.includes('ch-01') &&
        uidAState.completedChapterIds.includes('ch-10') &&
        !uidAState.completedChapterIds.includes('ch-02') &&
        uidAState.fontSize === 'lg' &&
        uidASummary.completedCount === 2 &&
        uidASummary.percent === 5 &&
        uidBState.completedChapterIds.length === 0 &&
        uidBSummary.completedCount === 0,
      'Reading progress, mark/unmark actions, last position, and font size work across Guest and isolated Authenticated UIDs'
    );
  } finally {
    StorageService.setStorageScope('legacy', 'keep-guest');
  }

  // 7. Semantic CSS Token Hygiene across all new Seerah UI components
  const legacyHexPattern = /#(?:0B132B|111F36|1C4E46|1E4A47|0E192D|152642|162744)\b/i;
  const uiFiles = [
    'src/components/seerah/SeerahView.tsx',
    'src/components/seerah/SeerahBookLanding.tsx',
    'src/components/seerah/SeerahChapterReader.tsx',
    'src/components/seerah/SeerahCharacterViews.tsx',
  ];
  const zeroHexLeaks = uiFiles.every(
    (rel) => !legacyHexPattern.test(fs.readFileSync(path.join(root, rel), 'utf8'))
  );
  assert(
    zeroHexLeaks,
    'All Seerah digital book UI components use pure WIRD semantic tokens without legacy hardcoded hex leaks'
  );

  return { passed, failed };
}
