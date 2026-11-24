import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const baseDir = path.join(projectRoot, 'public/data/seerah-encyclopedia');

function assert(condition, message) {
  if (!condition) {
    throw new Error('[WIRD Seerah Validation] ' + message);
  }
}

const manifestPath = path.join(baseDir, 'manifest.json');
const tocPath = path.join(baseDir, 'toc.json');

assert(fs.existsSync(manifestPath), 'Missing manifest.json');
assert(fs.existsSync(tocPath), 'Missing toc.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));

assert(manifest.schemaVersion === 1, 'Unexpected manifest schemaVersion');
assert(manifest.totalVolumes === 4 && Array.isArray(manifest.volumes) && manifest.volumes.length === 4, 'Expected 4 volumes');
assert(manifest.totalPages >= 2400, `Expected >= 2400 pages, got ${manifest.totalPages}`);
assert(Array.isArray(toc.sections) && toc.sections.length === manifest.totalSections && toc.sections.length >= 70, 'Invalid TOC section count');

const sectionIdSet = new Set(toc.sections.map((s) => s.id));
assert(sectionIdSet.size === toc.sections.length, 'Duplicate section IDs in toc.json');

let countedPages = 0;
let countedChunks = 0;

for (const vol of manifest.volumes) {
  assert([1, 2, 3, 4].includes(vol.volume), `Invalid volume number ${vol.volume}`);
  assert(Array.isArray(vol.chunks) && vol.chunks.length === vol.chunkCount && vol.chunks.length > 0, `Invalid chunks in volume ${vol.volume}`);

  const seenVolPages = new Set();
  for (const chRef of vol.chunks) {
    const chunkPath = path.join(baseDir, 'chunks', `${chRef.chunkId}.json`);
    assert(fs.existsSync(chunkPath), `Missing chunk file: ${chunkPath}`);
    const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
    assert(chunk.chunkId === chRef.chunkId && chunk.volume === vol.volume, `Chunk metadata mismatch in ${chRef.chunkId}`);
    assert(Array.isArray(chunk.pages) && chunk.pages.length > 0, `Empty chunk ${chRef.chunkId}`);
    for (const pg of chunk.pages) {
      assert(Number.isInteger(pg.page) && pg.page >= 1, `Invalid page number in ${chRef.chunkId}`);
      assert(sectionIdSet.has(pg.sectionId), `Unknown sectionId ${pg.sectionId} in ${chRef.chunkId} p.${pg.page}`);
      assert(Array.isArray(pg.paragraphs) && pg.paragraphs.length > 0 && pg.paragraphs.every((p) => typeof p === 'string' && p.trim().length > 0), `Empty paragraph in ${chRef.chunkId} p.${pg.page}`);
      assert(!seenVolPages.has(pg.page), `Duplicate page ${pg.page} in volume ${vol.volume}`);
      seenVolPages.add(pg.page);
    }
    countedChunks++;
  }

  assert(seenVolPages.size === vol.pageCount, `Volume ${vol.volume} page count mismatch: ${seenVolPages.size} vs ${vol.pageCount}`);
  countedPages += seenVolPages.size;

  // Validate search index file
  const searchPath = path.join(baseDir, 'search', `vol-${vol.volume}-search.json`);
  assert(fs.existsSync(searchPath), `Missing search index: ${searchPath}`);
  const searchIdx = JSON.parse(fs.readFileSync(searchPath, 'utf8'));
  assert(searchIdx.volume === vol.volume && Array.isArray(searchIdx.entries) && searchIdx.entries.length === vol.pageCount, `Search index page count mismatch in volume ${vol.volume}`);
}

assert(countedPages === manifest.totalPages, `Total pages mismatch: ${countedPages} vs ${manifest.totalPages}`);
assert(countedChunks === manifest.totalChunks, `Total chunks mismatch: ${countedChunks} vs ${manifest.totalChunks}`);

// Validate all 16 curated chapter cross-links
const linkKeys = Object.keys(manifest.curatedChapterLinks || {});
assert(linkKeys.length === 16, `Expected 16 curatedChapterLinks, got ${linkKeys.length}`);
for (const key of linkKeys) {
  const link = manifest.curatedChapterLinks[key];
  assert(sectionIdSet.has(link.sectionId), `Invalid curatedChapterLinks sectionId for ${key}`);
  assert(fs.existsSync(path.join(baseDir, 'chunks', `${link.chunkId}.json`)), `Invalid curatedChapterLinks chunkId for ${key}`);
}

// Verify modern 1964 editor preface is NOT present in Vol 1 Chunk 01
const v1c1 = JSON.parse(fs.readFileSync(path.join(baseDir, 'chunks', 'vol-1-chunk-01.json'), 'utf8'));
const firstPageText = v1c1.pages[0].paragraphs.join(' ');
assert(firstPageText.includes('ذكر أخبار العرب'), 'Vol 1 Page 1 must begin with «ذكر أخبار العرب»');
assert(!firstPageText.includes('مصطفى عبد الواحد'), 'Modern editor preface must be excluded from Vol 1 Chunk 01');

console.log(
  `[WIRD Seerah Validation] PASS — 4 volumes, ${countedPages} printed pages, ${toc.sections.length} structured sections, ${countedChunks} chunks, 4 full-text search indexes, and 16 curated chapter cross-links verified.`
);
