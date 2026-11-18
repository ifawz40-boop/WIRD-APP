# Offline Tafsir al-Muyassar — Source, Reuse and Storage Specification

**Last reviewed:** 2026-11-17  
**Integration:** `release/wird-completion-20261118` (integrated; exact-head verification pending)

## Canonical source

- **Digital source:** QuranEnc.com — https://quranenc.com/ar/browse/arabic_moyassar/
- **API endpoint:** `https://quranenc.com/api/v1/translation/sura/arabic_moyassar/{surah_number}`
- **Translation key:** `arabic_moyassar`
- **Edition:** Arabic Tafsir al-Muyassar, catalogue version **1.0.1**, dated **2026-11-09**
- **Publisher:** King Fahd Complex for the Printing of the Holy Quran (مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة)
- **Catalogue verification:** `GET https://quranenc.com/api/v1/translations/list/ar?localization=ar`; the downloader checks that the live catalogue still reports the pinned version before it begins. The official API documentation states that authentication is not required and CORS is open.

The QuranEnc API provides a surah payload with ayah coordinates, translation text and footnotes (and may include source Arabic text/edition fields). The app accepts a direct array or the documented result/data array wrapper, validates the required coordinates and translation, but stores the complete original JSON payload unchanged. The live catalogue version check prevents silently labelling newer source content with an older version number.

## Reuse conditions

Follow the official QuranEnc terms: https://quranenc.com/ar/home/about/terms

The reuse conditions require:
1. Do not modify, add to, or delete any translation content.
2. Clearly identify the translation publisher.
3. Include the translation version number.
4. Preserve edition information embedded in the original content.
5. Send feedback/corrections about translation notes to QuranEnc.
6. Keep the translation updated when the source publishes a newer version.
7. Do not display the translation in an environment with unsuitable advertisements.

WIRD stores the raw payload without editing translation or footnote fields, displays publisher/source/version attribution, contains no advertising in this reading surface, and does not generate replacement Tafsir with AI. The app's local Quran text always comes from WIRD's verified Quran corpus, never from the Tafsir endpoint.

## Download and validation contract

- Download is explicitly initiated by the user while online; no automatic network call is made merely by opening a Quran page.
- Download one surah at a time for predictable progress and resumability.
- Validate each response against WIRD's canonical `ALL_SURAHS[surahNumber - 1].versesCount`.
- Every row must have the requested surah number, the sequential ayah number, and a non-empty string translation.
- Reject incomplete, duplicated, reordered, wrong-surah or empty-translation payloads. Do not mark the package ready unless all **114 surahs** are present and validated.
- Preserve the original response object/array, including all footnotes and source-provided edition metadata. Keep app bookkeeping (downloaded time, source version) in separate IndexedDB record metadata.
- Persist each validated surah before incrementing progress. Pause, navigation away, network failure or browser closure must leave already verified surahs available for resume.
- Resume skips surahs already stored for the current source version and fetches only missing surahs.
- Display reads from IndexedDB only. No QuranEnc request is made while the user is reading after a complete download.
- Data is stored on the current device only and is not copied to Firestore or account sync.
- If the app's source-version constant changes, the previous version is not treated as the current complete package; the user must complete the current-version download before Tafsir display is enabled.

## Current Mushaf and offline behavior

- In facing-page Mushaf mode, both sides remain Quran by default; the existing Tafsir pane opens for the selected ayah.
- Page overview lists the ayahs on the page. Selecting one opens its Tafsir in the pane; the source translation itself is not rewritten.
- The offline fallback is enabled only for the explicitly selected Tafsir Muyassar edition (edition ID 16) and only after the complete 114-surah package passes its manifest/source-version validation.
- If the package is partial, stale, corrupt or unavailable, it is not presented as a complete offline edition. The settings panel offers resume/verification; the reader continues with normal online/cache behavior and reports an error if neither source is available.
- Local fallback visibly identifies QuranEnc.com, the publisher and pinned version. The stored source payload and footnotes remain unchanged; WIRD's canonical Quran text remains the sole source for ayah text and coordinates.
- A separate full-page Tafsir layout is not yet mounted in the main Mushaf spread UI; `TafsirMushafPage.tsx` remains an optional component pending a later UX decision.

## Implementation locations

- `src/services/tafsirOfflineLibrary.ts`
- `src/components/library/TafsirOfflineDownloadPanel.tsx`
- `src/components/library/TafsirMushafPage.tsx`
- `src/components/library/QuranMushafReader.tsx`
- `e2e/wird-navigation-tafsir.spec.ts`

## Release gates

PR #386 remains Draft until exact-head CI, desktop/mobile E2E, source-integrity rejection tests, pause/resume tests and offline reading tests pass. The prerequisite CI chain is currently blocked by the high-severity picomatch advisory documented in docs/CONTINUE_HERE.md. Do not bypass the security audit.
