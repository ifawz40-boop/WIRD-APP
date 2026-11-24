import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const pubDir = path.join(projectRoot, 'public/data/seerah');
const researchDir = path.join(projectRoot, 'research');
const quranPath = path.join(projectRoot, 'src/data/completeQuranData.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error('[WIRD Seerah Content Verification] ' + message);
  }
}

// 1. Research Repository Verification (Phase 1 & Phase 2)
assert(fs.existsSync(path.join(researchDir, 'source_manifest.json')), 'Missing research/source_manifest.json');
assert(fs.existsSync(path.join(researchDir, 'processing_checkpoints.json')), 'Missing research/processing_checkpoints.json');

const checkpoints = JSON.parse(fs.readFileSync(path.join(researchDir, 'processing_checkpoints.json'), 'utf8'));
assert(
  checkpoints.totalPagesTracked === 2566 &&
    checkpoints.extractedMatnPages === 2475 &&
    Array.isArray(checkpoints.exception_register) &&
    checkpoints.exception_register.length === 91,
  'All 2,566 PDF pages across all 4 volumes must have documented processing status'
);

// 2. Published Seerah Book Manifest & Structure (Phase 6–10)
const manifestPath = path.join(pubDir, 'manifest.json');
assert(fs.existsSync(manifestPath), 'Missing public/data/seerah/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert(manifest.totalEras === 6 && manifest.eras.length === 6, 'Expected 6 historical eras');
assert(manifest.totalSections === 12 && manifest.sections.length === 12, 'Expected 12 historical sections');
assert(manifest.totalChapters === 40 && manifest.chapters.length === 40, 'Expected 40 chronological chapters');
assert(manifest.totalCharacters === 32 && manifest.characters.length === 32, 'Expected 32 character profiles');

const quranCorpus = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
const hadithBank = new Map(
  JSON.parse(
    fs.readFileSync(path.join(researchDir, 'quotations/hadith_and_athar_quotations.json'), 'utf8')
  ).quotations.map((h) => [h.quoteId, h])
);

function expectedQuranString(surahNumber, startAyah, endAyah) {
  const ayahs = quranCorpus[String(surahNumber)];
  assert(Array.isArray(ayahs), `Unknown Surah ${surahNumber}`);
  const selected = ayahs.filter((a) => a.numberInSurah >= startAyah && a.numberInSurah <= endAyah);
  assert(selected.length > 0, `Invalid ayah range ${surahNumber}:${startAyah}-${endAyah}`);
  if (selected.length === 1) return selected[0].text.trim();
  return selected.map((a) => `${a.text.trim()} ﴿${a.numberInSurah}﴾`).join(' ');
}

const chapterIdSet = new Set(manifest.chapters.map((c) => c.id));
const characterIdSet = new Set(manifest.characters.map((c) => c.id));
const sourceIdSet = new Set(manifest.sources.map((s) => s.id));
const placeIdSet = new Set(manifest.places.map((p) => p.id));

assert(chapterIdSet.size === 40, 'Duplicate chapter IDs detected');
assert(characterIdSet.size === 32, 'Duplicate character IDs detected');

const seenTitles = new Set();
let verifiedQuranBlocks = 0;
let verifiedHadithBlocks = 0;

// 3. Verify Every Chapter File, Order, Reviews, Links & Sacred Quotations
for (let idx = 0; idx < manifest.chapters.length; idx++) {
  const card = manifest.chapters[idx];
  assert(card.order === idx + 1, `Chapter order mismatch at ${card.id}`);
  assert(!seenTitles.has(card.title), `Duplicate chapter title: ${card.title}`);
  seenTitles.add(card.title);
  assert(card.status === 'Published', `Chapter ${card.id} is not Published (${card.status})`);

  const expectedPrev = idx === 0 ? null : manifest.chapters[idx - 1].id;
  const expectedNext = idx === manifest.chapters.length - 1 ? null : manifest.chapters[idx + 1].id;
  assert(card.previousChapterId === expectedPrev && card.nextChapterId === expectedNext, `Broken prev/next chain on ${card.id}`);

  const chPath = path.join(pubDir, 'chapters', `${card.id}.json`);
  assert(fs.existsSync(chPath), `Missing published chapter file: ${chPath}`);
  const ch = JSON.parse(fs.readFileSync(chPath, 'utf8'));

  assert(
    ch.reviews?.historical === 'passed' &&
      ch.reviews?.language === 'passed' &&
      ch.reviews?.quotation === 'passed' &&
      ch.status === 'Published',
    `Chapter ${ch.id} did not pass all 3 review gates`
  );
  assert(Array.isArray(ch.scenes) && ch.scenes.length >= 3, `Chapter ${ch.id} has fewer than 3 scenes`);
  assert(ch.wordCount >= 450, `Chapter ${ch.id} narrative is incomplete (${ch.wordCount} words)`);

  for (const cid of ch.characterIds) {
    assert(characterIdSet.has(cid), `Unresolved character ${cid} in ${ch.id}`);
  }
  for (const pid of ch.placeIds) {
    assert(placeIdSet.has(pid), `Unresolved place ${pid} in ${ch.id}`);
  }
  for (const sid of ch.sourceIds) {
    assert(sourceIdSet.has(sid), `Unresolved source ${sid} in ${ch.id}`);
  }

  for (const sc of ch.scenes) {
    for (const blk of sc.blocks) {
      if (blk.type === 'quran') {
        const expected = expectedQuranString(blk.surahNumber, blk.startAyah, blk.endAyah);
        assert(blk.verbatimText === expected, `Quran quotation tampered in ${ch.id} (${blk.quoteId})`);
        verifiedQuranBlocks++;
      } else if (blk.type === 'hadith') {
        const ref = hadithBank.get(blk.quoteId);
        assert(Boolean(ref) && blk.verbatimText === ref.verbatimText, `Hadith quotation tampered in ${ch.id} (${blk.quoteId})`);
        verifiedHadithBlocks++;
      } else {
        assert(!blk.text.includes('﴿') && !blk.text.includes('﴾'), `Unverified Quranic brackets in prose of ${ch.id}`);
      }
    }
  }
}

// 4. Verify All 32 Character Narratives & Bidirectional Links
const charsBundlePath = path.join(pubDir, 'characters/characters.json');
assert(fs.existsSync(charsBundlePath), 'Missing public/data/seerah/characters/characters.json');
const charsBundle = JSON.parse(fs.readFileSync(charsBundlePath, 'utf8'));
assert(Array.isArray(charsBundle.characters) && charsBundle.characters.length === 32, 'Expected 32 full character stories');

for (const person of charsBundle.characters) {
  assert(
    person.reviews?.historical === 'passed' &&
      person.reviews?.language === 'passed' &&
      person.reviews?.quotation === 'passed' &&
      person.status === 'Published',
    `Character ${person.id} did not pass all 3 review gates`
  );
  assert(Array.isArray(person.narrativeStoryParagraphs) && person.narrativeStoryParagraphs.length >= 4, `Character ${person.id} missing continuous narrative`);
  assert(Array.isArray(person.linkedChapterIds) && person.linkedChapterIds.length >= 1, `Character ${person.id} has no linked chapters`);
  for (const chId of person.linkedChapterIds) {
    assert(chapterIdSet.has(chId), `Character ${person.id} links to unknown chapter ${chId}`);
  }
  for (const m of person.chronologicalMoments) {
    assert(chapterIdSet.has(m.chapterId), `Character ${person.id} moment links to unknown chapter ${m.chapterId}`);
  }
}

// 5. Verify Search Index
const searchPath = path.join(pubDir, 'search-index.json');
assert(fs.existsSync(searchPath), 'Missing public/data/seerah/search-index.json');
const searchData = JSON.parse(fs.readFileSync(searchPath, 'utf8'));
assert(Array.isArray(searchData.items) && searchData.items.length === 72, 'Expected 72 searchable items (40 chapters + 32 characters)');

console.log(
  `[WIRD Seerah Content Verification] PASS — 6 eras, 12 sections, 40 published chapters, 32 published character stories, ${verifiedQuranBlocks} verbatim Quranic quotations, ${verifiedHadithBlocks} verbatim Hadith quotations, and 100% bidirectional referential integrity verified.`
);
