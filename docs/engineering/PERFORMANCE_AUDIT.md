# WIRD — Performance Audit

## Current verified follow-up — 2026-11-14 (PR #373 merged)

- Ruqyah code merge SHA: `d265bdf37e9410ad6cd99273bb595526dce63b50`.
- PR #373 removed the static chain `RuqyahView → ruqyahContentService → verifiedAyahs → completeQuranData.json`.
- `ruqyahContentService` now uses the existing `loadSurahVerses(surahNumber)` loader, validates complete local Surah chunks against canonical metadata, and resolves only Surahs required by selected Ruqyah items.
- Ruqyah view loads Quran items asynchronously with explicit loading/error/retry states. Audio queue construction is asynchronous, preserves category/item/ayah order, deduplicates global ayah numbers, and cancels stale requests on category change/unmount.
- IslamicAPI remains a coordinate-only index. API library displays Quran through `QuranText` and WIRD's local Tanzil Simple chunks; provider verse text/translation is stripped.
- Exact-head CI run `43634212804` on PR head `c42286fa6a5a85bba414a45383a56bd7a00f0cc2`: 711/0 automated tests, Firestore Rules Emulator, TypeScript/build/server smoke pass, and 160 desktop/mobile Playwright checks pass.
- Preview `dpl_JE7AddCKxTgu5XygzznNjnSL4STq` READY on exact PR head; Production `dpl_6rDxKfTk19xmc94uqnY7toYKfm5Q` READY on exact merged code SHA.
- The dedicated 604 Mushaf coordinate-map step was SKIPPED. Live Production Ruqyah route/audio smoke remains NOT VERIFIED.
- Historical bundle comparison from earlier Preview evidence: RuqyahView chunk 1,997.87 kB → 67.19 kB minified (−96.64%), gzip 355.98 kB → 18.52 kB (−94.80%). This is an earlier verified build measurement, not a newly measured size for the merged Production deployment.

## Previous source and build evidence — 2026-11-13 (historical baseline)

### Confirmed Quran-corpus bundle duplication

The current production baseline is `main` at `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.

Source chain:
1. `src/components/ruqyah/RuqyahView.tsx` statically imports `getRuqyahAudioQueue`, `getRuqyahDisplayText`, and `getRuqyahAyahs` from `src/services/ruqyahContentService.ts`.
2. `src/services/ruqyahContentService.ts` statically imports `VERIFIED_AYAHS` from `src/data/verifiedAyahs.ts`.
3. `src/data/verifiedAyahs.ts` statically imports `src/data/completeQuranData.json`.
4. The repository tree reports `completeQuranData.json` at 2,513,293 bytes.
5. The existing `src/data/quranDataLoader.ts` already provides `loadSurahVerses(surahNumber)` backed by `import.meta.glob('./quran-surahs/*.json')`, with per-Surah lazy chunks.

The latest docs-only Vercel Preview build from the same main-derived runtime emitted:
- `dist/assets/RuqyahView-*.js`: 1,997.87 kB minified, 355.98 kB gzip.
- Vite warned that one or more chunks exceed the 650 kB configured warning threshold.

This is direct evidence that the Ruqyah route's static import chain pulls the complete canonical Quran JSON into its route chunk despite the existing per-Surah lazy loader. The route is lazy at the app level, but its own first-load payload is unnecessarily large.

### Safe remediation design

1. Refactor `ruqyahContentService` to resolve canonical text through `loadSurahVerses(surahNumber)` asynchronously; preserve exact coordinate, length, and non-empty text validation.
2. Update every Ruqyah view/API-library call site to await the requested Surah chunks. Avoid preloading all 114 Surahs when the selected Ruqyah items reference only a small subset.
3. Keep Quran display text sourced exclusively from WIRD's bundled verified corpus. Do not substitute provider-returned verse text or generate Quran text.
4. Keep audio queue coordinates derived from validated local Surah/ayah records and the approved reciter URL builder.
5. Add tests proving the Ruqyah service does not statically import `verifiedAyahs` / `completeQuranData.json`, each referenced Surah loads on demand, corrupted/missing chunks fail closed, and all brief/medium/long categories resolve their complete expected ayah ranges.
6. Rebuild and compare emitted chunk sizes; verify the Ruqyah chunk no longer contains the full 2.5 MB JSON source. Do not silence the warning by increasing `chunkSizeWarningLimit`.

### Scope and safety

This is a source-level performance finding and remediation plan only. No runtime code was changed in this audit. No Quran corpus, text, tafsir, audio provider, Firestore data, IndexedDB schema, production setting, or user data was modified. Implement the refactor on a separate code branch with exact-head tests and Preview verification before considering merge.

### 2026-11-13 call-site inventory (read-only follow-up)

The source and test call sites were re-opened against the current `main` tree at the baseline SHA above:

- `src/components/ruqyah/RuqyahView.tsx` is the only production component importing the synchronous service helpers.
  - Audio path: `startRuqyahAudio` synchronously calls `getRuqyahAudioQueue` for every Quran item in the selected category. The refactor must await each distinct Surah once, preserve deduplication by global ayah number, and reject stale async requests after category/view changes or unmount.
  - Display path: the card renderer synchronously calls `getRuqyahAyahs` for every Quran card. The refactor must introduce explicit loading/error states per requested card or a category-level loader; it must not render the editable `RuqyahItem.text` fallback when canonical lookup fails.
  - Non-Quran path: dua/guideline display currently returns the supplied local item text synchronously. Keep this behavior and avoid unnecessary Quran chunk requests for these entries.
- `src/components/ruqyah/RuqyahApiLibrary.tsx` does not import the content-service helpers. Its external API records are coordinates/index metadata; if it displays Quran content, it must continue resolving the actual text through WIRD's local verified Quran component/data path and never trust provider verse text.
- `src/services/ruqyahContentService.test.ts` currently assumes synchronous helpers. Convert its tests to async and retain checks for all Quran item ranges, exact first/last ayah coordinates, display-text equality, complete ordered audio queues, dua text preservation, and fail-closed invalid coordinates.
- `src/tests/runAllTests.ts` already registers `runRuqyahContentServiceTests`; keep the suite registered and ensure its runner awaits asynchronous results.
- `src/data/quranDataLoader.ts` is the existing lazy source. Its `loadSurahVerses` currently returns an empty array for an invalid Surah number and throws for a missing generated module. The Ruqyah service must validate coordinates itself, then validate the returned array's Surah identity, expected verse count, sequential `numberInSurah`, global numbering, and non-empty text before exposing any result.

### Implementation gates added by this inventory

1. Build a unique-Surah promise map per category/audio request so the same Surah is not imported repeatedly; do not add a new global cache competing with `quranDataLoader`'s cache.
2. Cancel or ignore stale UI work using an AbortController/request token; category changes, unmount, and stopping audio must not let an old promise replace the current queue or UI.
3. Preserve brief, medium, full, eye/envy, and illness categories, including categories that contain overlapping ayahs. Audio deduplication must remain stable and preserve first occurrence order.
4. Add structural regression coverage that fails if `ruqyahContentService.ts` imports `verifiedAyahs` or `completeQuranData.json` (directly or through a new static barrel).
5. Test a missing/corrupt Surah chunk and confirm the affected card/audio action reports an explicit error without silently falling back to hand-entered Quran text.
6. Keep this as a separate implementation PR. Do not modify canonical Quran data, generated chunks, Firebase/Firestore, IndexedDB, production flags, or main while the Actions runner allocation issue remains unresolved.

