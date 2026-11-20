# WIRD — Changelog

> Canonical append-only engineering evidence lives in [`docs/engineering/WORK_LOG.md`](./docs/engineering/WORK_LOG.md). This file summarizes user-visible and architectural milestones by phase.

## [Unreleased] — 2026-11-19 (Master Platform Transformation)

### Phase 1 — Core Experience Stabilization & Multi-Khatma Polish (Completed Locally)
- **Mushaf Spread & Multi-Khatma:**
  - Derived 2-page spread stepping reactively from `PrintedMushafSpread` context (`QuranMushafReader.tsx`) so toggling between single and facing pages immediately updates Next/Prev and swipe stepping.
  - Added Juz-range (`QURAN_JUZ_STARTS`) and Surah (`QURAN_PAGE_INDEX`) scope selectors when creating a Reading Khatma (`ReadingKhatmaPanel.tsx`).
  - Added inline quick-start Khatma button inside `QuranMushafReader.tsx` when no active khatma exists, and fixed 2-page/batch Undo (`تراجع`) to revert only newly marked pages.
  - Restored Hero Quran Header Banner + Search Bar above `ReadingKhatmaPanel` in `QuranLibraryView.tsx` and removed the duplicate Multi-Khatma strip from `DashboardView.tsx`.
- **Memorization Session & Printed Mushaf:**
  - Decoupled Printed Mushaf Tafsir browsing (`onTafsirAyahChange`) from active memorization ayah selection (`MemorizationSessionView.tsx`) and preserved active memorization highlight when `autoOpenTafsirOnSelect=false` (`PrintedMushafSpread.tsx`).
  - Added explicit light/dark SVG contrast rules for `[data-session-ayah='true']` (`src/index.css`).
  - Persisted cumulative linking final mastery synchronously (`saveCumulativeSessionProgress`) prior to `finalizeSessionCompletion()`.
- **Backend, Auth & Theme Parity:**
  - Aligned `index.html` and `public/manifest.json` `theme-color` (`#1C4E46`) and base surface colors; strengthened `src/tests/pwaIntegration.test.ts` to enforce manifest↔HTML parity.
  - Updated `/api/advisor/chat` (`server.ts`) to use `ai.models.generateContent` with bounded chat history context.
  - Prevented voluntary Google popup cancellation (`auth/popup-closed-by-user`, `auth/cancelled-popup-request`) from forcing `signInWithRedirect` (`src/services/authService.ts`).
- **Verification:** `npm.cmd run test` (`769 PASSED | 0 FAILED`), `npm.cmd run lint` (`tsc --noEmit` PASS), `npm.cmd run smoke:api-imports` (PASS), Production Vite build (`2.40s` PASS).

### Phase 2 — Complete Visual Identity Reinvention, Scalable Vector Emblem, Semantic Design System & Navigation (Completed Locally)
- **Crisp Scalable Vector Emblem & Architectural Mihrab Artwork:**
  - Replaced the embedded raster JPEG wrapper in `public/favicon.svg`, `src/components/brand/WirdLogo.tsx`, and `src/components/brand/WirdAvatar.tsx` with a pure **Scalable Vector SVG Emblem (`WirdVectorEmblemSvg`)** featuring an 8-pointed Rub el Hizb geometric frame, Mihrab arch with crescent finial, and an illuminated open Mushaf on a traditional Rihal stand across 6 semantic variants (`primary`, `light`, `dark`, `gold`, `monochrome`, `simplified`).
  - Added `WirdMihrabArch` architectural vector illustration in `src/components/brand/WirdPattern.tsx` and showcased all vector variants in `src/components/brand/BrandDesignShowcase.tsx`.
- **Semantic Design Tokens & Dark-Mode Contrast:**
  - Expanded semantic CSS tokens in `src/wird-identity.css` (`--wird-hero-gradient`, `--wird-accent-soft`, `--wird-ring`, `--wird-header-glass`), improved dark-mode muted text contrast (`#98adaa`), and added `.wird-hero-surface`, `.wird-section-badge`, `.wird-nav-indicator`, and `.wird-view-enter` (with `prefers-reduced-motion` guard).
- **Navigation & Shell Refinement:**
  - Added `المستشار القرآني` (`id: 'advisor'`) inside the `'المتابعة والمساندة'` group in `src/components/layout/Sidebar.tsx` right before `'الإعدادات'` (preserving `'الإعدادات'` as the final focusable sidebar item for the mobile drawer `Shift+Tab` focus-trap contract), applied the RTL gold active indicator (`.wird-nav-indicator`), and added contextual section subtitles in `src/components/layout/Header.tsx`.
- **Verification:** `npm.cmd run test` (`770 PASSED | 0 FAILED`), `npm.cmd run lint` (`tsc --noEmit` PASS), `npm.cmd run smoke:api-imports` (PASS), Production Vite build (`2.39s` PASS).

### Phase 3 — Unified Data Architecture, Offline Audio in Mushaf/Library, UID-Scoped Khatmas/Bookmarks & Canonical Weak-Verse Text (Completed Locally)
- **Local-First Offline Quran Audio in Mushaf & Library:**
  - Wired `offlineQuranAudioLibrary.resolvePlaybackSource(approvedReciterId, globalAyah, fallbackUrl)` into `QuranMushafReader.tsx` and `QuranLibraryView.tsx` (both single-ayah and segment queue playback), with automatic `ObjectURL` revocation and sequence race guards.
  - Updated opportunistic Service Worker pre-caching (`requestOfflineAudioCache`) in `QuranMushafReader.tsx` and `QuranLibraryView.tsx` to pass licensed `cdn.islamic.network` URLs (`getLicensedAyahAudioUrl`).
- **UID-Scoped Reading Khatmas, Mushaf Bookmarks & Reading Position:**
  - Added `AUXILIARY_SCOPED_KEYS` (`wird.reading.khatma.v1`, `wird.reading.khatmas.v2`, `wird.quran.pageBookmarks.v1`, `wird.quran.lastPage.v1`, `wird.quran.lastReadingPosition.v1`) and `StorageService.resolveScopedKey(key)` in `src/services/storageService.ts`, isolating Reading Khatmas and Mushaf Bookmarks per authenticated UID (`user:<uid>`) and migrating legacy records on first-account `'import'`.
- **Canonical Weak-Verse Verification & Live Preview in Revision Center:**
  - Updated `RevisionCenterView.tsx` to prioritize verified local Quran corpus text (`loadAyahByCoordinate`) over manual user input when recording weak verses, and added live verified Quran text previews in both the Failed-Revision Rating modal and the Manual Weak-Verse modal.
- **Verification:** `npm.cmd run test` (`772 PASSED | 0 FAILED`), `npm.cmd run lint` (`tsc --noEmit` PASS), `npm.cmd run smoke:api-imports` (PASS), Production Vite build (`2.75s` PASS).

### Phase 4 — Complete Daily Adhkar & Duas System with Verified Audio Playback, Counter & Free Tasbih (Completed Locally)
- **Verified Daily Adhkar & Duas Corpus (`src/data/adhkarData.ts`):**
  - Added 8 comprehensive categories (`morning`, `evening`, `after_prayer`, `sleeping`, `waking_up`, `quranic_duas`, `prophetic_duas`, `istighfar`) with full Arabic diacritics, authentic hadith/Quran sources, evidence grading (`قرآن كريم`, `متفق عليه`, `صحيح`, `حسن`), virtues, and time-of-day category recommendation (`getRecommendedAdhkarCategoryForHour`).
- **UID-Scoped Daily Counter, Favorites & Free Tasbih (`src/services/adhkarProgressService.ts`):**
  - Implemented UID-scoped persistence (`wird.adhkar.progress.v1`) for daily item repetition counts, category completion summaries, favorite Adhkar, and the cumulative Free Tasbih counter across 5 authentic presets (`FREE_TASBIH_PRESETS`).
- **Interactive Adhkar Workspace & Offline Quranic Audio (`src/components/adhkar/AdhkarView.tsx`):**
  - Built the lazy-loaded `AdhkarView` resolving verified local Quran chunks (`loadSurahVerses`) and local-first offline audio playback (`offlineQuranAudioLibrary.resolvePlaybackSource`) for all Quranic Adhkar & Duas, interactive tap-to-count cards with auto-advance, search/favorites/audio filters, Free Tasbih counter, and cross-navigation to Ruqyah (`#/ruqyah`).
- **Verification:** `npm.cmd run test` (`776 PASSED | 0 FAILED`), `npm.cmd run lint` (`tsc --noEmit` PASS), `npm.cmd run smoke:api-imports` (PASS), Production Vite build (`2.88s` PASS).

### Phase 5 — Complete Chronological Sourced Prophetic Seerah Experience (Completed Locally)
- **Chronological Sourced Prophetic Seerah Book (`src/data/seerahData.ts`):**
  - Added a versioned (`SEERAH_BOOK_VERSION = '1.0.0'`), chronological narrative book across 5 eras (`SEERAH_PARTS`) and 16 doubly-linked chapters (`SEERAH_CHAPTERS`) from pre-birth Makkah through birth, youth, revelation in Hira, public call & Abyssinia, Year of Sorrow & Isra/Mi'raj, Aqabah pledges, Hijrah, Madinah foundation, Badr, Uhud & Khandaq, Hudaybiyyah & letters to kings, Fath Makkah, Farewell Pilgrimage, passing to Al-Rafiq Al-A'la, and Shamail/character.
  - Mapped every narrative block and quiz question to 17 claim-level records (`SEERAH_CLAIMS`) and 7 public-domain classical sources (`SEERAH_SOURCES`) with evidence grading (`ثابت بالصحيح` / `مشهور في السير` / `محل خلاف تاريخي`) and explicit historical uncertainty notes (`uncertainty_note`).
- **UID-Scoped Progress & Versioned Scene Bookmarks (`src/services/seerahProgressService.ts`):**
  - Implemented UID-scoped persistence (`wird.seerah.progress.v1`) for reading mode (`continuous` vs `study`), last reading position, completed chapters, and versioned scene bookmarks, completely isolated from Quran memorization/khatma statistics.
- **Interactive Seerah Book Reader (`src/components/seerah/SeerahView.tsx`):**
  - Built the lazy-loaded `#/seerah` continuous narrative book reader with pure-reading vs verification mode toggle, parts/timeline index, figures/places/sources directory, bookmarks tab, and optional end-of-chapter comprehension quiz.
- **Verification:** `npm.cmd run test` (`781 PASSED | 0 FAILED`), `npm.cmd run lint` (`tsc --noEmit` PASS), `npm.cmd run smoke:api-imports` (PASS), Production Vite build (`2.34s` PASS).

### Phase 6 — Offline-First Hardening & Prayer Times / Hijri Calendar / Qibla Adapter (Completed Locally)
- **Cross-Tab Audio Download Locks & Cache Storage Orphan Sweeping (`src/services/offlineQuranAudioLibrary.ts`):**
  - Added per-job cross-tab exclusive worker locks (`wird-offline-audio-job-worker:${jobId}`), displaced generation cleanup on re-verification, and unindexed Cache Storage orphan key sweeping via `cache.keys()` during `reconcileLibrary()`.
- **AlAdhan API Adapter, Mathematical Qibla & Offline Hijri Date (`src/services/prayerTimesService.ts`, `src/components/dashboard/DashboardView.tsx`):**
  - Built `fetchDailyPrayerSchedule` with 4500ms timeout, `redirect: 'error'`, strict `HH:MM` sanitization, UID-scoped daily cache (`wird.prayer.cache.v1`), mathematical Great-Circle Qibla bearing calculation (`computeQiblaBearingDegrees`) to the Holy Kaaba (`21.422487° N, 39.826206° E`), offline Umm al-Qura Hijri date formatting (`formatLocalHijriDate`), next-prayer countdown (`getNextPrayerSummary`), and interactive Dashboard Prayer/Hijri/Qibla card across 8 city presets.
- **Verification:** `npm.cmd run test` (`788 PASSED | 0 FAILED`), `npm.cmd run lint` (`tsc --noEmit` PASS), `npm.cmd run smoke:api-imports` (PASS), Production Vite build (`2.17s` PASS).

### Phase 7 & Phase 8 — Bidirectional Multi-Device Sync with Tombstones, Anti-Resurrection & Final Platform Quality Audit (Completed Locally)
- **Collection-Specific Tombstones & Anti-Resurrection (`src/services/tombstoneReconciliationService.ts`):**
  - Added `CollectionTombstoneRecordV2` and `reconcileRecordsWithTombstones` for `plans`, `enginePlans`, `weakVerses`, and `portions`, enforcing clock-independent monotonic revision comparison, anti-resurrection suppression (`revision <= deletedAtRevision`), explicit restore superseding tombstones (`explicitRestore: true` at `revision > deletedAtRevision`), and fail-closed `concurrent_divergent_edit` conflict descriptors.
- **Convergent Multi-Device Weak-Verse Delta Reconciliation (`reconcileWeakVerseSnapshotsV2`):**
  - Aggregated per-device mistake increments (`deviceMistakeDeltas`) across independent devices without blind last-write-wins overwrites, and enforced anti-resurrection when `resolvedAtRevision >= revision`.
- **V2 Conflict Safety Classification (`src/services/syncConflictSafety.ts`):**
  - Added `isSafeV2ReconcilablePayload` for V2 tombstone and delta payloads while preserving fail-closed `containsUnsafeFullSnapshotProjection` for legacy V1 full snapshots.
- **Final Quality Audit (Phase 8):**
  - All 72 automated quality suites passed (`794 PASSED | 0 FAILED`), `tsc --noEmit` (`0` errors), `smoke:api-imports` (PASS), and Production Vite build (`2.34s`, `0` chunks > 500 kB, `dist/wird-precache-manifest.json` emitted).
