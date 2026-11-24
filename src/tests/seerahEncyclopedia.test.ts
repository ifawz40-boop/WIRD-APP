import fs from 'node:fs';
import path from 'node:path';
import {
  SEERAH_ENCYCLOPEDIA_STORAGE_KEY,
  findChunkIdForVolumePage,
  findSectionForVolumePage,
  getEncyclopediaProgressSummary,
  normalizeArabicSearchQuery,
  readSeerahEncyclopediaStore,
  saveEncyclopediaPosition,
  searchSeerahEncyclopediaSync,
  setEncyclopediaFocusMode,
  setEncyclopediaFontSize,
  toggleEncyclopediaBookmark,
  toggleEncyclopediaSectionRead,
  updateEncyclopediaBookmarkNote,
  type SeerahEncyclopediaManifest,
  type SeerahEncyclopediaSearchIndex,
  type SeerahEncyclopediaToc,
} from '../services/seerahEncyclopediaService';
import { AUXILIARY_SCOPED_KEYS, StorageService } from '../services/storageService';
import { SEERAH_CHAPTERS } from '../data/seerahData';

export async function runSeerahEncyclopediaTests(): Promise<{ passed: number; failed: number }> {
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

  const baseDir = path.resolve(process.cwd(), 'public/data/seerah-encyclopedia');
  const manifestPath = path.join(baseDir, 'manifest.json');
  const tocPath = path.join(baseDir, 'toc.json');

  assert(
    fs.existsSync(manifestPath) && fs.existsSync(tocPath),
    'Seerah Encyclopedia manifest.json and toc.json exist under public/data/seerah-encyclopedia'
  );

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SeerahEncyclopediaManifest;
  const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8')) as SeerahEncyclopediaToc;

  // 1. Complete 4-volume, 2475-page corpus & curated 16-chapter cross-links
  assert(
    manifest.totalVolumes === 4 &&
      manifest.volumes.length === 4 &&
      manifest.totalPages === 2475 &&
      manifest.totalSections === 90 &&
      toc.sections.length === 90 &&
      manifest.totalChunks === 101,
    'Manifest and TOC cover all 4 volumes (2,475 printed pages, 90 chronological sections, 101 reading chunks)'
  );

  const all16Linked = SEERAH_CHAPTERS.every((ch) => {
    const link = manifest.curatedChapterLinks[ch.id];
    return Boolean(link) && toc.sections.some((s) => s.id === link.sectionId);
  });
  assert(
    all16Linked,
    'All 16 curated Seerah chapters cross-link to valid sections in Ibn Kathir Encyclopedia'
  );

  // 2. Modern 1964 editor preface excluded; Vol 1 Page 1 starts at classical matn
  const vol1Chunk1 = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'chunks/vol-1-chunk-01.json'), 'utf8')
  ) as { pages: Array<{ page: number; paragraphs: string[] }> };
  const v1p1Text = vol1Chunk1.pages[0]?.paragraphs.join(' ') || '';
  assert(
    vol1Chunk1.pages[0]?.page === 1 &&
      v1p1Text.includes('ذكر أخبار العرب') &&
      !v1p1Text.includes('مصطفى عبد الواحد'),
    'Volume 1 Chunk 01 starts at classical Ibn Kathir matn («ذكر أخبار العرب») and excludes modern 1964 preface'
  );

  // 3. Direct page-to-chunk and page-to-section lookups across volumes
  const fathChunk = findChunkIdForVolumePage(manifest, 3, 526);
  const fathSection = findSectionForVolumePage(toc, 3, 526);
  const hajjSection = findSectionForVolumePage(toc, 4, 211);
  assert(
    Boolean(fathChunk) &&
      fathChunk!.resolvedPage === 526 &&
      Boolean(fathSection) &&
      fathSection!.title.includes('فتح مكة') &&
      Boolean(hajjSection) &&
      hajjSection!.title.includes('حجة الوداع'),
    'Direct printed-page lookup accurately resolves Fath Makkah (Vol 3 p. 526) and Farewell Pilgrimage (Vol 4 p. 211)'
  );

  // 4. Arabic search normalization & full-text search across real generated volume search indexes
  assert(
    normalizeArabicSearchQuery('إِسْلامُ أَبي بَكرٍ الصِّدِّيقِ') === 'اسلام ابي بكر الصديق' &&
      normalizeArabicSearchQuery('غَزْوَةُ بَدْرٍ العُظْمَى') === 'غزوه بدر العظمي',
    'Arabic search normalizer strips diacritics and unifies alef, taa marbuta, and alef maqsura'
  );

  const vol2Search = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'search/vol-2-search.json'), 'utf8')
  ) as SeerahEncyclopediaSearchIndex;
  const vol3Search = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'search/vol-3-search.json'), 'utf8')
  ) as SeerahEncyclopediaSearchIndex;

  const badrHits = searchSeerahEncyclopediaSync('غزوة بدر', toc, [vol2Search], {
    volumeFilter: 2,
    maxResults: 20,
  });
  const uhudHits = searchSeerahEncyclopediaSync('غزوة أحد', toc, [vol3Search], {
    volumeFilter: 3,
    maxResults: 20,
  });

  assert(
    badrHits.length > 0 &&
      badrHits.some((h) => h.volume === 2 && h.matchType === 'section') &&
      badrHits.some((h) => h.volume === 2 && h.matchType === 'page') &&
      uhudHits.length > 0 &&
      uhudHits.some((h) => h.volume === 3 && h.page >= 18),
    'Full-text Arabic search returns both TOC section matches and printed-page hits across volumes'
  );

  // 5. UID-scoped persistence registration & strict user isolation
  assert(
    (AUXILIARY_SCOPED_KEYS as readonly string[]).includes(SEERAH_ENCYCLOPEDIA_STORAGE_KEY),
    'wird.seerah.encyclopedia.v1 is registered in AUXILIARY_SCOPED_KEYS for UID isolation and clean reset'
  );

  const mem = new Map<string, string>();
  const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
  };

  try {
    StorageService.setStorageScope('user:ency_alpha', 'keep-guest');
    saveEncyclopediaPosition(3, 526, fathSection!.id, mockStorage);
    toggleEncyclopediaSectionRead(fathSection!.id, mockStorage);
    toggleEncyclopediaBookmark(3, 526, fathSection!.id, 'فتح مكة — ج 3 ص 526', 'فائدة مهمة', mockStorage);
    updateEncyclopediaBookmarkNote('v3:p526', 'فتح مكة في رمضان سنة 8 هـ', mockStorage);
    setEncyclopediaFontSize('lg', mockStorage);
    setEncyclopediaFocusMode(true, mockStorage);

    const alphaStore = readSeerahEncyclopediaStore(mockStorage);
    const alphaSummary = getEncyclopediaProgressSummary(alphaStore, toc);

    StorageService.setStorageScope('user:ency_beta', 'keep-guest');
    const betaStore = readSeerahEncyclopediaStore(mockStorage);
    const betaSummary = getEncyclopediaProgressSummary(betaStore, toc);

    assert(
      alphaStore.lastPosition?.volume === 3 &&
        alphaStore.lastPosition?.page === 526 &&
        alphaStore.fontSize === 'lg' &&
        alphaStore.focusMode === true &&
        alphaStore.bookmarks.length === 1 &&
        alphaStore.bookmarks[0].note === 'فتح مكة في رمضان سنة 8 هـ' &&
        alphaSummary.completedSections === 1 &&
        alphaSummary.byVolume[3].completed === 1 &&
        betaStore.lastPosition === null &&
        betaStore.bookmarks.length === 0 &&
        betaSummary.completedSections === 0,
      'Encyclopedia position, bookmarks, personal notes, typography settings & section progress are strictly isolated per UID'
    );
  } finally {
    StorageService.setStorageScope('legacy', 'keep-guest');
  }

  // 6. Semantic design token hygiene in SeerahEncyclopediaReader.tsx (zero legacy hardcoded hexes)
  const readerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/seerah/SeerahEncyclopediaReader.tsx'),
    'utf8'
  );
  const legacyHexPattern = /#(?:0B132B|111F36|1C4E46|1E4A47|0E192D|152642|162744)\b/i;
  assert(
    !legacyHexPattern.test(readerSource),
    'SeerahEncyclopediaReader.tsx uses pure WIRD semantic CSS tokens with zero legacy hardcoded hex leaks'
  );

  return { passed, failed };
}
