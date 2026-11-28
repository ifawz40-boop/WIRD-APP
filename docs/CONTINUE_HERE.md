# WIRD — Continuation Entry Point

**Last reconciled:** 2026-11-28 (Cloud Sync V4 — Real-Time Firestore `onSnapshot` + HLC Tombstone Anti-Resurrection Engine across all 15 domains + Personal Per-Account Cloud Vault: Google Drive `appDataFolder`, Live Linked Cloud File & `WIRD4` Capsule + restoration of `WIRD Next` files accidentally removed in `e2bf963f`)  
**Repository:** `ifawz40-boop/WIRD-APP` · **Primary branch:** `main`  
**Production URL:** https://wird-app.vercel.app/ · **Firebase Project:** `wird-quran-app` (`(default)` Firestore — `firestore.rules` deployed & released 2026-11-27)

> This is the authoritative current snapshot. Older dated snapshots below are historical evidence only. Re-fetch live GitHub/Vercel/Firebase state before merging or deploying.

## Active Checkpoint — Cloud Sync V4 (Additions + Deletions) & Personal Cloud Vault (2026-11-28)

1. **Restored Broken `origin/main` Build (`e2bf963f` Revert) & Hardened Google Sign-In (`api/firebase-init.ts`, `src/services/authService.ts`):**
   - **Root Cause:** Commit `e2bf963f` on `origin/main` accidentally deleted the 32 files added in `2a85d7a5` (including `auxiliaryCloudSyncService.ts`, `auxiliaryDomainsSchema.ts`, `src/fonts.css`, `MushafPaperFlipStage.tsx`, etc.) while leaving imports intact, causing GitHub Actions and Vercel deployment `dpl_141KW1A68QNc2KXCVkKriYYJKLRF` to fail.
   - **Fix:** Reverted `e2bf963f` cleanly on fast-forward history, ported direct Google Identity Services `signInWithCredential` (`src/services/authService.ts`), and made `api/firebase-init.ts` pure Node-ESM safe (`fs.readFileSync` without bare `.json` module import attributes), validated in `scripts/smoke-api-imports.mjs`.
2. **Bidirectional Additions + Deletions Sync via Hybrid Logical Clock Tombstones (`src/services/syncTombstoneRegistry.ts`, `src/services/accountCloudBundleService.ts`, `src/services/auxiliaryDomainsSchema.ts`):**
   - Built UID-scoped `SyncTombstoneLedgerV1` (`wird.sync.tombstones.v1`) tracking causal monotonic `upsertedAtMs` and `deletedAtMs` across all 15 user domains (`plans`, `enginePlans`, `portions`, `weakVerses`, `tests`, `readingKhatmas`, `khatmaPages`, `pageBookmarks`, `ribbons`, `adhkarFavorites`, `adhkarCounts`, `seerahChapters`, `customVideoSeries`, `watchedVideos`, `videoNotes`).
   - Automatic array snapshot diffing in `StorageService` (`savePlans`, `saveEnginePlans`, `saveUnifiedPortions`, `saveWeakVerses` — with atomic rollback protection in `applyJournalTransaction`) plus explicit hooks in `readingKhatmaService.ts` (including fixing last-khatma deletion), `adhkarProgressService.ts`, `seerahBookService.ts`, `videoSeriesService.ts`, `mushafRibbonBookmarksService.ts`, and `QuranMushafReader.tsx`.
   - Built `AccountCloudBundleV4` (`users/{uid}/syncMeta/accountCloudVaultV4`, 100% compatible with deployed `firestore.rules`) with lossless `CompactEnginePlanV4` schedule compression (`< 115 KB` guaranteed) and commutative/idempotent `mergeAccountCloudBundles` preventing resurrection of deleted items while preserving concurrent additions and supporting causal re-add restores.
3. **Real-Time Global Sync, Self-Healing Stuck Queue/Conflict Reconciliation & Instant UI Re-Hydration (`src/services/cloudSyncCoordinator.ts`, `src/services/indexedDbSyncJournal.ts`, `src/services/localSyncOutbox.ts`, `src/components/settings/SettingsView.tsx`, `src/App.tsx`, and views):**
   - Added live Firestore `onSnapshot` subscription on `users/{uid}/syncSystem/remoteReplication` and `onAuthStateChanged` + `notifyStorageScopeChanged` triggers on boot across all tabs.
   - Eliminated stuck/failed outbox, inbox, and conflict operations: woke backoff-delayed outbox items (`resetPendingBackoff`), bounded `AccountCloudBundleV4` strictly `< 120 KB` via `fitBundleForFirestoreVault`, stopped calling aborting `rebasePendingMutation` when `sequence <= cached.localSequence`, deferred oversize (`> 120 KB`) uncompacted `enginePlans`/`syncMeta` mutations to Vault V4 supersession, and added atomic `reconcileVaultConvergedState` + 1-click «حسم العمليات العالقة الآن» (`reconcileStuckOperations`) closing superseded pending mutations, blocked historical inbox events, and open conflicts (marking `status: 'resolved'`, `resolution: 'reconciled'` while preserving snapshot evidence) once `accountCloudVaultV4` is durably confirmed on Firestore.
   - Wired `wird:cloud-sync-applied` listeners across `App.tsx`, `QuranLibraryView`, `QuranMushafReader`, `RevisionCenterView`, `AdhkarView`, `SeerahView`, and `VideoSeriesView`.
4. **Personal Per-Account Cloud Sync Vault (`src/services/personalCloudSyncService.ts`, `src/components/settings/PersonalCloudVaultPanel.tsx`, `src/components/settings/SettingsView.tsx`):**
   - Added 3 user-owned personal cloud sync modes powered by the exact same `AccountCloudBundleV4` CRDT + Tombstone engine (syncing both additions and deletions):
     1. **Google Drive Personal AppData Vault (`drive.appdata`):** Private hidden `appDataFolder` on the user's own Google Drive (`wird-account-vault-v4.json`) with optional auto-sync on local mutations/deletions and zero access to personal Drive files.
     2. **Live Linked Cloud File (`iCloud Drive` / `OneDrive` / `Dropbox` / Universal Smart Merge):** Persistent `FileSystemFileHandle` 1-click bidirectional merge plus universal export/non-destructive merge for mobile browsers.
     3. **Instant Compressed Sync Capsule (`WIRD4Z:...`):** Gzip-compressed base64url peer-to-peer sync code between devices.
5. **Local Verification Executed (2026-11-28):**
   - `npm.cmd run lint` (`tsc --noEmit` + Tanzil validation + 114 Surah split): **PASS** (`0` errors)
   - `npm.cmd run smoke:api-imports` (all 7 API handlers incl. `api/firebase-init.ts` & `api/seerah-tts.ts`): **PASS**
   - `npm.cmd test` (`76` suites incl. `19/19` in `cloudSyncAdditionsAndDeletions.test.ts`): **PASS** (`852 PASSED | 0 FAILED`)
   - `$env:NODE_ENV='production'; npx.cmd vite build`: **PASS** (`2.67s`, `0` chunks > 500 kB)
   - `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
   - Playwright E2E (`e2e/app-shell.spec.ts` + `e2e/settings-ux.spec.ts` on Desktop & Mobile Edge Chromium): **PASS** (`24 passed | 0 failed`)
   - Protected files (`completeQuranData.json`, `quran-simple-1.1.xml`, `tanzilReferenceData.json`, `docs/seerah/MASTER_DIRECTIVE.md`, `firestore.rules`, `bun.lock`): **PASS** (`0` bytes diff)

### Next Step
- Push `main` to `origin/main` (per owner workflow authorization) and verify exact-head GitHub Actions `WIRD Quality Gate` and Vercel Production deployment (`https://wird-app.vercel.app/`).

---

## Prior Checkpoint — Downloads & Cloud Sync Root-Cause Fix (2026-11-27 — Historical)

1. **Offline Quran & Ruqyah Audio Downloads Fixed (`api/quran-audio.ts`, `src/services/offlineQuranAudioLibrary.ts`, `src/components/settings/SettingsView.tsx`):**
   - **Root Cause:** `cdn.islamic.network` omits `Access-Control-Allow-Origin`, causing `fetch(..., { mode: 'cors' })` to fail 100% of the time in real browsers (`ar.ahmedajamy` also returns `application/octet-stream`).
   - **Fix:** Added strictly allowlisted same-origin proxy `GET /api/quran-audio?type=ayah&reciter=<approvedId>&ayah=<1..6236>` (immutable Edge CDN cache `s-maxage=31536000`, `Content-Type: audio/mpeg`, 8 MB bound, 15s timeout), transparent CORS-fallback in `OfflineQuranAudioLibrary` with zero mock-test regression, and visible `job.lastError` diagnostics in `SettingsView`.
2. **Full-App Offline Package & 604p Mushaf Download Hardened (`src/services/offlinePreparationService.ts`, `public/sw.js`, `src/services/mushafFacsimileService.ts`):**
   - **Root Cause:** `prepareWirdForOffline` and `getWirdOfflinePackageStatus` threw on first visit/hard refresh when `navigator.serviceWorker.controller` was `null` even though `registration.active` was ready; `downloadFullMushafForOffline` had no per-page retry across 604 SVGs.
   - **Fix:** Fall back to `registration.active` when `controller` is `null`; upgraded `fetchOfflineAssetWithRetry` (`public/sw.js`) and `downloadFullMushafForOffline` (`mushafFacsimileService.ts`) to 3-attempt retries with backoff.
3. **Cloud Sync Deadlock Fixed & `firestore.rules` Deployed (`src/services/cloudSyncCoordinator.ts`, Firebase `wird-quran-app`):**
   - **Root Cause 1:** `triggerSync()` flushed `syncMeta/auxiliaryDomainsV1` (`baseRevision: 0`) BEFORE pulling remote events, causing a permanent `REMOTE_REVISION_CONFLICT` + `blocked_pending_local` deadlock on any second device or fresh sign-in. Fixed by pulling remote state first when the local outbox is empty.
   - **Root Cause 2:** Repository `firestore.rules` had not been released to Production `wird-quran-app`. Deployed & verified compiled/released via `firebase deploy --only firestore:rules --project wird-quran-app` (authorized by owner).
4. **Same-Origin Google Sign-In (`src/lib/firebase.ts`, `vercel.json`, `public/sw.js`, `src/context/AuthContext.tsx`, `src/services/authService.ts`):**
   - Verified owner added `https://wird-app.vercel.app` & `https://wird-app.vercel.app/__/auth/handler` in Google Cloud Console OAuth 2.0 Web Client (`accounts.google.com/v3/signin/identifier` accepted with zero `redirect_uri_mismatch`).
   - Enabled same-origin `authDomain: 'wird-app.vercel.app'` on Production in `src/lib/firebase.ts` alongside `vercel.json` `/__/auth/:path*` proxy & `Cross-Origin-Opener-Policy: same-origin-allow-popups`, eliminating cross-site third-party storage partitioning failures on mobile/PWA/Chrome/Safari.
5. **Firebase SQL Connect (Data Connect) Setup, Repository & Live Emulator Verification (`.firebaserc`, `firebase.json`, `dataconnect/`, `src/lib/dataconnect/`, `src/lib/sqlConnectClient.ts`, `src/services/sqlConnectRepository.ts`, `src/tests/dataConnectSetup.test.ts`, `scripts/dataconnectEmulator.test.ts`):**
   - Linked local repository to canonical Firebase project `wird-quran-app` via `.firebaserc` and added `dataconnect` config + `auth` (`9099`) and `dataconnect` (`9399`) emulators to `firebase.json` (preserving `firestore.rules` untouched).
   - Authored normalized PostgreSQL relational schema (`dataconnect/schema/schema.gql` — `User`, `MemorizationPlan`, `MemorizationPortion`, `RevisionLog`, `WeakVerse`, `DailyActivityLog`, `AssessmentResult`; coordinates only, respecting the local Tanzil Quran text boundary), 18 `@auth(level: USER_EMAIL_VERIFIED)` queries/mutations scoped strictly to `auth.uid` (including transactional `RecordRevisionReview` and `AssignPortionToPlan`), and local-only `dataconnect/seed_data.gql`.
   - Built domain-typed `src/services/sqlConnectRepository.ts` (with `ExecuteQueryOptions` `fetchPolicy` forwarding and omitted optional query variables) and verified live against Firebase Auth + SQL Connect PostgreSQL emulators via `scripts/dataconnectEmulator.test.ts` (`7 PASSED | 0 FAILED`: unauthenticated/unverified denial, profile/plan/portion CRUD, atomic `RecordRevisionReview` `@transaction`, coordinate-only weak verse upsert/resolve, idempotent daily activity upsert, and cross-user isolation).
   - Verified `dataconnect:compile`, `dataconnect:sdk:generate` (zero changes to `package.json`/`bun.lock`), `tsc --noEmit`, `npm.cmd test` (`840 PASSED | 0 FAILED`), `vite build` (`3.26s`, `0` chunks > 500 kB), and `smoke:api-imports`. Production Cloud SQL deployment remains unexecuted pending explicit owner authorization (`docs/OWNER_ACTIONS.md`).

---

## Prior Checkpoint — Master App Overhaul (2026-11-26 — Historical / Merged into `main`)

Full phased plan and execution log: [`docs/MASTER_APP_OVERHAUL.md`](./MASTER_APP_OVERHAUL.md).

1. **Phase 1 — Quranic & Editorial Typography + Circle-Glyph Elimination (`37af33d0`):**
   - Diagnosed the mid-ayah black-ball/dotted-circle (`●◌`) artifact as a QPC-font mismatch (`UthmanicHafs1Ver18` lacks Tanzil `U+06DF` and combining pause marks). Switched `.font-quran` to `'Amiri Quran', 'Scheherazade New', 'Amiri', serif`, passed canonical coordinates to `QuranText`, and replaced `' ۞ '` separators with clean ayah brackets `﴿رقم﴾` without touching a single character of `completeQuranData.json` or `quran-simple-1.1.xml`.
2. **Phase 2 — Minimalist Geometric Brand, PWA Icons & ZERO AI Look (`bde6aaa8`):**
   - Replaced the legacy emblem with a clean minimalist geometric SVG logo across `WirdLogo.tsx`, `WirdAvatar.tsx`, `WirdPattern.tsx`, `favicon.svg`, `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png`. Refined warm paper light mode (`#FAF6EE`) & restful deep dark mode (`#06120E`), eliminated card-in-card nesting, and removed all emojis from production `src/` (`0` hits verified).
3. **Phase 3 — Written & Audio Ruqyah Shar'iyyah Rebuild (`d99ab6be`):**
   - Separated Written Ruqyah cleanly into **القرآن الكريم** and **السنة النبوية الصحيحة** with sources/takhrij, repetition counters, and progress tracking. Added `MediaSession` lock-screen/background playback controls, ±10s seek, mute toggle, floating mini-player, and full offline audio session/category download via `offlineQuranAudioLibrary.ts` (`'ruqyah'` scope + reconnect auto-resume).
4. **Phase 4 — Gemini 2.5 Flash AI Assistant Upgrade (`871b74dd`):**
   - Connected `api/advisor.ts` and `server.ts` to **`gemini-2.5-flash`** (with `'gemini-2.0-flash'` and deterministic offline fallback; zero client-exposed keys), added deep Arabic intent classification (`classifyAdvisorIntent` / `detectAdvisorQueryIntent`), user-progress context, and UID-scoped persistent chat history (`wird.advisor.chat.v1` in `AUXILIARY_SCOPED_KEYS`).
5. **Phase 5 — Internal Runtime & 100% Offline-First Engine (`577a7fe7`):**
   - Created `src/services/runtimeCoordinator.ts` (hover/focus + idle route chunk prefetching, background Surah cache RAM trimming via `trimLoadedQuranCaches`, reconnect auto-resume for offline packages & audio downloads). Added exponential backoff retry in `cloudSyncCoordinator.ts`, included all `43` Seerah JSON files + PWA icons in `wird-precache-manifest.json` (`311` assets via `vite.config.ts`), and upgraded `public/sw.js` to 4-worker parallel resumable full-offline downloads.
6. **Phase 6 — Full Verification & E2E Stabilization (2026-11-26):**
   - **Untouched:** `docs/seerah/MASTER_DIRECTIVE.md` (LF SHA-256 `7a1e25cf...1472`), Quran corpus (`completeQuranData.json`, `quran-simple-1.1.xml`, `tanzilReferenceData.json`), `firestore.rules`, `bun.lock`, Vercel env vars, and Production sync flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`).
   - `npm.cmd run lint` (`tsc --noEmit` + Tanzil validation): **PASS** (`0` errors)
   - `node scripts/verify_seerah_content.mjs`: **PASS**
   - `npm.cmd run smoke:api-imports`: **PASS**
   - `npm.cmd test` (74 suites): **PASS** (`816 PASSED | 0 FAILED`)
   - `NODE_ENV=production vite build`: **PASS** (`3.07s`, `allAssets: 311` incl. `43` Seerah JSON files, `0` chunks > 500 kB)
   - `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
   - Production `src/` emoji scan: **PASS** (`0` hits)
   - Playwright E2E on Edge Chromium Desktop (`1440×900`) & Mobile (`390×844`) across `app-shell`, `dashboard-ux`, `ruqyah-ux`, `ruqyah-audio`, `advisor-ux`, `seerah-book`, `settings-ux`: **PASS** (`50 passed | 0 failed`)
   - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub Actions CI).

### Next Step
- Merge `feat/master-app-overhaul-20261126` into `main`, push to `origin/main` (per explicit owner authorization «كمل وارفع على جيت هب main و انشر على فيرسل»), and verify GitHub Actions CI + Vercel Production deployment status on the exact pushed SHA.

---

## Prior Checkpoint — Complete Prophetic Seerah Digital Book & Character Storytelling (2026-11-25 — Historical / Merged into `main`)

1. **Authoritative Directive & Durable Research Repository (`docs/seerah/MASTER_DIRECTIVE.md` [unmodified, SHA-256 `7a1e25cf...1472`], `docs/seerah/EXECUTION_STATUS.md`, `research/`):**
   - **Phase 1:** Processed 100% of all 4 volumes of Imam Ibn Kathir's *Al-Sīra al-Nabawiyya* (`2,566 / 2,566` PDF pages tracked in `research/processing_checkpoints.json`: `2,475` verified matn pages + `91` classified non-matn apparatus pages), producing `source_manifest.json`, `90` major events + `120` sub-events, `32` personalities, `26` places, `22` classical sources, `50/50` verbatim Quranic passages (vs `src/data/completeQuranData.json`), `43/43` verbatim Hadiths (`100%` verified substrings inside Ibn Kathir), and `18` historical disputes.
   - **Phase 2:** Built `research/chronology/seerah_book_blueprint.json` (**6 Historical Eras → 12 Main Sections → 40 Chronological Chapters → 120 Narrative Scenes**) and `research/characters/character_journeys_blueprint.json` (**32 Personalities** bidirectionally linked).
2. **Complete Third-Person Arabic Narrative, Character Stories & 3-Pass Verification (`research/authored_chapters/`, `research/authored_characters/`, `public/data/seerah/`):**
   - **Phases 3–4:** Authored all **`40 / 40` chronological chapters (`53,280` words)** and all **`32 / 32` independent continuous character stories (`26,400` words)** = **`79,680` Arabic words** in fluent, accessible third-person narrative without fabricated dialogue/monologues.
   - **Phase 5:** Passed every chapter and character story through independent **Review A** (Historical Accuracy), **Review B** (Arabic Literary Quality), and **Review C** (Deterministic byte-for-byte Quran & Hadith verification via `scripts/phase5_quotation_verify_and_publish.py`: `52` Quran blocks + `43` Hadith blocks verified, `0` unverified `﴿ ﴾` in prose), transitioning all items to `Published` and emitting lazy-loaded static JSON under `public/data/seerah/`.
3. **Calm Digital Book UI, UID-Scoped Progress & Legacy Seerah Removal (`src/components/seerah/`, `src/services/seerahBookService.ts`, `src/services/storageService.ts`, `src/services/router.ts`, `public/sw.js`):**
   - Replaced `SeerahView.tsx` with `SeerahBookLanding.tsx`, `SeerahChapterReader.tsx`, and `SeerahCharacterViews.tsx` (`SeerahCharacterDirectory` + `SeerahCharacterProfile`) using pure `--wird-*` semantic CSS tokens (`0` legacy hexes) and hash deep-links (`#/seerah?chapter=`, `#/seerah?character=`, `#/seerah?view=characters`).
   - Registered `'wird.seerah.v2'` in `AUXILIARY_SCOPED_KEYS` for Guest & isolated Authenticated UID progress (mark/unmark read, last reading position, 4 font sizes), updated `public/sw.js` for Cache-First `/data/seerah/*.json`, and cleanly removed obsolete Seerah files (`seerahData.ts`, `seerahProgressService.ts`, `seerahEncyclopediaService.ts`, `SeerahEncyclopediaReader.tsx`, `public/data/seerah-encyclopedia/`, legacy tests) with `0` dangling references.
4. **Preserved Integrity & Local Verification Executed (2026-11-25):**
   - **Untouched:** `docs/seerah/MASTER_DIRECTIVE.md`, Quran corpus (`completeQuranData.json`, `src/data/sources/`), `firestore.rules`, `bun.lock`, Vercel env vars, and experimental sync flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`).
   - `node scripts/verify_seerah_content.mjs`: **PASS** (`6` eras, `12` sections, `40` chapters, `32` characters, `52` Quran + `43` Hadith verbatim quotes, 100% bidirectional links)
   - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
   - `npm.cmd test` (74 suites incl. `src/tests/seerahBookSystem.test.ts` + `designSystemV2.test.ts` + Tanzil validation): **PASS** (`814 PASSED | 0 FAILED`)
   - `npm.cmd run smoke:api-imports`: **PASS**
   - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.92s`, `SeerahView` `49.26 kB` / `10.39 kB` gzip, `index` `246.39 kB`, `0` chunks > 500 kB)
   - `node scripts/smoke-server.mjs`: **PASS** (production + dev Express servers)
   - Playwright E2E (`e2e/seerah-book.spec.ts` on Edge Chromium Desktop `1440×900` + Mobile `390×844`): **PASS** (`4 passed | 0 failed`, `22.4s`, `0` page errors, `0` horizontal overflow)
   - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub Actions CI).
   - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** (branch stays local pending explicit owner push/PR authorization).

### Next Step
- Upon explicit owner authorization, push `feat/seerah-encyclopedia-ibn-kathir` to a GitHub Pull Request, inspect exact-head GitHub Actions `WIRD Quality Gate` (including Java Firestore Rules Emulator and full Playwright suite) and Vercel Preview, and confirm remaining owner items in `docs/OWNER_ACTIONS.md` before any merge to `main`.

---

## Prior Checkpoint — Full 4-Volume Ibn Kathir Prophetic Seerah Encyclopedia (2026-11-24 — Historical / Superseded by 2026-11-25 Complete Digital Book Transformation)

1. **Authoritative Directive & Live Execution Record (`docs/seerah/MASTER_DIRECTIVE.md`, `docs/seerah/EXECUTION_STATUS.md`):**
   - Inspected all 4 owner-supplied PDFs in gitignored `seerah-sources/` (`01_10169_compressed.pdf`..`04_10172_compressed.pdf`, 2,566 scanned pages with `0` embedded text characters) and benchmarked local Windows `ar-SA` OCR (rejected due to garbled religious text).
   - Applied `AGENTS.md` Open-Source-First policy: verified page-for-page alignment against **OpenITI** (`0774IbnKathir.Bidaya.Shamela0000930-ara6`, WorldCat `oclc/235980396`), strictly excluding the modern 1964 editor preface (`تقديم مصطفى عبد الواحد`) and retaining only Imam Ibn Kathir's authentic public-domain classical matn starting at `ذكر أخبار العرب` (Vol 1 p. 1), with explicit attribution and CC BY-NC-SA 4.0 non-commercial notice recorded in `docs/OWNER_ACTIONS.md` and `docs/engineering/OPEN_SOURCE_RESEARCH.md`.
2. **Offline-First Chunked Encyclopedia Corpus & Validator (`scripts/build-seerah-encyclopedia.py`, `scripts/validate-seerah-encyclopedia.mjs`, `public/data/seerah-encyclopedia/`):**
   - Generated 4 volumes (`2,475` printed pages, `567,856` words), `90` chronological sections (`toc.json`), `101` lazy reading chunks (`chunks/vol-*-chunk-*.json`, total `5.02 MB`, max `57.5 KB`/chunk), `4` Arabic-normalized full-text search indexes (`search/vol-*-search.json`, total `5.94 MB`), and `manifest.json` with `16` verified deep-links from WIRD's curated 16-chapter narrative (`src/data/seerahData.ts`).
   - Added pure-Node CI validator `scripts/validate-seerah-encyclopedia.mjs` verifying all 4 volumes, 2,475 pages, 90 sections, 101 chunks, 4 search indexes, 16 curated chapter links, and exclusion of the 1964 modern preface.
3. **Encyclopedia Service, UID Isolation & Service Worker Caching (`src/services/seerahEncyclopediaService.ts`, `src/services/storageService.ts`, `public/sw.js`):**
   - Registered `'wird.seerah.encyclopedia.v1'` in `AUXILIARY_SCOPED_KEYS` for per-UID isolation, guest-to-account migration, and clean reset.
   - Built lazy chunk/search loaders, diacritic-insensitive Arabic search (`normalizeArabicSearchQuery`, `searchSeerahEncyclopedia`), direct printed-page jumper (`findChunkIdForVolumePage`, `findSectionForVolumePage`), optional per-volume Cache API offline download (`cacheSeerahVolumeOffline`), and UID-scoped reading position, read sections, bookmarks with personal notes, font size, and focus mode.
   - Wired Cache-First caching for `/data/seerah-encyclopedia/*.json` under `wird-app-content-v1` in `public/sw.js` without bloating `wird-precache-manifest.json`.
4. **Upgraded Seerah Reader & Unified Bookmarks UI (`src/components/seerah/SeerahEncyclopediaReader.tsx`, `src/components/seerah/SeerahView.tsx`):**
   - Added 4-volume selector ribbon with per-volume progress, collapsible volume TOC with instant title filter, full-text search across all 2,475 pages, direct printed-page jump (`ج X · ص Y`), 4 font sizes + focus mode, poetry/Basmalah editorial formatting, per-page bookmarks + personal study notes, 1-click offline volume caching, deep-links from all 16 curated chapters into Ibn Kathir's Encyclopedia, and unified Bookmarks tab using pure `--wird-*` semantic CSS tokens (zero legacy hex leaks).
5. **Preserved Integrity & Local Verification Executed (2026-11-24):**
   - **Untouched:** Quran corpus (`completeQuranData.json`, `src/data/sources/`), `firestore.rules`, `bun.lock`, Vercel env vars, and experimental sync flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`).
   - `node scripts/validate-seerah-encyclopedia.mjs`: **PASS** (`4` volumes, `2,475` pages, `90` sections, `101` chunks, `4` search indexes, `16` curated links)
   - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
   - `npm.cmd test` (75 suites incl. new `src/tests/seerahEncyclopedia.test.ts` + `seerahSystem.test.ts` + `designSystemV2.test.ts`): **PASS** (`822 PASSED | 0 FAILED`)
   - `npm.cmd run smoke:api-imports`: **PASS**
   - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.82s`, `index` `245.92 kB`, `SeerahView` `162.65 kB` / `38.21 kB` gzip, 0 chunks > 500 kB)
   - `node scripts/smoke-server.mjs`: **PASS** (production + dev Express servers)
   - Playwright E2E (`e2e/seerah-encyclopedia.spec.ts` on Edge Chromium Desktop `1440×900` + Mobile `390×844`): **PASS** (`4 passed | 0 failed`, `35.6s`, zero `pageerror`, zero `overflowX`)
   - Legacy hex scan across `src/components/seerah/*.tsx`: **PASS** (`0` matches)
   - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; runs in GitHub Actions CI).
   - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** (branch stays local pending explicit owner push/PR authorization).

### Next Step
- Push `feat/seerah-encyclopedia-ibn-kathir` to a GitHub Pull Request upon owner authorization, inspect exact-head GitHub Actions `WIRD Quality Gate` (including Java Firestore Rules Emulator and full Playwright suite) and Vercel Preview, and confirm CC BY-NC-SA 4.0 non-commercial terms (`docs/OWNER_ACTIONS.md`) before any merge to `main`.

---

## Prior Checkpoint — Extensible Video Series Platform & Daily Suggestion (2026-11-23 — Historical)

1. **Extensible Multi-Series Catalog (`src/data/videoSeriesCatalog.ts`):**
   - Built a modular multi-series schema (`VideoSeriesDefinition`, `VideoLessonItem`, `VideoSeriesCategory`) seeded with the owner-requested YouTube playlist **`سلسلة بناء النفس المطمئنة` — م. علاء حامد** (`PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5`), containing all **13 verified episodes** in exact playlist order with validated YouTube IDs, Arabic titles, topics, descriptions, and real durations (`16 ساعة و 15 دقيقة` total).
   - Added strict YouTube URL/ID validators (`isValidYouTubeVideoId`, `isValidYouTubePlaylistId`, `extractYouTubePlaylistId`) and privacy-enhanced embed helpers (`https://www.youtube-nocookie.com/embed/...`) that reject unsafe schemes, non-YouTube domains, and malformed IDs.
2. **UID-Scoped Progress, Daily Suggestion Engine & Multi-Series Store (`src/services/videoSeriesService.ts`, `src/services/storageService.ts`):**
   - Registered `'wird.video.series.v1'` in `AUXILIARY_SCOPED_KEYS` for automatic per-UID storage isolation, guest-to-account legacy import migration, and clean reset.
   - Implemented deterministic daily lesson recommendation (`getDailySuggestedLesson`) that pins the next unwatched lesson for the current local day, advances across days or after manual completion/skip (`advanceDailySuggestedLesson`), tracks per-lesson watch states (`unwatched` | `in_progress` | `completed`), stores personal lesson reflections (`videoNotes`), and supports registering/selecting/removing additional custom series and changing the featured Dashboard series (`setFeaturedSeries`).
3. **Read-Only SSRF-Safe YouTube Playlist Resolver (`api/youtube-playlist.ts`, `server.ts`, `scripts/smoke-api-imports.mjs`):**
   - Added `/api/youtube-playlist?list=<playlistId>` mounted in `server.ts` and validated in `scripts/smoke-api-imports.mjs`. Strictly validates `^[A-Za-z0-9_-]{10,64}$`, connects only to hardcoded `https://www.youtube.com` endpoints with timeouts and rate limiting, and returns HTTP `400` for invalid inputs.
4. **Dashboard Daily Suggestion Card & Full Multi-Series Workspace (`src/components/series/DailyVideoSuggestionCard.tsx`, `src/components/series/VideoSeriesView.tsx`, `src/components/dashboard/DashboardView.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`):**
   - Integrated `DailyVideoSuggestionCard` (`#dashboard-daily-series`) onto the Dashboard with 16:9 thumbnail / inline `youtube-nocookie` player, one-click completion toggle (`تحديد كمكتمل`), next-lesson skip (`الدرس التالي`), progress bar, and direct deep-link (`#/series?series=<id>&video=<videoId>`) to the full series.
   - Built lazy-loaded `VideoSeriesView` (`#/series`) featuring multi-series shelf switching, full 13-episode searchable/filterable checklist (`الكل` / `لم يُشاهد` / `قيد المشاهدة` / `مكتمل`), inline player with prev/next lesson navigation, per-lesson personal notes, featured-on-dashboard toggle, and an «إضافة سلسلة جديدة» sheet to import any public YouTube playlist (via `/api/youtube-playlist` or manual entry).
   - Added `السلاسل المرئية` (`series`) to `Sidebar.tsx` (in `العبادة والمعرفة` above `الإعدادات`, preserving `Settings` as the final focusable item), `Header.tsx`, and `DashboardView.tsx` quick actions using pure WIRD semantic CSS tokens (zero legacy hex leaks).
5. **Preserved Integrity & Verification Executed (2026-11-23):**
   - **Untouched:** Quran corpus (`completeQuranData.json`, `src/data/sources/`), Hadith/Tafsir/Seerah/Adhkar/Ruqyah data, Firebase Auth & `firestore.rules`, Vercel env vars, and experimental sync flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`).
   - `npm test` (74 suites incl. new `src/tests/videoSeriesSystem.test.ts` + Tanzil validation + 114 Surah chunk split): **PASS** (`812 PASSED | 0 FAILED`)
   - `npm run smoke:api-imports` (incl. `api/youtube-playlist.ts`): **PASS**
   - Live API check on `http://127.0.0.1:3000/api/youtube-playlist`: **PASS** (HTTP `200`, `13` videos for valid playlist; HTTP `400` for `../evil`)
   - `lint_applet` (`tsc --noEmit`) & `compile_applet` (Vite production build): **PASS**
   - Legacy hex scan across `src/components/series`: **PASS** (`NO_LEGACY_HEX_FOUND`)
   - Headless Chromium visual & interaction verification (`1440x900` desktop Light/Dark + `390x844` mobile Dark on `http://127.0.0.1:3000`): **PASS** (`#dashboard-daily-series` visible, deep-link `#/series?series=bina-al-nafs-al-mutmainnah&video=HVNcSAD8xKs`, «إضافة سلسلة جديدة» sheet verified, `OVERFLOW_X: false`, `CONSOLE_ERRORS: []`, `PAGE_ERRORS: []`)
   - `npm run test:firestore-rules`: **BLOCKED** locally (`java` not installed in container).
   - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** from this workspace.

### Next Step
- Sync verified AI Studio workspace changes onto a clean GitHub feature branch (`WIRD-APP`) and execute the full exact-head GitHub Actions Quality Gate (including Java Firestore Rules Emulator and Playwright E2E) plus Preview review before any authorized merge.

---

## Prior Checkpoint — Four-Variant Design Integration (2026-11-22)

1. **Centralized 2×2 Preference Engine (`src/services/themePreferences.ts`, `src/main.tsx`):**
   - Implemented two independent user preferences — **`design`: `'design-a' | 'design-b'`** (`التصميم A — الأندلسي التراثي` default, `التصميم B — العصري الهادئ`) and **`appearanceMode`: `'light' | 'dark'`** (`light` default) — producing **4 switchable combinations** (`schemaVersion: 3`, local keys `wird:ui-theme-prefs:v2` and `wird:ui-appearance-mode:v1`) without page reloads or cross-resetting.
   - Added lossless migration (`mapLegacyPresetToDesign`) from prior preset IDs (`emerald-editorial` / `mushaf-parchment` → `design-a`; `classic-midnight` → `design-b`), `getActiveVariantSummary()`, instant DOM attribute application (`data-wird-design`, `data-wird-theme`, `data-wird-mode`, `.dark`, `meta[name="theme-color"]`), and full `resetThemePreferences()` to `design-a` + `light`.
   - Wired authentic local reference preview PNGs and emblems under `/public/assets/aistudio/` (`screen__10__7bd02a79.png`, `screen__28__8cd915c9.png`, `screen__40__0ba4301f.png`, `screen__42__2f2353c4.png`, and emblems `screen__67__f2b24ad2.png`–`screen__70__6ddee078.png`).
2. **4-Variant Semantic CSS Token Cascade (`src/wird-identity.css`):**
   - Added explicit high-specificity rules (`:root[data-wird-design='design-a']`, `:root.dark[data-wird-design='design-a']`, `:root[data-wird-design='design-b']`, `:root.dark[data-wird-design='design-b']`) covering backgrounds, surfaces, muted panels, primary/accent inks, hairlines, `--wird-sidebar-bg`, `--wird-mushaf-paper`, and ambient shell gradients (`#FFF9EC`/`#041610` for Design A Light/Dark; `#F9FBFA`/`#08121E` for Design B Light/Dark).
3. **Reference-Backed Appearance Selector & Unified Collapsible Navigation (`src/components/ui/AppearanceSelectorPanel.tsx`, `src/components/ui/ThemeCustomizerSheet.tsx`, `src/components/settings/SettingsView.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/auth/AuthScreen.tsx`, `src/components/brand/BrandDesignShowcase.tsx`, `src/App.tsx`):**
   - Built `AppearanceSelectorPanel` (`layout="sheet" | "settings"`) with active combination summary banner, Light/Dark selector, Design A/B selector with authentic preview cards + color swatches, 4-tile live variant gallery (in `SettingsView`), density/corner controls, and Restore Defaults.
   - Exposed the selector inside both **`SettingsView` (`#settings-appearance-section`)** and **`ThemeCustomizerSheet`** (header trigger showing active `A`/`B` design badge), kept the unified collapsible right sidebar (`Ctrl+B`/`Cmd+B`) across both Design A & B, and added a compact A/B + Light/Dark quick switcher in `AuthScreen.tsx`.
4. **Global Semantic Token & Dark-Mode Contrast Harmonization (`18+` shared/feature components + `DashboardView.tsx` + `src/tests/designSystemV2.test.ts`):**
   - Eliminated legacy hardcoded palette hexes (`#0B132B`, `#111F36`, `#1C4E46`, `#1E4A47`, `#0E192D`, `#152642`, `#162744`) across views/shared primitives (`grep` confirms zero leaks outside intentional `src/components/brand/`, `QuranMushafFacsimilePage.tsx`, and `QuranTypographyLab.tsx`).
   - Fixed dark-mode text/icon contrast across 15 components by pairing `text-[var(--wird-primary)]` with `dark:text-[var(--wird-accent)]`.
   - Tightened `DashboardView.tsx` welcome hero padding for compact above-the-fold layout and updated `src/tests/designSystemV2.test.ts` for all 4 design × appearance contracts.
5. **Preserved Integrity & Verification Executed (2026-11-22):**
   - **Untouched:** Quran corpus (`completeQuranData.json`, `src/data/sources/`), Hadith/Tafsir/Seerah/Ruqyah data, Firebase Auth & `firestore.rules`, Vercel env vars, and experimental sync flags (`VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`).
   - `npm test` (73 suites incl. `designSystemV2.test.ts` + Tanzil validation + 114 Surah chunk split): **PASS** (`806 PASSED | 0 FAILED`)
   - `npm run smoke:api-imports`: **PASS**
   - `lint_applet` (`tsc --noEmit`) & `compile_applet` (Vite production build): verified in final build check.
   - Headless Chromium visual verification (desktop `1440x900` + mobile `390x844` via `playwright` on port `3000`): **PASS** — verified exact computed RGB backgrounds across all 4 combinations (`rgb(255, 249, 236)`, `rgb(4, 22, 16)`, `rgb(249, 251, 250)`, `rgb(8, 18, 30)`), zero horizontal overflow (`overflow: false`), `0` console/page errors, and crisp dark-mode text contrast in both `Design A Dark` and `Design B Dark`.
   - `npm run test:firestore-rules`: **BLOCKED** locally (`java` not installed in container).
   - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** from this workspace.

---

## Prior Checkpoint — Full Platform Transformation (2026-11-20)

The owner authorized a full phased platform transformation covering visual identity & design system, unified architecture, Quran/memorization/revision excellence, Adhkar & Duas with audio, a complete chronological sourced Prophetic Seerah experience, offline-first hardening, and bidirectional multi-device synchronization including safe tombstones/deletions.

### Completed in this checkpoint — Stage A + Phases 1 through 8 (100% of Local Master Transformation)
1. **Full Repository & API Audit Completed:** Mapped all 41 components, 80+ service/test modules, 5 API handlers (`/api/advisor`, `/api/tafsir`, `/api/ruqyah`, `/api/quran-audio`, `/api/hadith-references`), `firestore.rules`, `public/sw.js`, `vite.config.ts`, and external providers (`Quran Foundation API v4`, `AlAdhan API`, `OpenDua / Seen-Arabic / rn0x Adhkar`, `Sunnah.com API`, `Ihsan Seerah API`, `SeerahBook`, `Dorar`).
2. **Phase 1 Code Fixes Implemented:**
   - `index.html` & `public/manifest.json`: Aligned `theme-color` (`#1C4E46`) and body background/text colors with `wird-identity.css` tokens to eliminate initial-paint palette mismatch; strengthened `src/tests/pwaIntegration.test.ts` to enforce `index.html` ↔ `manifest.json` `theme_color` parity.
   - `src/components/dashboard/DashboardView.tsx`: Removed duplicate Multi-Khatma section above the Welcome Banner.
   - `src/components/library/QuranLibraryView.tsx` & `src/components/library/ReadingKhatmaPanel.tsx`: Restored Hero Quran Header Banner + Search Bar to top hierarchy above `ReadingKhatmaPanel`; added **By Juz** (`QURAN_JUZ_STARTS`) and **By Surah** (`QURAN_PAGE_INDEX`) scope selectors to multi-khatma creation; wired inline `onQuickStartReadingKhatma` into `QuranMushafReader`.
   - `src/components/library/QuranMushafReader.tsx`: Derived `isTwoPageSpreadActive` reactively from `printedSpreadContext.isTwoPage` so single/double spread toggles immediately update Prev/Next & touch-swipe stepping; filtered spread/batch Undo (`تراجع`) so previously completed pages are never accidentally unmarked; added inline `بدء ختمة قراءة الآن` CTA when no active khatma exists.
   - `src/components/library/PrintedMushafSpread.tsx` & `src/components/session/MemorizationSessionView.tsx` & `src/index.css`: Decoupled `onTafsirAyahChange` from mutating `currentAyahIndex` in Printed Mushaf session mode; preserved active memorization highlight when `autoOpenTafsirOnSelect` is false; added light/dark CSS contrast rules for `[data-session-ayah='true']`; persisted `confirmFinalSegmentMastery` synchronously via `saveCumulativeSessionProgress` before `finalizeSessionCompletion()`; scoped `awaitingFinalConfirm` reset cleanly to `currentAyahIndex`.
   - `server.ts` & `src/services/authService.ts`: Switched `/api/advisor/chat` to `ai.models.generateContent` with bounded history context; removed `auth/popup-closed-by-user` and `auth/cancelled-popup-request` from `signInWithRedirect` fallback so voluntary popup closes stay cleanly in-app.
   - `src/tests/sessionStudyUi.test.ts`: Added Phase 1 regression assertions covering all core fixes above.
3. **Phase 2 Visual Identity, Scalable Vector Emblem, Semantic Design Tokens & Navigation Implemented:**
   - `public/favicon.svg`, `src/components/brand/WirdLogo.tsx`, `src/components/brand/WirdAvatar.tsx`: Replaced the embedded raster JPEG wrapper with a pure, self-contained **Scalable Vector SVG Emblem (`WirdVectorEmblemSvg`)** featuring an 8-pointed Rub el Hizb (Khatam) geometric frame, Mihrab arch with crescent finial, and an illuminated open Mushaf on a traditional Rihal stand across 6 semantic variants (`primary`, `light`, `dark`, `gold`, `monochrome`, `simplified`), while retaining `OFFICIAL_BRAND_EMBLEM_URL` for optional `renderMode="raster"` compatibility.
   - `src/components/brand/WirdPattern.tsx`: Added `WirdMihrabArch` architectural vector illustration (Mihrab arch, suspended Mishkat lamp, and open Mushaf on Rihal) for hero headers and empty states.
   - `src/wird-identity.css`: Expanded semantic design tokens (`--wird-hero-gradient`, `--wird-accent-soft`, `--wird-ring`, `--wird-header-glass`), improved dark-mode muted text contrast (`#98adaa`), and added `.wird-hero-surface`, `.wird-section-badge`, `.wird-nav-indicator`, and `.wird-view-enter` (with `prefers-reduced-motion` guard).
   - `src/components/layout/Sidebar.tsx` & `src/components/layout/Header.tsx`: Added `المستشار القرآني` (`id: 'advisor'`) inside the `'المتابعة والمساندة'` group right before `'الإعدادات'` (preserving `'الإعدادات'` as the final focusable sidebar item for the mobile drawer `Shift+Tab` focus-trap contract), applied the RTL gold active indicator (`.wird-nav-indicator`), and added contextual section subtitles in `Header.tsx`.
   - `src/components/brand/BrandDesignShowcase.tsx` & `src/tests/pwaIntegration.test.ts`: Added the Vector Emblem & Architectural Mihrab gallery to the design showcase and added Phase 2 automated assertions to `pwaIntegration.test.ts`.
4. **Phase 3 Unified Data Architecture, Offline Audio in Mushaf/Library, UID-Scoped Khatmas/Bookmarks & Canonical Weak-Verse Verification Implemented:**
   - `src/services/storageService.ts` & `src/services/readingKhatmaService.ts`: Added `AUXILIARY_SCOPED_KEYS` (`wird.reading.khatma.v1`, `wird.reading.khatmas.v2`, `wird.quran.pageBookmarks.v1`, `wird.quran.lastPage.v1`, `wird.quran.lastReadingPosition.v1`) and `StorageService.resolveScopedKey(key)` so Reading Khatmas, Mushaf Bookmarks, and Last Reading Positions are isolated per authenticated UID (`user:<uid>`) and losslessly migrated on first-account `'import'`, while remaining backward-compatible with unscoped keys in `'legacy'` / `'guest'` mode.
   - `src/components/library/QuranMushafReader.tsx` & `src/components/library/QuranLibraryView.tsx`: Wired `offlineQuranAudioLibrary.resolvePlaybackSource(approvedReciterId, globalAyah, fallbackUrl)` into Mushaf page/segment playback and Library ayah/segment playback with automatic `ObjectURL` revocation and sequence race guards, and passed licensed `cdn.islamic.network` URLs (`getLicensedAyahAudioUrl`) to `requestOfflineAudioCache`.
   - `src/components/revision/RevisionCenterView.tsx`: Prioritized verified local Quran corpus text (`loadAyahByCoordinate`) over manual user input when recording weak verses, and added live verified Quran text previews in both the Failed-Revision Rating modal and the Manual Weak-Verse modal.
   - `src/services/readingKhatmaService.test.ts` & `src/tests/pwaIntegration.test.ts`: Added automated unit and integration assertions for UID-scoped Reading Khatmas and Phase 3 offline audio/bookmark wiring.
5. **Phase 4 Complete Daily Adhkar & Duas System with Verified Audio Playback, Counter & Free Tasbih Implemented:**
   - `src/data/adhkarData.ts`: Created a verified, sourced, fully vocalized Daily Adhkar & Duas corpus across 8 categories (`morning`, `evening`, `after_prayer`, `sleeping`, `waking_up`, `quranic_duas`, `prophetic_duas`, `istighfar`) plus 5 Free Tasbih presets (`FREE_TASBIH_PRESETS`) and time-of-day category recommendation (`getRecommendedAdhkarCategoryForHour`).
   - `src/services/adhkarProgressService.ts` & `src/services/storageService.ts`: Implemented UID-scoped persistence (`wird.adhkar.progress.v1`) for daily item repetition counts, category completion summaries, favorite Adhkar, and the cumulative Free Tasbih counter.
   - `src/components/adhkar/AdhkarView.tsx`: Built the complete Daily Adhkar & Duas workspace resolving verified local Quran chunks (`loadSurahVerses`) and local-first offline audio playback (`offlineQuranAudioLibrary.resolvePlaybackSource`) for all Quranic Adhkar/Duas, interactive tap-to-count cards with auto-advance, search/favorites/audio filters, Free Tasbih counter, and cross-navigation to Ruqyah (`#/ruqyah`).
   - `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`, `src/components/dashboard/DashboardView.tsx`: Registered `'adhkar'` (`الأذكار والأدعية`) in navigation (before `'الإعدادات'`), routing, lazy-loaded chunks, and dashboard quick actions.
   - `src/tests/adhkarSystem.test.ts` & `src/tests/runAllTests.ts`: Added automated test suite verifying all 8 categories, Quranic coordinate bounds, UID-scoped counters/favorites/Tasbih, and offline audio integration.
6. **Phase 5 Complete Chronological Sourced Prophetic Seerah Experience Implemented:**
   - `src/data/seerahData.ts`: Created a versioned (`SEERAH_BOOK_VERSION = '1.0.0'`), chronological Prophetic Seerah book spanning 5 chronological parts (`SEERAH_PARTS`) and 16 doubly-linked narrative chapters (`SEERAH_CHAPTERS`) from pre-birth Makkah through birth, youth, revelation in Hira, public call & Abyssinia, Year of Sorrow & Isra/Mi'raj, Aqabah pledges, Hijrah, Madinah foundation, Badr, Uhud & Khandaq, Hudaybiyyah & letters to kings, Fath Makkah, Farewell Pilgrimage, passing to Al-Rafiq Al-A'la, and Shamail/character — with 17 claim-level records (`SEERAH_CLAIMS`), 7 public-domain classical sources (`SEERAH_SOURCES`), evidence grades (`ثابت بالصحيح` / `مشهور في السير` / `محل خلاف تاريخي`), and explicit uncertainty notes.
   - `src/services/seerahProgressService.ts` & `src/services/storageService.ts`: Implemented UID-scoped persistence (`wird.seerah.progress.v1`) for reading mode (`continuous` vs `study`), last reading position, completed chapters, and versioned scene bookmarks, completely isolated from Quran memorization/khatma statistics.
   - `src/components/seerah/SeerahView.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`, `src/components/dashboard/DashboardView.tsx`: Built the lazy-loaded `#/seerah` continuous narrative book reader with pure-reading vs verification mode toggle, parts/timeline index, figures/places/sources directory, bookmarks tab, and optional end-of-chapter comprehension quiz.
   - `src/tests/seerahSystem.test.ts` & `src/tests/runAllTests.ts`: Added automated test suite verifying the 5-part / 16-chapter chain, claim/source/figure/place integrity, uncertainty notes, and UID-scoped progress/bookmarks.
7. **Phase 6 Offline-First Hardening & Prayer Times / Hijri Calendar / Qibla (AlAdhan Adapter) Implemented:**
   - `src/services/offlineQuranAudioLibrary.ts` & `src/services/offlineQuranAudioLibrary.test.ts`: Added per-job cross-tab exclusive worker locks (`wird-offline-audio-job-worker:${jobId}`), displaced generation cleanup on re-verification, and unindexed Cache Storage orphan key sweeping via `cache.keys()` during `reconcileLibrary()`.
   - `src/services/prayerTimesService.ts`, `src/services/prayerTimesService.test.ts`, `src/components/dashboard/DashboardView.tsx`: Built the AlAdhan API adapter (`fetchDailyPrayerSchedule`) with 4500ms timeout, `redirect: 'error'`, strict `HH:MM` sanitization, UID-scoped daily cache (`wird.prayer.cache.v1`), mathematical Great-Circle Qibla bearing calculation (`computeQiblaBearingDegrees`) to the Holy Kaaba (`21.422487° N, 39.826206° E`), offline Umm al-Qura Hijri date formatting (`formatLocalHijriDate`), next-prayer countdown (`getNextPrayerSummary`), and interactive Dashboard Prayer/Hijri/Qibla card across 8 city presets.
8. **Phase 7 Bidirectional Multi-Device Sync with Collection-Specific Tombstones, Anti-Resurrection & Weak-Verse Delta Convergence Implemented:**
   - `src/services/tombstoneReconciliationService.ts`, `src/services/syncConflictSafety.ts`, `src/services/tombstoneReconciliationService.test.ts`: Implemented `CollectionTombstoneRecordV2`, `reconcileRecordsWithTombstones` (clock-independent revision comparison, anti-resurrection suppression when `revision <= deletedAtRevision`, explicit restore superseding tombstones at `revision > deletedAtRevision`, and fail-closed `concurrent_divergent_edit` conflict descriptors), `reconcileWeakVerseSnapshotsV2` (per-device mistake delta convergence + resolved-at-revision anti-resurrection), and `isSafeV2ReconcilablePayload` (while preserving fail-closed `containsUnsafeFullSnapshotProjection` for V1 full snapshots).
9. **Phase 8 + Release Readiness Fixes Verified (2026-11-20 — Draft PR `#404`):**
   - **Religious Content & Source Hardening:** Fixed Arabic typos (`عند الإيواء إلى الفراش` in `src/data/adhkarData.ts`, `كما خلّده` in `src/data/seerahData.ts`); verified and separated primary Badr consultation narrations (`صحيح البخاري 3952` for Al-Miqdad, `صحيح مسلم 1779` for Sa'd ibn Ubadah, `سيرة ابن هشام` for Sa'd ibn Mu'adh); separated Farewell Pilgrimage wordings (`صحيح مسلم 1218` verbatim «كتاب الله», `موطأ مالك` balagh «كتاب الله وسنة نبيه», `مسند أحمد 23489` for Tashriq equality wording — zero misattribution to Sahihayn); restricted `adhkar-kalimat-tammat` to `evening` (Muslim 2708/2709, Tirmidhi 3604, Ahmad 7898); added category-specific repetition targets (`getAdhkarRepeatTarget`: `3` in morning/evening/sleep, `1` in `after_prayer` per Abu Dawud 1523 & Nasai 1336, with note on Fajr/Maghrib overlap).
   - **Backward-Compatible ASCII Adhkar ID:** Normalized `adhkar-sleep-bismika-ربي-wadatu` → `adhkar-sleep-bismika-rabbi-wadatu` via `LEGACY_ADHKAR_ITEM_ID_ALIASES` in `src/services/adhkarProgressService.ts` (lossless migration for stored counts and favorites).
   - **Storage UX (`wird.prayer.cache.v1`):** Excluded automatic cache-only `CACHE_ONLY_AUXILIARY_KEYS` (`wird.prayer.cache.v1`) from `hasLegacyStorageData()` and `setStorageScope()`'s legacy-choice blocker while preserving full UID scoping, migration on real-data `'import'`, and cleanup in `resetAllData()`.
   - **Local Verification Executed (2026-11-20):**
     - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split across all 72 suites): **PASS** (`800 PASSED | 0 FAILED`)
     - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
     - `npm.cmd run smoke:api-imports`: **PASS**
     - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`3.27s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
     - `bun@1.4.4 install --frozen-lockfile`: **PASS** (`Checked 304 installs across 371 packages`)
     - `bun@1.4.4 audit --audit-level=high`: **PASS** (`No vulnerabilities found (checked 360 packages)`)
     - Exact-head GitHub Actions `WIRD Quality Gate` (Firestore Rules Emulator + Desktop & Mobile Playwright E2E + server smoke): triggered on push to PR `#404`; previous commit `bcbf26fe` passed 100% in Run `44672654181`.
     - Production settings, sync flags, `firestore.rules`, `authService.ts`, Quran corpus, Vercel, and `main`: **UNTOUCHED**.

### Exact Next Action
- **Commit & Push `feat/platform-transformation-20261120` After Owner Approval & Run GitHub CI Quality Gate:**
  - Once the owner approves the staging manifest, stage and commit the reviewed changes on `feat/platform-transformation-20261120`, push to `origin` (`xm8eslam-stack/WIRD-APP`), inspect the exact-head GitHub Actions Quality Gate (including Firestore Rules Emulator with Java and Desktop/Mobile Playwright E2E), and review the Vercel Preview deployment before any authorized merge to `main`.

---

## Historical continuation note — Google AI Studio UX work (2026-11-18)

**Owner's latest instruction:** Google AI Studio is currently working on the comprehensive WIRD UX restructuring prompt. The user expects the AI Studio usage/quota limit may run out before the work is complete. When the user returns and says **"كمل" / "فكّرك" / asks to continue WIRD**, resume this exact work rather than starting a new feature track or asking the user to repeat the brief.

### What is in progress
- The user has submitted the previously prepared **WIRD | وِرد — MASTER UX RESTRUCTURING & QURAN EXPERIENCE PROMPT** to Google AI Studio.
- AI Studio is actively implementing/reviewing the requested UI/UX changes; completion is NOT yet confirmed.
- The prompt was based on a read-only review of the then-current GitHub `main` source, including the Mushaf reader/facsimile page, memorization session, plans, shared audio preferences, daily session selection, and plan lifecycle services.
- **Important:** AI Studio workspace may contain uncommitted changes that are not present on GitHub. Do not assume its workspace and `main` are synchronized. Inspect both before deciding what remains to be done.

### Confirmed UX/product decisions from the user's answers
1. **Printed Mushaf interpretation on desktop:** support both layouts — a sliding side panel beside the selected printed page, or temporarily replace the opposite page with tafsir and provide a clear return action. Remember the user's preferred layout per screen/context where practical.
2. **Default memorization-session ayah presentation:** continuous connected ayah display, clearly highlighting the current ayah and placing its controls close to it. Keep the printed Mushaf available as an alternate view; do not force a single-ayah card as the default.
3. **Reciter/audio preferences:** changing the reciter from the Mushaf, memorization session, or revision should synchronize the global reciter preference across the app. Synchronize global speed/repeat preferences where appropriate, BUT preserve exercise-/ayah-/session-specific repeat and playback settings; global preferences must not overwrite a deliberately configured local exercise.
4. **Multiple active memorization plans on Home:** one unified **"وردك اليوم"** view aggregating today's tasks from every active plan and revision queue. Each task must retain its source/plan identity, offer navigation to its plan/details, and never disappear merely because another plan is active. Avoid a clutter of separate plan cards.

### Full scope of the active UX brief
- Make the Qur'an experience coherent across reader, session, revision, tafsir, and audio controls.
- **Printed Mushaf:** desktop/tablet spread should show two facing pages together; on narrow mobile screens use a readable responsive fallback (normally one page at a time), not a cramped miniature spread. Keep page order, RTL direction, page navigation, and current-page state correct.
- **Tafsir:** allow interpretation of either page in the spread, with a clear way back to the same spread/page state. Reuse verified local Qur'an text and trusted tafsir sources; never substitute untrusted/generated scripture.
- **Memorization session:** reduce visual crowding and excessive nested boxes; make ayat the visual focus; group related controls; place previous/next navigation directly below the ayat/content they control rather than detached at the bottom of the screen. Preserve existing useful session functionality instead of rebuilding it needlessly.
- **Cumulative linking (الربط التراكمي):** make the workflow clearer and easier to operate, while preserving progress, correct ayah boundaries/order, and existing free-memorization/linking modes.
- **Audio:** unify the reciter selector across app surfaces and avoid divergent selectors/preferences. Preserve local session/exercise state where it is intentionally specific.
- **Plans and daily scheduling:** verify multiple active plans remain independent; Home aggregates today's tasks from all plans. Review late/missed sessions, early completion, rescheduling/rebalancing, light recovery days, revision, weak ayat, and cumulative linking. Reuse and improve existing `planLifecycle.ts` and `dailySessionSelection.ts` logic rather than replacing it without evidence/tests.
- **Visual system:** calm, polished, consistent Islamic product UI; responsive desktop/tablet/mobile; accessibility and touch targets; reduce unnecessary cards/containers and visual noise.
- **Quality:** add/update unit, integration, and Playwright coverage for the actual flows and responsive states. Do not remove existing tests to make the suite green.

### Resume procedure — do this before changing code
1. Ask no broad recap question. Start by checking the latest Google AI Studio workspace state if it is accessible, and inspect its diff/status/build/test output. Identify exactly what AI Studio completed, what is partially implemented, and what remains.
2. Re-fetch GitHub `main` HEAD and the current `docs/CONTINUE_HERE.md`; compare the repository state with the workspace. The last SHA recorded elsewhere in prior conversation may be stale.
3. If the AI Studio workspace is not accessible in this session, inspect the latest GitHub branches/PRs/commits and this note, then clearly distinguish confirmed repository changes from unverified AI Studio-only work. Do not pretend to see an unavailable workspace.
4. Continue from the first incomplete item in the UX scope above. Prioritize functional correctness and coherent responsive UI, not superficial restyling.
5. Run the relevant checks, record exact command/results and exact commit/PR SHA. Separate local checks, GitHub CI, Preview deployment, and real-device/live verification.
6. Update this file and `docs/DEVELOPMENT_ROADMAP.md` with completed items, remaining items, test evidence, blockers, and next action so another chat can resume without relying on chat history.

### Guardrails
- Do not overwrite or discard AI Studio workspace changes. Inspect and preserve them first.
- Do not assume changes are pushed to GitHub just because AI Studio reports implementation complete.
- Do not push directly to `main`; use a focused feature branch/PR and exact-head quality gates unless the user explicitly changes this instruction.
- Do not merge or deploy Production without explicit user approval. Preview testing may proceed only within the previously authorized scope and current deployment constraints.
- Do not modify production secrets, Firebase production data/rules, Vercel project settings, or the production sync flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` / `VITE_WIRD_REMOTE_PROJECTION_ENABLED` without explicit approval.
- Preserve local-first/offline behavior, user data, verified Qur'an text, and trusted-source requirements.
- The user's expectation is that work continues autonomously as far as tools/access allow; do not stop merely to wait for a test that can be polled. If a tool/session/quota boundary prevents further work, leave a precise checkpoint here.

---

## Verified AI Studio workspace state — 2026-11-17

- **Deployment & GitHub status:** Workspace edits live in Google AI Studio only. **NOT committed/pushed to GitHub** and **NOT deployed to Vercel** (explicit owner directive; Vercel Production sync flags remain unchanged).
- **Canonical Firebase target verified (`firebase-applet-config.json`):** `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`.
- **Workspace fixes implemented (2026-11-16 + 2026-11-17):**
  - Build & PWA: `package.json` (`NODE_ENV=production vite build`), `src/main.tsx` (DOM-ready `/sw.js` registration), `public/sw.js` (non-blocking font precaching after shell precache).
  - Security & Backend narrowing: `api/advisor.ts` TypeScript `metrics` narrowing; `server.ts` Arabic rate-limit copy typo fix.
  - Client Services & Auth: `src/services/authService.ts` fixed `'کاربر'` -> `'مستخدم'` in null-user guards; `src/services/advisorService.ts` added `buildBoundedChatPayload()` (clamping long multi-turn histories cleanly under the 4,096-byte server payload cap) and `try/finally` `clearTimeout` cleanup on all 3 `fetch` calls.
  - UI & Reliability Fixes: `src/components/settings/SettingsView.tsx` wired `containsUnsafeFullSnapshotProjection()` into the sync conflict UI so `weakVerses`/`activityEvents` (and unsafe `syncMeta` transactions) fail closed with status guidance instead of exposing doomed replacement buttons; `src/components/assistant/QuranAdvisorView.tsx` added unmount guard for `checkStatus()`, `maxLength={500}` on chat input, and string-backed calculator input preventing `NaN يوماً` and using `604` pages for full Quran (`30` ajza); `src/components/plans/PlanningEngineWizard.tsx` guarded `paceQuantity` against `0`/`NaN` during typing/preview; `src/components/ruqyah/RuqyahView.tsx` tracked and cleaned up `autoAdvanceTimerRef` on re-trigger, category change, and unmount; `src/components/brand/BrandDesignShowcase.tsx` cleaned up `copyTimerRef`.
  - Regression & E2E Tests: added `buildBoundedChatPayload` 4KB wire-size check in `src/tests/geminiSecurity.test.ts`, null-user Arabic error assertion in `src/tests/firebaseAuth.test.ts`, calculator `NaN`/604-page E2E regression in `e2e/advisor-ux.spec.ts`, and earlier E2E selector/queue alignment across 6 spec files.
- **Executed local workspace checks (final state):**
  - `npx tsc --noEmit`: **PASS**
  - `npm test`: **PASS** (`733 PASSED | 0 FAILED`)
  - `npm run build`: **PASS** (`2.07s`, zero chunks > 500 kB, 9-asset shell manifest + 252 lazy assets, `/sw.js` active and non-`jsxDEV`)
  - `npm run mushaf:validate-coverage`: **PASS** (`604` Hafs/KFGQPC SVG pages, `6236` unique local ayahs mapped once)
  - `npm run smoke:api-imports` & `npm run smoke:server`: **PASS** (production + dev Express servers)
  - Desktop + Mobile Playwright (all 18 `e2e/*.spec.ts` files across batches): **PASS** (`164` passed, `2` intentionally skipped, `0` failed; includes offline shell reload, 252-asset offline preparation, and calculator `NaN` regression)
  - `npm run test:firestore-rules`: **BLOCKED** in AI Studio container (no Java runtime: `Could not spawn java -version`).
  - `npm run lint` + `compile_applet`: run as final build/lint verification pass.

## Immediate next actions

1. **Sync & commit workspace changes to GitHub feature branch/PR:** review the workspace diff, push to a dedicated feature branch (not directly to `main`), and run the full GitHub Quality Gate workflow (which provides Java for `test:firestore-rules` alongside Bun install/audit, unit tests, build, and Playwright).
2. **Firebase Console Authorized Domains:** if testing Google Sign-In inside Google AI Studio preview, add the active `ais-dev-*.run.app` preview origin to Firebase Console -> Authentication -> Settings -> Authorized domains for `wird-quran-app`.
3. **Production sync flags owner decision (`docs/OWNER_ACTIONS.md`):** confirm whether to disable `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` in Vercel Production until sync release gates complete.
4. **Pending codebase tracks (unchanged from 2026-11-14 queue):**
   - Reconcile `#374` hygiene PR cleanly onto current `main` (without its stale lockfile or obsolete README).
   - Offline audio `#366`/`#368`: unify store, cross-tab lock, orphan cleanup, quota recovery, restart/isolation gates.
   - Security review on `#364` Advisor, generated Juz-boundary verification on `#369`/`#370`, and IndexedDB chunked archive integration on `#367`/`#371`.
   - Full stale-doc audit across `docs/`.

---

## Historical snapshot — 2026-11-14 GitHub/Vercel checkpoint (not re-fetched in Studio)

- PR #372 Bun CI migration: MERGED at `f264e4bdea7496090f60940e9e8db03e2fb15696`; exact tested head `950640ea78d29e87d426a89d8887c15e4de2abac`; Quality Gate run `43391729769` SUCCESS. Bun frozen install, audit, automated tests, API imports, Quran audio byte-range, Firestore Emulator, TypeScript, production build, server smoke, Chromium install, and desktop/mobile Playwright all passed. The optional 604 Mushaf coordinate-map step was SKIPPED.
- Vercel Production deployment `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` READY on exact main SHA `f264e4bdea7496090f60940e9e8db03e2fb15696`; production alias `https://wird-app.vercel.app/` assigned.
- PR #374 remains OPEN / DRAFT / HOLD at head `6673bb149a2ffa58177c35b9f68c76423dfb2a0b`, based on stale main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; do not merge.
- Live Production Ruqyah route/audio remained NOT VERIFIED.
- Latest application-code merge at that snapshot was `d265bdf37e9410ad6cd99273bb595526dce63b50` (Ruqyah).
- Documentation policy: PASS. PR #363 merged; `DOCUMENTATION_OPERATING_STANDARD.md`, `AGENTS.md`, `GEMINI.md`, and root `README.md` are on main.
- PR #373 exact-head CI: PASS. Run `43634212804`, job `132567343695`, exact PR head `c42286fa6a5a85bba414a45383a56bd7a00f0cc2` (711 passed / 0 failed; Playwright 160 passed).
- Previous read-only Vercel inventory reported both sync flags `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true`. No changes authorized or made.

## Open PR inventory — refreshed after #373 merge (2026-11-14; re-fetch before action)

All listed PRs were OPEN / DRAFT at refresh time. Re-fetch exact heads/checks before action.

| PR | Head SHA | Current handling |
|---:|---|---|
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Hygiene; overlaps #372 package/lockfile; defer until reconciled |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun CI/lockfile candidate; MERGED at `f264e4b...` |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Codec only; not integrated into persistence |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Session display settings |
| #369 | `3478ae22a200a817a240d8b28e532b01674427bf` | Multi-Surah/Juz/ranges; generated-index E2E outstanding |
| #368 | `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8` | Offline audio; lifecycle/cross-tab gaps |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | Interim payload cap only |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/offline; reconcile with #368 |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah prototype; outside focused scope pending owner decision |
| #364 | `2a98c6da77bd849811326696ab7075fe6c9c85b8` | Advisor/API security; full verification outstanding |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Legacy audio store; do not merge beside #368 |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Legacy audio store; do not merge beside #368 |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy; do not merge wholesale |

PR #363 and #373 are MERGED. PR #375 and #360 remain closed/superseded. #358/#359 are competing legacy audio stores; do not merge alongside #368.


## Historical snapshot — superseded by post-merge state

- PR #363 is based on current main and is not behind. It changes 46 documentation/instruction paths (no runtime source files), including a new root README; no runtime source files are in its changed-path list.
- The last inspectable GitHub Quality Gate success is run `43629972574`, job `132554211307`, on an earlier head; it does NOT certify the current docs head. No workflow run was returned for current head `086d92a522f2d795f4c96f6358342338a6de8e4c`; current GitHub Quality Gate is NOT VERIFIED. The 604 Mushaf coordinate-map check was SKIPPED in the earlier run.
- Earlier docs PR heads have had READY Previews, but deployment evidence never transfers to a later commit. Always re-fetch the Preview deployment and verify its source SHA against the current PR head.
- Vercel Production is READY: deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, source SHA exactly matches main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, alias `https://wird-app.vercel.app/`.
- Project protection: password protection OFF; SSO protection ON for all non-custom domains. The custom production domain is `wird-app.vercel.app`.
- Vercel Hobby project uses Vite and Node 26.x. No Vercel settings or deployments were changed by this preparation.
- Root `README.md` and canonical docs exist on PR #363 only until it is merged; they are not yet available from main. Do not assume a new chat or Google AI Studio reading main can see them yet.
- No local checkout is exposed; no local tests are claimed. No runtime code, Firebase Rules/data, Vercel settings, secrets, sync flags, or Production deployment was changed.
- Vercel environment inventory (names/targets only): `ISLAMICAPI_API_KEY` and `GEMINI_API_KEY` have sensitive entries for Preview and Production; their values were not read and their validity was not tested. `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` in Production. Do not change either flag or run sync-related Production actions without explicit owner authorization.
- Repository Firebase source/config expects project `wird-quran-app` and default Firestore database. Vercel's `VITE_FIREBASE_PROJECT_ID` is encrypted and was not decrypted; the deployed Firestore Rules release was not independently verified. Do not infer Rules deployment from Emulator success.

## Historical PR inventory — pre-merge snapshot

All 16 below were OPEN / DRAFT at the latest GitHub inventory. Re-fetch exact heads, base, changed paths and checks before action.

| PR | Head SHA | Handling |
|---:|---|---|
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Hygiene; reconcile package/lockfile with #372 |
| #373 | `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca` | Ruqyah lazy loading/restoration; gated pending exact-head evidence and live smoke |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun/CI repair candidate |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Archive codec not integrated into persistence |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Session display settings |
| #369 | `3478ae22a200a817a240d8b28e532b01674427bf` | Multi-Surah/Juz/range; generated-index E2E outstanding |
| #368 | `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8` | Unified offline audio; cross-tab/lifecycle gaps |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | Payload cap only, not chunked archive |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/offline shell; reconcile with #368 |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah prototype; no publishable verified narrative |
| #364 | `2a98c6da77bd849811326696ab7075fe6c9c85b8` | Advisor/API security; full verification outstanding |
| #363 | MERGED at `fb8e57640db78545fc93ce3f482b7ab3a9f59ded` | Documentation standard integrated into main; exact-head CI run `43632493503` PASS; Mushaf coordinate check SKIPPED |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Legacy audio approach; do not merge beside #368 |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Legacy audio approach; do not merge beside #368 |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy broad PR; do not merge wholesale |


## Confirmed changed-path overlaps — serialize these PRs

- #374 overlaps #363 at `docs/engineering/README.md`; reconcile both patches before either is merged.
- #359 overlaps #363 at `docs/offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md`; preserve the #363 unified plan and reconcile any useful #359 detail explicitly.
- Legacy #2 overlaps #363 at `docs/DEVELOPMENT_CHECKPOINT.md` and `docs/engineering/FIRESTORE_SYNC_DESIGN.md`; do not merge #2 wholesale.
- #373, #372, #371, #370, #369, #368, #367, #366, #365, #364 and #358 have no changed-path overlap with the current #363 changed-file list. This is a path snapshot only; re-fetch before action.
