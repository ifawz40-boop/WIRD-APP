# WIRD — Master Project State

**Current snapshot reconciled:** 2026-11-26 (Master App Overhaul on `feat/master-app-overhaul-20261126` from `main` @ `9d97c725` — Typography & Circle-Glyph Elimination, New Minimalist Geometric SVG Logo & PWA Icons, Written + Audio Ruqyah Rebuild with MediaSession & Offline Downloads, Gemini 2.5 Flash AI Assistant Upgrade, Runtime Prefetch/Memory Coordinator & 100% Full-Offline 311-Asset Package)  
**Repository:** `ifawz40-boop/WIRD-APP` · **Production URL:** https://wird-app.vercel.app/ · **Primary branch:** `main` (base `9d97c725`) · **Active branch:** `feat/master-app-overhaul-20261126`

- **Verified Feature Branch State (2026-11-26 — Owner-Authorized for `main` Push & Vercel Deployment):**
  - **Phase 1 — Typography & Circle-Glyph Elimination (`37af33d0`):** Replaced QPC-encoded `UthmanicHafs1Ver18` primary font with `Amiri Quran` / `Scheherazade New` for Quranic text and `Amiri` / `IBM Plex Sans Arabic` for editorial & UI copy; passed canonical `(surahNumber, ayahNumber)` coordinates to `QuranText`; replaced `' ۞ '` separators with `﴿رقم﴾`; `0` bytes changed in canonical Quran corpus.
  - **Phase 2 — Brand Identity & ZERO AI Look (`bde6aaa8`):** New geometric SVG emblem across `WirdLogo.tsx`, `WirdAvatar.tsx`, `WirdPattern.tsx`, `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`; refined warm paper light (`#FAF6EE`) & restful deep dark (`#06120E`) tokens; zero card-in-card nesting; `0` emojis in production `src/`.
  - **Phase 3 — Ruqyah Shar'iyyah Rebuild (`d99ab6be`):** Clear separation & 3-way filtering between Quranic Ruqyah and Authentic Prophetic Sunnah Duas; `MediaSession` lock-screen/background audio controls, ±10s seek, floating mini-player, and full offline audio download/storage (`offlineQuranAudioLibrary.ts` `'ruqyah'` scope + reconnect auto-resume).
  - **Phase 4 — Gemini 2.5 Flash AI Assistant (`871b74dd`):** Upgraded `api/advisor.ts` & `server.ts` to `gemini-2.5-flash` (with `gemini-2.0-flash` + deterministic local fallback, server-side key only), Arabic intent analyzer, progress-aware context, and UID-scoped chat persistence (`wird.advisor.chat.v1`).
  - **Phase 5 — Internal Runtime & 100% Offline-First (`577a7fe7`):** Added `runtimeCoordinator.ts` (hover/idle route prefetching, Surah cache RAM trimming, reconnect download auto-resume), exponential-backoff retry in `cloudSyncCoordinator.ts`, `311` total offline assets in `wird-precache-manifest.json` (incl. all `43` Seerah JSON files + PWA icons), and 4-worker parallel resumable full-offline downloads in `public/sw.js`.
  - **Local Verification Executed (2026-11-26):**
    - `npm.cmd run lint` (`tsc --noEmit` + Tanzil validation): **PASS** (`0` errors)
    - `node scripts/verify_seerah_content.mjs`: **PASS** (`6` eras, `12` sections, `40` chapters, `32` characters, `52` Quran + `43` Hadith verbatim quotes)
    - `npm.cmd run smoke:api-imports`: **PASS**
    - `npm.cmd test` (74 suites): **PASS** (`816 PASSED | 0 FAILED`)
    - `NODE_ENV=production vite build`: **PASS** (`3.07s`, `allAssets: 311`, `seerahInAll: 43`, `0` chunks > 500 kB)
    - `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
    - Protected files diff (`MASTER_DIRECTIVE.md`, Quran corpus, `firestore.rules`, `bun.lock`): **PASS** (`0` bytes diff)
    - Production `src/` emoji scan: **PASS** (`0` hits)
    - Playwright E2E (`app-shell`, `dashboard-ux`, `ruqyah-ux`, `ruqyah-audio`, `advisor-ux`, `seerah-book`, `settings-ux` on Edge Chromium Desktop `1440×900` & Mobile `390×844`): **PASS** (`50 passed | 0 failed`)
    - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub Actions CI).
    - Production Sync Flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`), `firestore.rules`, `bun.lock`, secrets, and Quran corpus: **UNTOUCHED**.

> This leading section is the sole current-state summary. Older snapshots below are historical evidence and must not override these facts.

## Historical Workspace Snapshot — 2026-11-25 (Complete Prophetic Seerah Digital Book — Merged into `main`)

- **Local Feature Branch State & Verification (2026-11-25 — NOT pushed/merged to `main` and NOT deployed to Vercel):**
  - **Structured Research Repository & Chronological Blueprint (`research/`, `scripts/phase1_build_research_repo.py`, `scripts/phase2_build_seerah_blueprint.py`):**
    - Tracked 100% of all `2,566` PDF pages across the 4 volumes of Imam Ibn Kathir's *Al-Sīra al-Nabawiyya* (`2,475` verified matn pages + `91` classified non-matn apparatus pages) in `research/processing_checkpoints.json`, with `90` major events, `120` sub-events, `32` personalities, `26` places, `22` classical sources, `50/50` verbatim Quranic passages, `43/43` verbatim Hadiths, and `18` historical disputes.
    - Reconstructed the complete book hierarchy: **6 Historical Eras → 12 Main Sections → 40 Chronological Chapters → 120 Narrative Scenes** + **32 Personalities** bidirectionally linked.
  - **Complete Narrative Authoring, 3-Pass Editorial Review & Static Bundle Publication (`research/authored_chapters/`, `research/authored_characters/`, `scripts/phase5_quotation_verify_and_publish.py`, `public/data/seerah/`):**
    - Authored `40 / 40` third-person Arabic historical chapters (`53,280` words) and `32 / 32` independent continuous character stories (`26,400` words) = **`79,680` words**.
    - Passed all `40` chapters and `32` characters through independent Review A (Historical Accuracy), Review B (Arabic Writing Quality), and Review C (Deterministic byte-for-byte verification of `52` Quranic blocks vs `src/data/completeQuranData.json` and `43` Hadith blocks vs Ibn Kathir matn), publishing lazy-loaded static JSON under `public/data/seerah/`.
  - **Calm Digital Book Reader, UID-Scoped Progress & Legacy Cleanup (`src/components/seerah/`, `src/services/seerahBookService.ts`, `src/services/storageService.ts`, `src/services/router.ts`, `public/sw.js`):**
    - Replaced `SeerahView.tsx` with `SeerahBookLanding.tsx`, `SeerahChapterReader.tsx`, and `SeerahCharacterViews.tsx` (`0` legacy hexes); registered `'wird.seerah.v2'` in `AUXILIARY_SCOPED_KEYS`; updated `public/sw.js` for `/data/seerah/*.json`; removed obsolete Seerah files and `public/data/seerah-encyclopedia/` (`0` dangling refs).
  - **Local Verification Executed (2026-11-25):**
    - `node scripts/verify_seerah_content.mjs`: **PASS** (`6` eras, `12` sections, `40` chapters, `32` characters, `52` Quran + `43` Hadith verbatim quotes, 100% bidirectional links)
    - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
    - `npm.cmd test` (74 suites incl. `src/tests/seerahBookSystem.test.ts` + Tanzil validation & 114 Surah chunk split): **PASS** (`814 PASSED | 0 FAILED`)
    - `npm.cmd run smoke:api-imports`: **PASS**
    - `NODE_ENV=production` + `vite build`: **PASS** (`2.92s`, `SeerahView` `49.26 kB` / `10.39 kB` gzip, `index` `246.39 kB`, `0` chunks > 500 kB)
    - `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
    - Playwright E2E (`e2e/seerah-book.spec.ts` on Edge Chromium Desktop `1440×900` & Mobile `390×844`): **PASS** (`4 passed | 0 failed`, `22.4s`, `0` page errors, `0` horizontal overflow)
    - `docs/seerah/MASTER_DIRECTIVE.md` integrity check: **PASS** (unmodified, `20,130` bytes, SHA-256 `7a1e25cf667fa62d6dccd268237ddaf32a128d3cc53d7704e2776af68a8d1472`)
    - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub CI).
    - GitHub Actions CI, Vercel Preview, Vercel Production, Production Sync Flags, `firestore.rules`, `bun.lock`, and Quran corpus: **UNTOUCHED / NOT EXECUTED**.

> This leading section is the sole current-state summary. Older snapshots below are historical evidence and must not override these facts.

## Historical Workspace Snapshot — 2026-11-24 (Superseded Raw Encyclopedia Prototype on `feat/seerah-encyclopedia-ibn-kathir`)

- **Local Feature Branch State & Verification (2026-11-24 — NOT pushed/merged to `main` and NOT deployed to Vercel):**
  - **Directives & Corpus Build Pipeline (`docs/seerah/MASTER_DIRECTIVE.md`, `docs/seerah/EXECUTION_STATUS.md`, `scripts/build-seerah-encyclopedia.py`, `scripts/validate-seerah-encyclopedia.mjs`, `public/data/seerah-encyclopedia/`):**
    - Verified all 4 owner-supplied PDFs in gitignored `seerah-sources/` are 1-bit scanned images (`0` text chars) and benchmarked local Windows `ar-SA` OCR (rejected due to severe garbling).
    - Extracted the exact matching 4-volume public-domain matn of *Al-Sīra al-Nabawiyya* by Imam Ibn Kathir (d. 774 AH) from OpenITI (`0774IbnKathir.Bidaya.Shamela0000930-ara6`, CC BY-NC-SA 4.0 attribution recorded), strictly excluding the modern 1964 editor preface: **4 volumes, 2,475 printed pages, 90 chronological sections, 101 reading chunks (<= 57.5 KB each, `5.02 MB` total), 4 full-text normalized Arabic search indexes (`5.94 MB` total), 567,856 words, and 16 curated chapter cross-links**.
  - **Encyclopedia Service, UID Isolation & Offline SW Caching (`src/services/seerahEncyclopediaService.ts`, `src/services/storageService.ts`, `public/sw.js`):**
    - Registered `'wird.seerah.encyclopedia.v1'` in `AUXILIARY_SCOPED_KEYS`; added lazy chunk/search loaders, normalized Arabic full-text search, direct volume+page navigation, Cache API per-volume offline download, and Cache-First `/data/seerah-encyclopedia/*.json` routing in `public/sw.js` (`wird-app-content-v1`).
  - **Upgraded Seerah Reader & E2E/Unit Coverage (`src/components/seerah/SeerahEncyclopediaReader.tsx`, `src/components/seerah/SeerahView.tsx`, `src/tests/seerahEncyclopedia.test.ts`, `src/tests/runAllTests.ts`, `e2e/seerah-encyclopedia.spec.ts`):**
    - Preserved all 16 curated Seerah chapters (`seerahData.ts`) and `seerahSystem.test.ts` intact, added deep-links from all 16 curated chapters into Ibn Kathir's Encyclopedia, added 4-volume selector, full-text search, page jumper, font/focus controls, personal bookmark notes, and unified bookmarks view using pure `--wird-*` semantic CSS tokens.
  - **Local Verification Executed (2026-11-24):**
    - `node scripts/validate-seerah-encyclopedia.mjs`: **PASS** (`4` volumes, `2,475` pages, `90` sections, `101` chunks, `4` search indexes, `16` curated links)
    - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
    - `npm.cmd test` (75 suites incl. `seerahEncyclopedia.test.ts` + Tanzil validation & 114 Surah chunk split): **PASS** (`822 PASSED | 0 FAILED`)
    - `npm.cmd run smoke:api-imports`: **PASS**
    - `NODE_ENV=production` + `vite build`: **PASS** (`2.82s`, `SeerahView` `162.65 kB` / `38.21 kB` gzip, `index` `245.92 kB`, 0 chunks > 500 kB)
    - `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
    - Playwright E2E (`e2e/seerah-encyclopedia.spec.ts` on Edge Chromium Desktop `1440×900` & Mobile `390×844`): **PASS** (`4 passed | 0 failed`, `35.6s`, `0` page errors, `0` horizontal overflow)
    - Legacy hex scan across `src/components/seerah/*.tsx`: **PASS** (`0` matches)
    - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub CI).
    - GitHub Actions CI, Vercel Preview, Vercel Production, Production Sync Flags, `firestore.rules`, `bun.lock`, and Quran corpus: **UNTOUCHED / NOT EXECUTED**.

> This leading section is the sole current-state summary. Older snapshots below are historical evidence and must not override these facts.

## Historical Workspace Snapshot — 2026-11-23 (Extensible Video Series Platform)

- **Local Workspace State & Verification (2026-11-23 — AI Studio Workspace, NOT committed/pushed to GitHub and NOT deployed to Vercel):**
  - **Extensible Multi-Series Catalog & Safe YouTube Helpers (`src/data/videoSeriesCatalog.ts`):**
    - Added extensible multi-series data schema (`VideoSeriesDefinition`, `VideoLessonItem`, `VideoSeriesCategory`) preloaded with all **13 verified episodes** of «سلسلة بناء النفس المطمئنة» (`PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5`, م. علاء حامد, `16 ساعة و 15 دقيقة`), plus strict YouTube video/playlist ID validators and `youtube-nocookie.com` embed helpers.
  - **UID-Scoped Watch Tracking, Daily Suggestion Engine & Multi-Series Store (`src/services/videoSeriesService.ts`, `src/services/storageService.ts`):**
    - Registered `'wird.video.series.v1'` in `AUXILIARY_SCOPED_KEYS` for per-UID isolation, guest-to-account migration, and clean reset.
    - Implemented deterministic daily lesson picker (`getDailySuggestedLesson`), manual next-suggestion stepping (`advanceDailySuggestedLesson`), per-lesson status transitions (`unwatched`/`in_progress`/`completed`), personal lesson notes, featured-series selection (`setFeaturedSeries`), and custom series registration/removal (`addCustomSeries`, `removeCustomSeries`).
  - **Read-Only SSRF-Safe Playlist API (`api/youtube-playlist.ts`, `server.ts`, `scripts/smoke-api-imports.mjs`):**
    - Added `/api/youtube-playlist?list=<playlistId>` strictly validating `^[A-Za-z0-9_-]{10,64}$` against hardcoded `https://www.youtube.com` endpoints with timeouts and rate limiting.
  - **Dashboard Card, Full Series Workspace & Routing (`src/components/series/DailyVideoSuggestionCard.tsx`, `src/components/series/VideoSeriesView.tsx`, `src/components/dashboard/DashboardView.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`):**
    - Rendered `DailyVideoSuggestionCard` (`#dashboard-daily-series`) on the Dashboard with inline player, completion toggle, next-lesson skip, progress bar, and deep-link to `#/series?series=<id>&video=<videoId>`.
    - Built lazy-loaded `VideoSeriesView` (`#/series`) with multi-series shelf, full searchable/filterable episode checklist, inline player, personal notes, and «إضافة سلسلة جديدة» YouTube playlist importer modal.
    - Added `السلاسل المرئية` to `Sidebar.tsx` (preserving `الإعدادات` as the final focusable item) and `DashboardView.tsx` quick actions with pure semantic CSS tokens.
  - **Local Verification Executed (2026-11-23):**
    - `npm test` (74 suites incl. `src/tests/videoSeriesSystem.test.ts`, Tanzil validation & 114 Surah chunk build): **PASS** (`812 PASSED | 0 FAILED`)
    - `npm run smoke:api-imports` (incl. `api/youtube-playlist.ts`): **PASS**
    - Live `/api/youtube-playlist` check on port `3000`: **PASS** (HTTP `200`, `13` episodes for valid playlist; HTTP `400` for invalid ID)
    - Legacy hex scan across `src/components/series`: **PASS** (`NO_LEGACY_HEX_FOUND`)
    - Headless Chromium visual & interaction verification (`1440x900` desktop Light/Dark & `390x844` mobile Dark): **PASS** (Dashboard card, `#/series` deep-link, «إضافة سلسلة جديدة» modal, `overflowX: false`, `0` console/page errors)
    - `compile_applet` & `lint_applet`: **PASS**
    - `npm run test:firestore-rules`: **BLOCKED** locally (`java` absent in container).
    - GitHub Actions CI, Vercel Preview, Vercel Production, Production Sync Flags, `firestore.rules`, and Quran corpus: **UNTOUCHED / NOT EXECUTED** from AI Studio.

> This leading section is the sole current-state summary. Older snapshots below are historical evidence and must not override these facts.

## Historical Workspace Snapshot — 2026-11-22 (Four-Variant Design Integration)

- **Local Workspace State & Verification (2026-11-22 — AI Studio Workspace):**
  - **Four-Variant Preference & Token Engine (`src/services/themePreferences.ts`, `src/wird-identity.css`, `src/main.tsx`):**
    - Replaced 3 legacy UI presets with two orthogonal axes: `design` (`'design-a'` Andalusian Heritage `#FFF9EC`/`#041610` default, `'design-b'` Modern Calm Slate `#F9FBFA`/`#08121E`) and `appearanceMode` (`'light'` default, `'dark'`). Switching one axis never resets the other; `resetThemePreferences()` restores `design-a` + `light`; legacy stored presets migrate deterministically via `mapLegacyPresetToDesign`.
    - Resolved CSS specificity ordering in `src/wird-identity.css` using explicit `:root[data-wird-design='design-a'|'design-b']` and `:root.dark[data-wird-design='design-a'|'design-b']` blocks plus `--wird-sidebar-bg`, `--wird-mushaf-paper`, `--wird-primary-ink`, and `--wird-accent-ink`.
    - Referenced real local PNG previews & emblems from `/public/assets/aistudio/` for all 4 variants.
  - **Appearance Selector, Unified Navigation & App-Wide Token Harmonization:**
    - Built `src/components/ui/AppearanceSelectorPanel.tsx` (`layout="sheet" | "settings"`) and wired it into both `ThemeCustomizerSheet.tsx` (header trigger with active `A`/`B` indicator) and `SettingsView.tsx` (`#settings-appearance-section`), alongside a compact A/B + Light/Dark toggle bar in `AuthScreen.tsx`, unified collapsible right sidebar (`Sidebar.tsx`), and updated `BrandDesignShowcase.tsx`.
    - Removed hardcoded legacy hex colors across 18 feature/shared components and paired `text-[var(--wird-primary)]` with `dark:text-[var(--wird-accent)]` across 15 components (81 occurrences) to ensure crisp dark-mode contrast; tightened `DashboardView.tsx` hero spacing.
    - Updated `src/tests/designSystemV2.test.ts` to validate all 4 variants, asset presence, legacy migration, CSS cascades, selector wiring, and token hygiene.
  - **Local Verification Executed (2026-11-22):**
    - `npm test` (73 suites incl. Tanzil validation + 114 Surah chunk build): **PASS** (`806 PASSED | 0 FAILED`)
    - `npm run smoke:api-imports`: **PASS**
    - Legacy hex scan across `src/components` (excluding intentional `brand/`, `QuranMushafFacsimilePage.tsx`, `QuranTypographyLab.tsx`): **PASS** (`0` matches)
    - Headless Chromium visual verification (desktop `1440x900` & mobile `390x844`): **PASS** (exact RGB backgrounds verified across all 4 variants + Restore Defaults, `0` console/page errors, `overflowX: false`, dark-mode contrast visually verified on final screenshots)
    - `compile_applet` & `lint_applet`: executed on final workspace pass.
    - `npm run test:firestore-rules`: **BLOCKED** locally (`java` absent in container).
    - GitHub Actions CI, Vercel Preview, Vercel Production, Production Sync Flags, `firestore.rules`, and Quran corpus: **UNTOUCHED / NOT EXECUTED** from AI Studio.

## Historical Platform Transformation Snapshot — 2026-11-20 (Draft PR `#404` on `feat/platform-transformation-20261120`)
**Refreshed GitHub `origin/main` baseline (fetched 2026-11-20):** `61554d60da5a5bbb644f6698d7b6193068a4d70a` (`feat(ai): add chat history context and update styles`); previous CI-passing PR `#404` head: `bcbf26fecaa293da257473d780c9459b5b119ebf` (Run `44672654181`: 100% PASS)  
**Repository:** `ifawz40-boop/WIRD-APP` · **Production URL:** https://wird-app.vercel.app/ · **Primary branch:** `main` · **Active PR branch:** `feat/platform-transformation-20261120` (Draft PR `#404`)

- **Local Workspace Verification (2026-11-20 — Prepared on `feat/platform-transformation-20261120`, NOT yet committed/pushed to GitHub and NOT deployed to Vercel):**
  - **Runtime & Environment:** Windows PowerShell, Node `v26.13.0`, npm `11.20.0`, `git 2.56.0.windows.4`, `node_modules` installed (`289` packages). `bun`, `java`, `gh`, and `vercel` are absent locally. Canonical `bun.lock` and `metadata.json` restored from `origin/main` (`61554d60da5a5bbb644f6698d7b6193068a4d70a`).
  - **Phase 1 Changes Implemented (2026-11-19):**
    - `index.html`, `public/manifest.json`, `src/tests/pwaIntegration.test.ts`: unified `theme-color` (`#1C4E46`) and body surface tokens; enforced manifest↔HTML theme parity test.
    - `src/components/dashboard/DashboardView.tsx`: removed duplicate Multi-Khatma strip above Welcome Banner.
    - `src/components/library/QuranLibraryView.tsx` & `src/components/library/ReadingKhatmaPanel.tsx`: restored Hero Quran Header Banner + Search Bar above Khatma panel; added exact Juz-range (`QURAN_JUZ_STARTS`) and Surah (`QURAN_PAGE_INDEX`) scope presets; wired inline quick-start Khatma callback to `QuranMushafReader`.
    - `src/components/library/QuranMushafReader.tsx`: derived `isTwoPageSpreadActive` reactively from `printedSpreadContext.isTwoPage`; filtered Undo (`تراجع`) to newly recorded pages only; added inline quick-start Khatma CTA inside Mushaf reader.
    - `src/components/library/PrintedMushafSpread.tsx`, `src/components/session/MemorizationSessionView.tsx`, `src/index.css`: decoupled printed-mode Tafsir browsing from active memorization ayah index; preserved active memorization highlight when `autoOpenTafsirOnSelect=false`; added light/dark CSS contrast rules for `[data-session-ayah='true']`; persisted cumulative mastery confirmation synchronously via `saveCumulativeSessionProgress` before `finalizeSessionCompletion()`; scoped `awaitingFinalConfirm` reset to `currentAyahIndex`.
    - `server.ts` & `src/services/authService.ts`: fixed `/api/advisor/chat` to use `ai.models.generateContent` with bounded history context; removed user popup close/cancel from `signInWithRedirect` fallback.
    - `src/tests/sessionStudyUi.test.ts`: added Phase 1 stabilization regression test.
  - **Phase 2 Changes Implemented (2026-11-19):**
    - `public/favicon.svg`, `src/components/brand/WirdLogo.tsx`, `src/components/brand/WirdAvatar.tsx`: replaced embedded raster JPEG with a pure **Scalable Vector SVG Emblem (`WirdVectorEmblemSvg`)** featuring an 8-pointed Rub el Hizb geometric frame, Mihrab arch with crescent finial, and an illuminated open Mushaf on a traditional Rihal stand across 6 semantic variants (`primary`, `light`, `dark`, `gold`, `monochrome`, `simplified`), while retaining `OFFICIAL_BRAND_EMBLEM_URL` for optional `renderMode="raster"`.
    - `src/components/brand/WirdPattern.tsx`: added `WirdMihrabArch` architectural vector illustration for hero headers and empty states.
    - `src/wird-identity.css`: expanded semantic design tokens (`--wird-hero-gradient`, `--wird-accent-soft`, `--wird-ring`, `--wird-header-glass`), improved dark-mode muted text contrast (`#98adaa`), and added `.wird-hero-surface`, `.wird-section-badge`, `.wird-nav-indicator`, and `.wird-view-enter`.
    - `src/components/layout/Sidebar.tsx` & `src/components/layout/Header.tsx`: added `المستشار القرآني` (`id: 'advisor'`) inside `'المتابعة والمساندة'` before `'الإعدادات'` (preserving `'الإعدادات'` as the final focusable sidebar item for the mobile drawer `Shift+Tab` focus trap), applied `.wird-nav-indicator`, and added contextual section subtitles in `Header.tsx`.
    - `src/components/brand/BrandDesignShowcase.tsx` & `src/tests/pwaIntegration.test.ts`: added the Vector Emblem & Architectural Mihrab gallery and Phase 2 automated assertions.
  - **Phase 3 Changes Implemented (2026-11-20):**
    - `src/services/storageService.ts` & `src/services/readingKhatmaService.ts`: added `AUXILIARY_SCOPED_KEYS` (`wird.reading.khatma.v1`, `wird.reading.khatmas.v2`, `wird.quran.pageBookmarks.v1`, `wird.quran.lastPage.v1`, `wird.quran.lastReadingPosition.v1`) and `StorageService.resolveScopedKey(key)` so Reading Khatmas, Mushaf Bookmarks, and Last Reading Positions are isolated per authenticated UID (`user:<uid>`) and migrated on first-account `'import'`.
    - `src/components/library/QuranMushafReader.tsx` & `src/components/library/QuranLibraryView.tsx`: wired `offlineQuranAudioLibrary.resolvePlaybackSource(approvedReciterId, globalAyah, fallbackUrl)` into Mushaf page/segment playback and Library ayah/segment playback with automatic `ObjectURL` revocation and sequence race guards, and passed licensed `cdn.islamic.network` URLs (`getLicensedAyahAudioUrl`) to `requestOfflineAudioCache`.
    - `src/components/revision/RevisionCenterView.tsx`: prioritized verified local Quran corpus text (`loadAyahByCoordinate`) over manual user input when recording weak verses, and added live verified Quran text previews in both the Failed-Revision Rating modal and the Manual Weak-Verse modal.
    - `src/services/readingKhatmaService.test.ts` & `src/tests/pwaIntegration.test.ts`: added automated tests for UID-scoped Reading Khatmas and Phase 3 offline audio/bookmark wiring.
  - **Phase 4 Changes Implemented (2026-11-20):**
    - `src/data/adhkarData.ts`: created a verified, sourced, fully vocalized Daily Adhkar & Duas corpus across 8 categories (`morning`, `evening`, `after_prayer`, `sleeping`, `waking_up`, `quranic_duas`, `prophetic_duas`, `istighfar`) plus 5 Free Tasbih presets and time-of-day category recommendation (`getRecommendedAdhkarCategoryForHour`).
    - `src/services/adhkarProgressService.ts` & `src/services/storageService.ts`: implemented UID-scoped persistence (`wird.adhkar.progress.v1`) for daily item repetition counts, category completion summaries, favorite Adhkar, and the cumulative Free Tasbih counter.
    - `src/components/adhkar/AdhkarView.tsx`: built the Daily Adhkar & Duas workspace resolving verified local Quran chunks (`loadSurahVerses`) and local-first offline audio playback (`offlineQuranAudioLibrary.resolvePlaybackSource`) for all Quranic Adhkar/Duas, interactive tap-to-count cards with auto-advance, search/favorites/audio filters, Free Tasbih counter, and cross-navigation to Ruqyah (`#/ruqyah`).
    - `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`, `src/components/dashboard/DashboardView.tsx`: registered `'adhkar'` (`الأذكار والأدعية`) in navigation (before `'الإعدادات'`), routing, lazy-loaded chunks, and dashboard quick actions.
    - `src/tests/adhkarSystem.test.ts` & `src/tests/runAllTests.ts`: added automated test suite verifying all 8 categories, Quranic coordinate bounds, UID-scoped counters/favorites/Tasbih, and offline audio integration.
  - **Phase 5 Changes Implemented (2026-11-20):**
    - `src/data/seerahData.ts`: created a versioned (`SEERAH_BOOK_VERSION = '1.0.0'`), chronological Prophetic Seerah book spanning 5 chronological parts (`SEERAH_PARTS`) and 16 doubly-linked narrative chapters (`SEERAH_CHAPTERS`) from pre-birth Makkah through birth, youth, revelation in Hira, public call & Abyssinia, Year of Sorrow & Isra/Mi'raj, Aqabah pledges, Hijrah, Madinah foundation, Badr, Uhud & Khandaq, Hudaybiyyah & letters to kings, Fath Makkah, Farewell Pilgrimage, passing to Al-Rafiq Al-A'la, and Shamail/character — with 17 claim-level records (`SEERAH_CLAIMS`), 7 public-domain classical sources (`SEERAH_SOURCES`), evidence grades (`ثابت بالصحيح` / `مشهور في السير` / `محل خلاف تاريخي`), and explicit uncertainty notes.
    - `src/services/seerahProgressService.ts` & `src/services/storageService.ts`: implemented UID-scoped persistence (`wird.seerah.progress.v1`) for reading mode (`continuous` vs `study`), last reading position, completed chapters, and versioned scene bookmarks, completely isolated from Quran memorization/khatma statistics.
    - `src/components/seerah/SeerahView.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`, `src/components/dashboard/DashboardView.tsx`: built the lazy-loaded `#/seerah` continuous narrative book reader with pure-reading vs verification mode toggle, parts/timeline index, figures/places/sources directory, bookmarks tab, and optional end-of-chapter comprehension quiz.
    - `src/tests/seerahSystem.test.ts` & `src/tests/runAllTests.ts`: added automated test suite verifying the 5-part / 16-chapter chain, claim/source/figure/place integrity, uncertainty notes, and UID-scoped progress/bookmarks.
  - **Phase 6 Changes Implemented (2026-11-20):**
    - `src/services/offlineQuranAudioLibrary.ts` & `src/services/offlineQuranAudioLibrary.test.ts`: added per-job cross-tab exclusive worker locks (`wird-offline-audio-job-worker:${jobId}`), displaced generation cleanup on re-verification, and unindexed Cache Storage orphan key sweeping via `cache.keys()` during `reconcileLibrary()`.
    - `src/services/prayerTimesService.ts`, `src/services/prayerTimesService.test.ts`, `src/components/dashboard/DashboardView.tsx`: built the AlAdhan API adapter (`fetchDailyPrayerSchedule`) with 4500ms timeout, `redirect: 'error'`, strict `HH:MM` sanitization, UID-scoped daily cache (`wird.prayer.cache.v1`), mathematical Great-Circle Qibla bearing calculation (`computeQiblaBearingDegrees`) to the Holy Kaaba (`21.422487° N, 39.826206° E`), offline Umm al-Qura Hijri date formatting (`formatLocalHijriDate`), next-prayer countdown (`getNextPrayerSummary`), and interactive Dashboard Prayer/Hijri/Qibla card across 8 city presets.
  - **Phase 7 Changes Implemented (2026-11-20):**
    - `src/services/tombstoneReconciliationService.ts`, `src/services/syncConflictSafety.ts`, `src/services/tombstoneReconciliationService.test.ts`: implemented `CollectionTombstoneRecordV2`, `reconcileRecordsWithTombstones` (clock-independent revision comparison, anti-resurrection suppression when `revision <= deletedAtRevision`, explicit restore superseding tombstones at `revision > deletedAtRevision`, and fail-closed `concurrent_divergent_edit` conflict descriptors), `reconcileWeakVerseSnapshotsV2` (per-device mistake delta convergence + resolved-at-revision anti-resurrection), and `isSafeV2ReconcilablePayload` (while preserving fail-closed `containsUnsafeFullSnapshotProjection` for V1 full snapshots).
  - **Phase 8 + Release Readiness Fixes & Local Verification (2026-11-20 — Draft PR `#404`):**
    - Applied primary-source religious fixes (`src/data/adhkarData.ts`, `src/data/seerahData.ts`), category-specific Adhkar repetition targets (`1×` after obligatory prayer vs `3×` morning/evening/sleep) and backward-compatible legacy ID alias (`adhkar-sleep-bismika-ربي-wadatu` → `adhkar-sleep-bismika-rabbi-wadatu`) across `src/services/adhkarProgressService.ts` and `src/components/adhkar/AdhkarView.tsx`, plus cache-only exclusion of `wird.prayer.cache.v1` from guest legacy-data prompts in `src/services/storageService.ts`.
    - `npm.cmd run test` (incl. Tanzil Simple validation + 114 Surah chunk split across all 72 suites): **PASS** (`800 PASSED | 0 FAILED`)
    - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
    - `npm.cmd run smoke:api-imports`: **PASS**
    - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`3.27s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
    - `bun@1.4.4 install --frozen-lockfile`: **PASS** (`Checked 304 installs across 371 packages`)
    - `bun@1.4.4 audit --audit-level=high`: **PASS** (`No vulnerabilities found (checked 360 packages)`)
    - GitHub Actions `WIRD Quality Gate` (Firestore Rules Emulator + Desktop & Mobile Playwright E2E + server smoke): previous head `bcbf26fe` passed 100% (Run `44672654181`); new Release Readiness Fixes commit queued for exact-head CI verification on PR `#404`. Production settings, sync flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`), `firestore.rules`, `authService.ts`, Quran corpus, Vercel, and `main` remain completely untouched.

> Historical evidence below predates both the 2026-11-22 workspace update and the 2026-11-20 snapshot.

## Historical AI Studio workspace verification — 2026-11-17
  - **Firebase configuration verified (`firebase-applet-config.json`):** `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`.
  - **Code & build fixes applied in workspace (2026-11-16 + 2026-11-17):**
    - `package.json` (`NODE_ENV=production vite build`), `src/main.tsx` (DOM-ready `/sw.js` registration), `public/sw.js` (non-blocking font precaching after shell precache), `api/advisor.ts` TypeScript narrowing, `server.ts` Arabic rate-limit copy fix.
    - `src/services/authService.ts` (`کاربر` -> `مستخدم` in null-user guards); `src/services/advisorService.ts` (`buildBoundedChatPayload` clamping long chat histories under 4KB + `try/finally` `clearTimeout` on all `fetch` calls).
    - `src/components/settings/SettingsView.tsx` (fail-closed conflict UI via `containsUnsafeFullSnapshotProjection` for `weakVerses`/`activityEvents` snapshots); `src/components/assistant/QuranAdvisorView.tsx` (calculator `NaN` fix + 604-page full-Quran calculation, `checkStatus` unmount guard, 500-char input limit); `src/components/plans/PlanningEngineWizard.tsx` (`paceQuantity` `0`/`NaN` live/preview guard); `src/components/ruqyah/RuqyahView.tsx` (`autoAdvanceTimerRef` cleanup); `src/components/brand/BrandDesignShowcase.tsx` (`copyTimerRef` cleanup).
    - Regression & E2E tests updated/added (`src/tests/geminiSecurity.test.ts`, `src/tests/firebaseAuth.test.ts`, `e2e/advisor-ux.spec.ts`, and 6 aligned UX specs).
  - **Local workspace gates executed on final state:**
    - `npx tsc --noEmit`: **PASS**
    - `npm test` (`runAllTests.ts` + pre-scripts): **PASS** (`733 PASSED | 0 FAILED`)
    - `npm run build` (`NODE_ENV=production vite build`): **PASS** (`2.07s`, zero chunks > 500 kB, 9-asset shell precache manifest + 252 lazy assets, `/sw.js` active without `jsxDEV`)
    - `npm run mushaf:validate-coverage`: **PASS** (all 604 SVG pages / 6,236 unique local ayahs mapped once)
    - `npm run smoke:api-imports` & `npm run smoke:server`: **PASS**
    - Desktop + Mobile Playwright (all 18 `e2e/*.spec.ts` files): **PASS** (`164` executed passed, `2` intentionally skipped, `0` failed; includes offline app-shell reload, 252-asset full offline preparation, and calculator `NaN` regression)
    - `npm run test:firestore-rules`: **BLOCKED** (Java runtime absent in AI Studio container: `Could not spawn java -version`)
    - GitHub commit/push & exact-head CI for workspace fixes: **NOT EXECUTED** (no `.git` remote push in Studio sandbox)
    - Vercel Production deployment for workspace fixes: **NOT EXECUTED** (by explicit owner instruction; Production sync flags remain untouched)

> This leading section is the sole current-state summary. Older snapshots below are historical evidence and must not override these facts.

## Historical repository and documentation status — 2026-11-14 snapshot

| Item | Observed value | Status |
|---|---|---|
| Latest application-code merge on main | `d265bdf37e9410ad6cd99273bb595526dce63b50` | PASS |
| Latest main HEAD (CI-only PR #372) | `f264e4bdea7496090f60940e9e8db03e2fb15696` | PASS |
| PR #372 Bun CI migration | Merged; exact-head run `43391729769` on `950640ea78d29e87d426a89d8887c15e4de2abac` | PASS |
| PR #372 Vercel Production | `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` READY on merge SHA | PASS |
| PR #374 repository hygiene | Open Draft, 8 commits behind main; package/lockfile overlap | BLOCKED |
| PR #363 documentation standard | Merged; canonical docs/agent bootstrap present on main | PASS |
| PR #373 Ruqyah lazy loading | Merged at `d265bdf37e9410ad6cd99273bb595526dce63b50` | PASS |
| PR #373 exact-head Quality Gate | Run `43634212804` on `c42286fa6a5a85bba414a45383a56bd7a00f0cc2` | PASS |
| Automated tests (CI 2026-11-14) | 711 passed / 0 failed | PASS |
| Firestore Rules Emulator / TypeScript / build / server smoke | Passed in run `43634212804` | PASS |
| Desktop + mobile Playwright (CI 2026-11-14) | 160 passed, including Ruqyah E2E | PASS |
| 604 Mushaf coordinate-map check (CI 2026-11-14) | SKIPPED in CI (later PASSED locally 2026-11-16) | HISTORICAL |
| Vercel Production | READY, `dpl_6KvNeEcmRV53ERHisLNwQgNTcojV`, source SHA `1c025e0...` (docs-only descendant containing code merge `d265bdf...`) | PASS |
| Production Ruqyah route/audio smoke | Not directly tested | NOT VERIFIED |
| Google AI Studio sync | Local Studio edits verified 2026-11-16; GitHub sync of Studio changes pending | PARTIAL |
| Firebase Production Rules | Not independently verified | NOT VERIFIED |
| Local checkout/tests (pre-2026-11-16) | Historical baseline prior to 2026-11-16 AI Studio run | HISTORICAL |

## Current scope and safety

- PR #363 was documentation/instructions only; PR #373 contains Ruqyah lazy-loader/API-coordinate/UI/audio-queue changes and regression coverage.
- No Quran source corpus, Firebase Rules/data, Vercel environment variables, secrets, sync flags, or manual deployment changed.
- Previous read-only Vercel inventory reported `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` as `true`. Do not change either without explicit owner approval.
- Full stale-document audit remains IN PROGRESS; 55 Markdown files exist under `docs/`.

## Open PR inventory — refreshed 2026-11-14

| PR | Head SHA | Disposition |
|---:|---|---|
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Hygiene; reconcile with #372 |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun/CI candidate; previous run failed before steps/logs |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Codec-only |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Session display settings |
| #369 | `3478ae22a200a817a240d8b28e532b01674427bf` | Multi-range; generated-index E2E outstanding |
| #368 | `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8` | Offline audio; lifecycle/cross-tab gaps |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | Interim payload cap only |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/offline; reconcile with #368 |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah prototype; pending owner scope |
| #364 | `2a98c6da77bd849811326696ab7075fe6c9c85b8` | Advisor security |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Legacy audio; do not merge beside #368 |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Legacy audio; do not merge beside #368 |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy; do not merge wholesale |

PR #363 and #373 are merged. PR #375 and #360 are closed/superseded; #361/#362 are merged.

## Next execution order

1. #372/#374 dependency hygiene; reconcile package/lockfile ownership and verify exact-head CI.
2. #366/#368 offline audio: one canonical store, recoverable cache protocol, cross-tab and account-isolation tests.
3. #364 Advisor security; complete adversarial verification.
4. #369/#370 memorization/session UX; generated index, boundaries, browser E2E and persistence.
5. #367/#371 archive; no chunked sync claim before real storage integration and multi-client recovery tests.
6. Full stale-document audit and release certification.
7. Verify Google AI Studio has pulled main.


## Historical PR #363 documentation consolidation — merged 2026-11-14

- 46 changed paths, including root `README.md` and the mandatory documentation operating standard.
- The 534-line deletion from `docs/engineering/progress/WORK_LOG.md` is a compatibility-pointer conversion; canonical `docs/engineering/WORK_LOG.md` preserves the historical log. Verify this relationship and retain the pointer.
- The last completed Quality Gate passed install, audit, automated suites, API imports, approved audio checks, Firestore Rules Emulator, TypeScript, production build, server startup, and desktop/mobile browser smoke on earlier head `84452fcf45c1e73bbefabd850b7c218aa1d760b5`. The 604 coordinate-map step was skipped. No GitHub workflow run was returned for current head `086d92a522f2d795f4c96f6358342338a6de8e4c`; current exact-head CI is NOT VERIFIED.
- Vercel Preview deployment `dpl_9w8QarojoWq6pCuHoEsfFqGMuGPF` is READY on exact docs head `086d92a522f2d795f4c96f6358342338a6de8e4c`. Production remains READY on exact main SHA.
- Keep Draft until all changed docs, links, status contradictions and history preservation are reviewed. The branch is 365 commits ahead of main; use SQUASH merge only to avoid importing that branch-only history. No merge is claimed.

## Product and engineering blockers

- **CI:** PR #363's gate is inspectable and successful at its exact head. This does not certify other PRs; re-fetch each one's own checks.
- **Ruqyah (#373):** targeted API/view tests and 171-entry fixture are documented as passing on the feature branch; not on main. Require exact-head CI and post-deploy short/medium/long smoke.
- **Engine Plans (#367/#369/#371):** multi-range UI, codec and interim cap are partial independent changes. Codec is not integrated into persistence. Do not migrate until consumers, backup/import/reset, journal/outbox/inbox, startup hydration, rollback, resource bounds and multi-client tests are covered.
- **Offline/PWA (#366/#368, legacy #358/#359):** reconcile as one design. Cross-tab ownership, orphan cleanup, quota recovery, reader playback, restart and device verification remain outstanding.
- **Advisor (#364):** continue server-side validation, untrusted-history boundaries, privacy, rate-limit and authorization review; full security suite remains outstanding.
- **Seerah (#365):** prototype only. Publication requires claim-level sources, rights clearance and editorial review.
- **Production sync:** current Vercel inventory confirms `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` in Production. No values changed. Do not alter either flag or perform sync-related Production actions without explicit owner authorization and complete release evidence.
- **API configuration:** sensitive `ISLAMICAPI_API_KEY` and `GEMINI_API_KEY` entries exist for Preview and Production; values were not read and key validity was not tested. API routes read these server-side. Presence is not proof of successful upstream calls.
- **Firebase:** repository code and applet config expect project `wird-quran-app` with the default Firestore database. The Vercel Firebase project-ID environment entry is encrypted and was not decrypted. Production Rules deployment is NOT VERIFIED; Emulator tests do not prove deployment.
- **External APIs/libraries:** research suitable free/open-source solutions before custom implementation; check license, maintenance, security, privacy, cost, quotas and attribution. Secrets stay server-side. No untrusted provider or AI is a religious-content authority.

## Confirmed changed-path overlaps

- #374 ↔ #363: `docs/engineering/README.md`.
- #359 ↔ #363: `docs/offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md`.
- #2 ↔ #363: `docs/DEVELOPMENT_CHECKPOINT.md`, `docs/engineering/FIRESTORE_SYNC_DESIGN.md`.
- Other active PRs listed above had no changed-path overlap with #363 at this snapshot; re-fetch before action.

## Mandatory documentation and cross-chat contract

Every new session/agent must read `docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md` before work. Documentation is mandatory for every request, including work outside the roadmap, without the owner needing to remind the agent. Replace the leading current-state snapshot during reconciliation; append history only to `docs/engineering/WORK_LOG.md`; preserve and label historical evidence. New sessions must refresh live platform state instead of trusting chat memory or old snapshots.

## New owner-request intake

Any new owner request is eligible for evaluation even if it is outside the existing roadmap. Record its intent, acceptance criteria, affected architecture/data, dependencies, priority, risk and tests in the unified roadmap or a scoped requirement. Reorder work transparently; do not reject a request merely because it was not originally planned. Ask only when a genuinely blocking detail is missing.

## Reconciliation contract for future sessions