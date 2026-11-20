import {
  SEERAH_BOOK_VERSION,
  SEERAH_SOURCES,
  SEERAH_CLAIMS,
  SEERAH_PEOPLE,
  SEERAH_PLACES,
  SEERAH_PARTS,
  SEERAH_CHAPTERS,
  getSeerahChapterById,
  getSeerahChaptersByPart,
} from '../data/seerahData';
import {
  readSeerahProgressStore,
  saveSeerahReadingPosition,
  setSeerahReadingMode,
  toggleSeerahChapterCompleted,
  toggleSeerahBookmark,
  getSeerahOverallProgress,
  isValidSeerahPartId,
} from '../services/seerahProgressService';
import { StorageService } from '../services/storageService';

export async function runSeerahSystemTests(): Promise<{ passed: number; failed: number }> {
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

  // 1. Chronological parts and contiguous 16-chapter narrative chain
  assert(
    SEERAH_PARTS.length === 5 &&
      SEERAH_PARTS.every((part, idx) => part.order === idx + 1 && isValidSeerahPartId(part.id)),
    'Seerah book defines 5 ordered chronological parts from pre-mission Arabia to the Farewell & Shamail'
  );

  assert(
    SEERAH_CHAPTERS.length === 16 &&
      SEERAH_CHAPTERS.every((chapter, idx) => {
        const expectedPrev = idx === 0 ? null : SEERAH_CHAPTERS[idx - 1].id;
        const expectedNext = idx === SEERAH_CHAPTERS.length - 1 ? null : SEERAH_CHAPTERS[idx + 1].id;
        return (
          chapter.order === idx + 1 &&
          chapter.previousChapterId === expectedPrev &&
          chapter.nextChapterId === expectedNext &&
          getSeerahChapterById(chapter.id)?.id === chapter.id &&
          getSeerahChaptersByPart(chapter.partId).some((c) => c.id === chapter.id) &&
          chapter.scenes.length > 0 &&
          chapter.lessons.length > 0
        );
      }),
    'All 16 Seerah chapters form an unbroken doubly-linked chronological sequence with scenes and lessons'
  );

  // 2. Claim-level classical provenance, evidence grades & uncertainty notes
  let allReferencesValid = true;
  let uncertaintyBlocksCount = 0;
  let scholarlyNotesCount = 0;

  const claimsList = Object.values(SEERAH_CLAIMS);
  const sourcesList = Object.values(SEERAH_SOURCES);
  const peopleList = Object.values(SEERAH_PEOPLE);
  const placesList = Object.values(SEERAH_PLACES);

  for (const claim of claimsList) {
    if (
      claim.sourceIds.length === 0 ||
      claim.sourceIds.some(
        (sourceId) => !SEERAH_SOURCES[sourceId] || SEERAH_SOURCES[sourceId].rightsStatus !== 'verified_public_domain'
      )
    ) {
      allReferencesValid = false;
    }
    if (claim.scholarlyNote && claim.scholarlyNote.trim().length > 0) {
      scholarlyNotesCount++;
    }
  }

  for (const chapter of SEERAH_CHAPTERS) {
    if (
      chapter.peopleIds.some((personId) => !SEERAH_PEOPLE[personId]) ||
      chapter.placeIds.some((placeId) => !SEERAH_PLACES[placeId])
    ) {
      allReferencesValid = false;
    }
    for (const scene of chapter.scenes) {
      if (
        scene.personIds.some((personId) => !SEERAH_PEOPLE[personId]) ||
        scene.placeIds.some((placeId) => !SEERAH_PLACES[placeId])
      ) {
        allReferencesValid = false;
      }
      for (const block of scene.bodyBlocks) {
        if (
          block.claimIds.length === 0 ||
          block.claimIds.some((claimId) => !SEERAH_CLAIMS[claimId]) ||
          block.sourceIds.length === 0 ||
          block.sourceIds.some((sourceId) => !SEERAH_SOURCES[sourceId])
        ) {
          allReferencesValid = false;
        }
        if (block.type === 'uncertainty_note') {
          uncertaintyBlocksCount++;
        }
      }
    }
    for (const q of chapter.quizQuestions) {
      if (
        !SEERAH_CLAIMS[q.claimId] ||
        q.sourceIds.length === 0 ||
        q.sourceIds.some((sourceId) => !SEERAH_SOURCES[sourceId]) ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.choices.length
      ) {
        allReferencesValid = false;
      }
    }
  }

  assert(
    allReferencesValid &&
      sourcesList.length >= 9 &&
      peopleList.length >= 6 &&
      placesList.length >= 7 &&
      uncertaintyBlocksCount >= 2 &&
      scholarlyNotesCount >= 4,
    'Every Seerah narrative block and quiz question maps to verified public-domain classical sources and preserves explicit uncertainty notes'
  );

  // 2b. Primary-source separation & textual accuracy checks (Chapter 1 typo, Badr consultation, Farewell Pilgrimage)
  const ch1 = getSeerahChapterById('ch-1-arabia-makkah');
  const ch1BlockB = ch1?.scenes[0]?.bodyBlocks.find((b) => b.id === 'blk-1-1-b');
  assert(
    Boolean(ch1BlockB) &&
      !ch1BlockB!.text.includes('كماخلّده') &&
      ch1BlockB!.text.includes('كما خلّده'),
    'Chapter 1 narrative preserves clean Arabic spacing («كما خلّده»)'
  );

  const ch10 = getSeerahChapterById('ch-10-badr');
  const ch10BlockA = ch10?.scenes[0]?.bodyBlocks.find((b) => b.id === 'blk-10-1-a');
  assert(
    Boolean(ch10BlockA) &&
      ch10BlockA!.sourceIds.includes('src-bukhari') &&
      ch10BlockA!.sourceIds.includes('src-muslim') &&
      ch10BlockA!.sourceIds.includes('src-ibn-hisham') &&
      ch10BlockA!.text.includes('المقداد بن الأسود') &&
      ch10BlockA!.text.includes('3952') &&
      ch10BlockA!.text.includes('سعد بن عبادة') &&
      ch10BlockA!.text.includes('1779') &&
      ch10BlockA!.text.includes('سعد بن معاذ') &&
      ch10BlockA!.text.includes('سيرة ابن هشام'),
    'Badr consultation distinguishes Al-Miqdad (Bukhari 3952), Sa\'d ibn Ubadah (Muslim 1779), and Sa\'d ibn Mu\'adh (Ibn Hisham)'
  );

  const ch14 = getSeerahChapterById('ch-14-farewell-pilgrimage');
  const ch14BlockA = ch14?.scenes[0]?.bodyBlocks.find((b) => b.id === 'blk-14-1-a');
  const ch14BlockC = ch14?.scenes[0]?.bodyBlocks.find((b) => b.id === 'blk-14-1-c');
  assert(
    Boolean(ch14BlockA) &&
      Boolean(ch14BlockC) &&
      !ch14BlockA!.text.includes('وسنته') &&
      !ch14BlockA!.text.includes('وسنتي') &&
      ch14BlockA!.text.includes('صحيح مسلم (1218)') &&
      ch14BlockA!.text.includes('كتاب الله') &&
      ch14BlockC!.sourceIds.includes('src-muwatta-malik') &&
      ch14BlockC!.sourceIds.includes('src-musnad-ahmad') &&
      ch14BlockC!.text.includes('موطأ مالك') &&
      ch14BlockC!.text.includes('23489'),
    'Farewell Pilgrimage separates Sahih Muslim 1218 («كتاب الله») from Muwatta Malik («كتاب الله وسنة نبيه») and Musnad Ahmad 23489 without misattribution to Sahihayn'
  );

  // 3. UID-scoped persistence for reading mode, last position, completed chapters & versioned bookmarks
  const memStore = new Map<string, string>();
  const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (k: string) => (memStore.has(k) ? memStore.get(k)! : null),
    setItem: (k: string, v: string) => {
      memStore.set(k, String(v));
    },
  };

  try {
    StorageService.setStorageScope('user:seerah_alpha', 'keep-guest');
    setSeerahReadingMode('continuous', mockStorage);
    saveSeerahReadingPosition('ch-8-hijrah-journey', 'sc-8-1-thawr-quba', mockStorage);
    toggleSeerahChapterCompleted('ch-1-arabia-makkah', mockStorage);
    toggleSeerahChapterCompleted('ch-2-birth-upbringing', mockStorage);
    toggleSeerahBookmark('ch-8-hijrah-journey', 'sc-8-1-thawr-quba', mockStorage);

    const alphaState = readSeerahProgressStore(mockStorage);
    const alphaSummary = getSeerahOverallProgress(alphaState);

    StorageService.setStorageScope('user:seerah_beta', 'keep-guest');
    const betaState = readSeerahProgressStore(mockStorage);
    const betaSummary = getSeerahOverallProgress(betaState);

    assert(
      alphaState.readingMode === 'continuous' &&
        alphaState.lastPosition?.chapterId === 'ch-8-hijrah-journey' &&
        alphaState.lastPosition?.bookVersion === SEERAH_BOOK_VERSION &&
        alphaSummary.completedChapters === 2 &&
        alphaSummary.percent === 12 &&
        alphaState.bookmarks.length === 1 &&
        betaState.readingMode === 'study' &&
        betaState.lastPosition === null &&
        betaSummary.completedChapters === 0 &&
        betaState.bookmarks.length === 0,
      'Seerah reading mode, last position, completed chapters, and versioned bookmarks isolate cleanly per authenticated UID'
    );

    StorageService.setStorageScope('user:seerah_alpha', 'keep-guest');
    const afterToggle = toggleSeerahBookmark('ch-8-hijrah-journey', 'sc-8-1-thawr-quba', mockStorage);
    assert(
      afterToggle.bookmarks.length === 0,
      'Toggling an existing Seerah scene bookmark removes it deterministically'
    );
  } finally {
    StorageService.setStorageScope('legacy');
  }

  return { passed, failed };
}
