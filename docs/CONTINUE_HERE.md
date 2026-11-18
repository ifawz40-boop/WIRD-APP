# WIRD — Live continuation checkpoint (2026-11-18 10:35 +02:00)

## PR #390 latest verified state

- Working branch: `feat/offline-mushaf-package-20261117`
- Latest code commit verified: `89e13885e4ad9074aeab62fbd8dc5b8dfd3c50cf` (compact Tafsir panel accessibility region). PR merge-test commit: `63aff32`.
- Exact-head Quality Gate #4678 / run `44266490225` completed:
  - Application job: PASS.
  - Unit/integration aggregation: **780 passed / 0 failed**.
  - Firestore Rules Emulator: **31 passed / 0 failed**.
  - All **604** printed Mushaf page coordinate maps validated against WIRD's local Quran data (6,236 unique ayahs).
  - Native API import checks, approved Quran audio CDN smoke (8/8), TypeScript, production build, production server smoke: PASS.
  - Desktop + mobile Playwright: **194 passed / 2 intentional skips / 0 failed**.
  - This includes Mushaf partial-download retry (simulated HTTP 503), full 604-page cache repair/recheck, offline-open, Tafsir full/partial download-resume, and offline navigation.
- Dependency audit:
  - Production graph: **0 advisories across 241 packages**.
  - Full graph: **FAIL** on GitHub-reviewed High GHSA-fc5q-39xc-vjpf / CVE-2026-112366 for dev-only `picomatch@4.0.7` through `vite > tinyglobby > fdir > picomatch`.
  - No override, suppression, threshold reduction, or unreviewed upstream patch was applied. The package is not fixed by this run.
- PR #390 remains **Draft / HOLD**. No merge, production deployment, or production settings/secrets changes.

## Next engineering actions (continue without waiting for test jobs)

1. Added `e2e/offline-restart-recovery.spec.ts` on 2026-11-18 (code commits `c52470c4dba00c71fd80a35a9c3345825efdc99d` and cache-name correction `b2dd84b8a78ca99532c71aa00db0af91e4259608`):
   - Tafsir: simulate HTTP 503 after one verified surah, reload the app, and assert the saved surah is not downloaded again before completing all 114.
   - Mushaf: simulate HTTP 503 during the 604-page package, reload the app, and assert the five valid cached pages are reused while the failed page is fetched again.
   - These new tests are **NOT YET VERIFIED**; no exact-head GitHub Actions run has been observed for the new commits. The latest Vercel status is blocked by the account build/deployment rate limit, not an application build result.
2. Still add audio close/recreate recovery coverage: interrupt an in-flight job, create a new library instance against the same IndexedDB + Cache Storage, reconcile, and prove verified files survive while unfinished items resume exactly once.
3. Re-run Quality Gate on the final exact branch head after these additions. Keep production-only audit and complete dependency audit separate and visible.
4. Physical Android/iOS/Safari cold-restart + airplane-mode acceptance remains mandatory; Playwright is not a substitute.
5. Offline-only production boundary is not currently confirmed: the last read-only Vercel inspection reported `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` on Production. Do not change either without explicit owner approval; verify both are false before any offline-only Production release.
6. Keep the PR Draft/HOLD until the full security gate has an evidence-based resolution or the owner explicitly authorizes a documented risk exception. No such exception is currently authorized.

## Confirmed additional integrity findings already addressed

- Exact plan-date identity now accompanies `enginePlanId` through both dashboard card and header quick-start session routing.
- Approved durable audio now resolves across Mushaf, Surah library, memorization session, and service-worker local-first playback; stream-only reciters remain network-only.
- Mushaf 604/604 repair action stays enabled and revalidates SVG content rather than trusting key count; quota preflight is skipped for a read-only full-cache recheck.
- Tafsir compact panel now exposes a named region; the prior desktop/mobile async-selector test failures are fixed and the latest Playwright run passes.

---

# Latest continuation checkpoint — 2026-11-18 05:00 +02:00

- Current release candidate: PR #390, branch `feat/offline-mushaf-package-20261117`, current code/test head before this documentation checkpoint: `b84b62b00e618a02784eed0fb502e55b413cc5c0`. Main remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; nothing has been merged or deployed.
- Follow-up correctness fix added: a dashboard-started memorization session now carries both the originating engine-plan ID and exact schedule date (`planDate`) through its deep link and completion transaction. This prevents two identical ayah ranges repeated on different days in the same plan from completing the wrong day. Added a regression unit test and strengthened the dashboard Playwright URL assertion.
- Latest observed Quality Gate run: #44239139339. Dependency security audit failed on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366. The verify job was still running through Playwright installation at last inspection. Its merge commit included the date-specific unit fix; the final E2E URL assertion commit was pushed after that run started and is not yet proven by that run.
- Security handling: the official GitHub advisory lists affected versions through 4.0.7 and no patched version. Upstream candidate fixes #237/#238 are unmerged; do not pin either, suppress the audit, or weaken the gate. Re-check the official advisory/upstream status before making a dependency change.
- Automated checks previously passed on this candidate: test suite, TypeScript, production build, Firestore Rules emulator, and Desktop/Mobile Playwright on earlier exact SHAs. These are not proof for the current head. Current exact-head CI is required.
- Offline review: AuthGate can initialize guest scope locally; verified-user scope replays the local IndexedDB journal before mounting. Service worker explicit package includes all Vite bundle chunks and public assets; shell/content/audio/Mushaf caches remain separated. Cold browser restart + airplane-mode acceptance on a real device remains outstanding.
- Next: collect final jobs/logs from #44239139339; ensure the latest Playwright assertion is covered by a fresh run when a run can be triggered; fix only evidence-backed failures; then complete exact-head desktop/mobile/offline tests. Do not merge/deploy while the security gate fails or real-device offline acceptance is missing.

---

# WIRD — Continuation Entry Point

## Latest integrity follow-up — 2026-11-17

- Re-reviewed the offline Tafsir persistence path and found that previously stored IndexedDB rows were counted as downloaded based only on their keys/version; malformed or incomplete payloads could therefore be skipped during resume and briefly contribute to a false offline-ready count.
- Fixed in `src/services/tafsirOfflineLibrary.ts`: both the status calculation and resume-skip set now validate every persisted surah against WIRD's canonical verse count, sequential coordinates, requested surah and non-empty translation before counting/skipping it. Invalid existing rows are treated as missing and fetched again.
- Added E2E regression coverage that seeds a corrupt surah-1 record and stale manifest, confirms progress remains 0/114, then verifies resume fetches and validates all 114 surahs.
- Code commits: `2dfe56cdced650f45a004b183b1cca793edb1fe1` (service fix), `b41262195a14760faa75d4f530814ee13e56d070` (E2E regression). These are on PR #386's branch; re-fetch its exact current head before any further action.
- Verification: source and test changes are committed, but no local Bun/Playwright run is available here and PR #386 targets a feature branch, so no GitHub Actions Quality Gate has run. NOT VERIFIED; do not merge or deploy.
- Security note: picomatch advisory remains published, while its maintainer publicly disputes exploitability for trusted glob patterns. In WIRD, Vite is dynamically imported only in the non-production development path; production serves prebuilt `dist`. This supports a production-vs-build dependency risk assessment, but does not remove the advisory or authorize suppressing it. Keep the full finding visible pending an explicit, evidence-based gate decision.


## Live execution checkpoint — 2026-11-17 22:45 +02:00

**Owner priority:** local/offline readiness only. Do not expand scope beyond the requested work: (1) due memorization tasks from all active plans, (2) adjacent-ayah navigation beneath Quran reading surfaces, (3) one-page/facing two-page printed Mushaf, and (4) offline Tafsir al-Muyassar on either opposite spread side.

### Current implementation branches and release evidence

| Task | PR | Current exact head | State | Evidence / blocker |
|---|---:|---|---|---|
| Multiple active-plan due tasks | #383 | `77f360a4390466863c487dd164d567a95a83a605` | OPEN / Draft / NOT VERIFIED | Quality Gate run #4465 fails at `bun install --frozen-lockfile`: this branch is still based on main and does not include prerequisite #382's lockfile alignment. Latest Vercel status is also FAILED due `build-rate-limit`. |
| Adjacent-ayah controls | #384 | `022c1dd1cd5435f9c54a152e918e815dd601bbf5` | OPEN / Draft / NOT VERIFIED | Latest Vercel status is FAILED due to `build-rate-limit`; no GitHub Actions run returned. Controls now cover Quran study, Mushaf, and weak-verse cards in Revision Center; memorization session already has its own adjacent controls. The older READY preview at `3f59506204e21f702749159333162e80ab2f324d` predates Revision Center changes. |
| Printed Mushaf spread | #385 | `10529d88e358b35a63c7b41060ffe966141d54e2` | OPEN / Draft / NOT VERIFIED | Vercel Preview for this exact SHA was READY. One-page remains available; facing spread displays lower-numbered page on the right and next page on the left. |
| Offline Tafsir al-Muyassar / opposite-page mode | #386 | Code-fix commit `3d4bcbaac5e1830faf369125536294a8f8487e02` (later commits on this branch are documentation-only; re-fetch PR #386 for the live exact head). | OPEN / Draft / NOT VERIFIED | Latest Vercel status is FAILED due to account `build-rate-limit`; no GitHub Actions run returned. Do not call this a code build failure or pass. |

**Security advisory follow-up:** re-fetched upstream picomatch PRs #237 and #238. Both remain OPEN/unmerged. PR #238's 2026-11-17 review demonstrated residual exponential cases `+(*)`, `*(*)`, and `+(a*)`; it is not a complete fix. PR #237 is broader but also unreleased/unmerged. Do not pin either as a published safe version or bypass the audit.

**Dependency prerequisite #382:** exact head `e8ca61cf86b0d49d94783670f76db1c250c7c146`; Quality Gate run #4461 fails at `bun audit --audit-level=high` on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366 (High, CVSS 8.7). As of this checkpoint the GitHub advisory states affected through 4.0.7 and no patched version. Do not suppress audit, skip the step, or pin an unmerged/partial upstream patch. #382 must be resolved safely before the exact Quality Gate can pass.

### Task 4 latest refinements

- QuranEnc official API docs confirm no authentication and open CORS; translation catalogue returns `translations[]` with `key`, `version`, and `last_update`; surah endpoint returns `result[]` rows with `sura`, `aya`, `arabic_text`, `translation`, and `footnotes`. Docs: https://quranenc.com/ar/home/api
- The downloader pins and checks catalogue version `1.0.1` for `arabic_moyassar`, downloads explicitly one surah at a time, validates exact verse count and sequential coordinates, stores the untouched source payload in IndexedDB, and supports pause/resume. No network request is used during reading after download; no Firestore sync.
- Both spread sides default to Quran. Selecting Tafsir on either side leaves the opposite side Quran and displays Tafsir for that opposite Quran page. The direction can be reversed.
- Added navigation directly below each Tafsir ayah. A review found a spread-anchor edge case when navigating from the Tafsir side back to an ayah on that same physical page. Fixed it so the spread remains anchored and waits for the Quran side to render; added an E2E regression assertion.
- Offline-ready status now requires the exact set of surahs 1–114; invalid manifest numbers cannot falsely produce a complete package.
- Source attribution/version/reuse requirements are recorded in `docs/TAFSIR_OFFLINE_SOURCE.md`.

### Follow-up on Task 1 — duplicate ranges across plans

- PR #383 has an additional code fix at `77f360a4390466863c487dd164d567a95a83a605`: dashboard start actions carry the originating engine plan ID into session state; completion updates only that exact plan. This prevents a session started from plan B from accidentally completing an identical ayah range in plan A.
- The primary daily selection also carries the plan ID; changing the session range clears it. Deep-linked sessions without a plan ID retain coordinate-based fallback.
- Added a regression assertion that the daily selection preserves its source plan ID. PR #383 body contains the exact details. PR #383 remains OPEN/Draft; re-fetch its live head and CI before any release decision.

### Verification rules and next actions

1. No local checkout/terminal is available in this connector session; no local TypeScript/test/build result is claimed.
2. Preview READY proves only that Vercel built the exact older PR SHA. It does not prove runtime behavior or the newer #386 head.
3. #386 currently has no fresh Preview because Vercel rejected the build for plan build-rate-limit; wait for quota or use the existing preview only for its exact older SHA.
4. Resolve #382 dependency/lockfile gate without weakening security; then run the complete exact-head Quality Gate on every feature head, including desktop/mobile E2E, offline navigation, 604-page map integrity and audio checks.
5. Review and merge each task separately only after its exact-head checks pass. Do not merge drafts or deploy Production while blocked.
6. No Production deployment, Firebase Rules/data, Vercel secrets/settings, sync flags, or user data were changed.

---


**Last reconciled:** 2026-11-17 (Google AI Studio workspace)  
**Repository:** `xm8eslam-stack/WIRD-APP` · **Primary branch:** `main`  
**Last refreshed GitHub/Vercel checkpoint (2026-11-14):** `main` HEAD `f264e4bdea7496090f60940e9e8db03e2fb15696`; app-code merge `d265bdf37e9410ad6cd99273bb595526dce63b50`

> This is the authoritative current snapshot. Older dated snapshots below are historical evidence only. Re-fetch live GitHub/Vercel/Firebase state before merging or deploying.

## Current GitHub execution checkpoint — 2026-11-17 21:55 +02:00

- **Live main:** f70bf5e0617b558dfba4663da2667fb5d6c3ce8a (last re-fetched; re-fetch before any merge).
- **Owner priority:** local/offline readiness only; execute the four requested tasks in order and avoid unrelated features.
- **Task 1 — multiple active memorization plans:** PR #383 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/383. Branch fix/dashboard-multiple-due-plan-tasks-20261117. It collects due/overdue incomplete tasks across all active non-paused engine plans, excludes future/completed tasks/days, displays additional plan tasks, and completes against the matching due plan. Initial Quality Gate was blocked before tests because main's bun.lock did not match package.json overrides.
- **Task 2 — navigation below ayat:** PR #384 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/384. Branch feat/ayah-navigation-controls-20261117, stacked on PR #382's lockfile-alignment branch. Shared accessible controls are beneath study ayah cards, continuous reading, and Mushaf pages; session already has its own persistent navigation. Desktop/mobile E2E cases added. Not yet CI-verified.
- **CI prerequisite PR #382:** OPEN / Draft, branch fix/main-bun-lockfile-alignment-20261117. Lockfile alignment allows frozen install, but the last inspected Playwright run had two timing-sensitive tests fail on desktop/mobile. Follow-up E2E changes now wait for the keyboard listener and the newly created audio instance before asserting. Await exact-head rerun; do not merge until green.
- **Task 3 — printed Mushaf:** NOT STARTED. Add a persisted one-page/facing-two-page switch; side-by-side on wide screens and safe single-page fallback on narrow screens. Preserve page coordinates, audio, bookmarks, and reading progress.
- **Task 4 — opposite-page Tafsir al-Muyassar:** NOT STARTED. Each side independently supports Quran or Tafsir for the selected ayah on the opposite Quran page; both Quran by default. Must be backed by a complete verified local/offline corpus, not merely the existing small cache or a live API.
- **Offline boundary:** Quran text and reading coordinates remain from WIRD's verified local data. Tafsir corpus must preserve source text, footnotes, attribution and version metadata; no AI-generated replacement.
- **Next:** re-fetch #382/#384 exact heads and workflows; then implement task 3 as its own PR. Task 4 requires an audited local corpus and resumable offline storage before UI completion.

---

## Current GitHub execution checkpoint — 2026-11-17 22:05 +02:00

- **Live main:** f70bf5e0617b558dfba4663da2667fb5d6c3ce8a (last verified; re-fetch before release).
- **Owner scope:** local/offline app readiness only, limited to four requested tasks.
- **Task 1 — multiple active memorization plans:** PR #383 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/383. Collects due/overdue incomplete tasks across all active non-paused engine plans, displays additional due tasks, and updates the matching plan. NOT VERIFIED; initial CI failed before tests due to main's bun.lock/package.json override mismatch.
- **Task 2 — navigation below ayat:** PR #384 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/384. Shared previous/next controls under Library ayah cards, continuous reading and Mushaf page; session's existing controls remain. E2E coverage added. NOT VERIFIED.
- **Task 3 — one-page/facing two-page printed Mushaf:** PR #385 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/385. Adds local preference (single page default / spread), right-to-left page order (lower page on right), two-page stepping and audio queue across both pages, plus offline E2E coverage. NOT VERIFIED.
- **CI prerequisite PR #382:** bun.lock alignment is in branch fix/main-bun-lockfile-alignment-20261117. The latest exact-head Quality Gate stops at bun audit due high-severity GHSA-fc5q-39xc-vjpf affecting picomatch@4.0.7. No fixed version is stated by the advisory; do not suppress audit or downgrade the gate. This blocks validation/merging of #382–#385.
- **Task 4 — opposite-page Tafsir al-Muyassar:** NOT STARTED. Official QuranEnc source identified: Arabic Tafsir al-Muyassar, translation key arabic_moyassar, publisher King Fahd Complex, catalog version 1.0.1 dated 2026-11-09. Official API provides one-surah JSON with aya/translation/footnotes. Download/republication terms require unchanged content, visible publisher and QuranEnc.com attribution, version number, retention of edition info, reporting corrections, updating to source releases, and no unsuitable ads. Implement complete resumable IndexedDB offline download before opposite-page display.
- **Offline boundary:** two-page mode uses local facsimile page assets and WIRD's local Quran ayah corpus; audio waits for both page maps. Tafsir must be locally stored in full, not dependent on the existing small per-ayah cache or live API.
- **Next:** resolve upstream picomatch audit safely; then run exact-head CI on stacked PRs. Continue task 4 only with source content preserved byte-for-byte and full 114-surah validation.

---

## Current GitHub execution checkpoint — 2026-11-17

- **Live main:** f70bf5e0617b558dfba4663da2667fb5d6c3ce8a (last verified; re-fetch before release).
- **Owner scope:** local/offline app readiness only, limited to four requested tasks.
- **Task 1 — multiple active memorization plans:** PR #383 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/383. Collects due/overdue incomplete tasks across all active non-paused engine plans, displays additional due tasks, and updates the matching plan. NOT VERIFIED.
- **Task 2 — navigation below ayat:** PR #384 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/384. Shared previous/next controls under Library ayah cards, continuous reading and Mushaf page; session's existing controls remain. NOT VERIFIED.
- **Task 3 — one-page/facing two-page printed Mushaf:** PR #385 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/385. Adds local preference (single page default / spread), lower page number on right, two-page stepping, audio across both pages, and offline E2E coverage. NOT VERIFIED.
- **Task 4 — opposite-page Tafsir al-Muyassar:** PR #386 OPEN / Draft: https://github.com/xm8eslam-stack/WIRD-APP/pull/386. Head `e007a9cd149fa81fe74240d1a0f6bc2e41f6f308`, base #385 head `10529d88e358b35a63c7b41060ffe966141d54e2`. Adds a user-initiated, resumable 114-surah IndexedDB download of QuranEnc Arabic Muyassar V1.0.1, live-catalogue version verification, verse-count/coordinate validation, raw payload/footnote preservation, source attribution and no-network reading. In facing mode, either page can show Tafsir for all ayahs on the opposite Quran page, with the selected ayah highlighted and navigation controls beneath each Tafsir ayah; both pages default to Quran. Audio stays on the Quran page and auto-continues sequentially. NOT VERIFIED.
- **Exact PR heads:** #382 `e8ca61cf86b0d49d94783670f76db1c250c7c146`; #383 `45acc719a90049f1f71606995cb02943ac5e337d`; #384 `3f59506204e21f702749159333162e80ab2f324d`; #385 `10529d88e358b35a63c7b41060ffe966141d54e2`; #386 `e007a9cd149fa81fe74240d1a0f6bc2e41f6f308`.
- **CI evidence:** #382 run #4461 installs with frozen lockfile but fails `bun audit` on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch` (GHSA-fc5q-39xc-vjpf). #383 run #4460 fails earlier at `bun install --frozen-lockfile` because main's lockfile is out of sync. #384–#386 have no workflow runs yet because their PR bases are stacked feature branches; they need exact-head CI after the parent chain is safely resolved.
- **Security blocker:** GitHub's advisory was reviewed/updated 2026-11-17 and remains High (CVSS 8.7), affecting picomatch through 4.0.7 with no fixed version stated; npm still lists 4.0.7 as latest. Upstream candidate PR #237 is open/unmerged; PR #238 is narrower and has reviewer-reported remaining vulnerable patterns. Do not suppress audit or pin an unmerged incomplete patch. This blocks validation/merging of #382–#386.
- **Tafsir source:** QuranEnc key arabic_moyassar; publisher King Fahd Complex; catalogue version 1.0.1 dated 2026-11-09. Official terms: preserve content unchanged, publisher/source attribution, version and embedded edition info; report corrections; update to source releases; no unsuitable ads. See docs/TAFSIR_OFFLINE_SOURCE.md.
- **Offline boundary:** Quran text remains WIRD's verified local corpus. Tafsir is downloaded explicitly once while online and stored only on this device; no Firebase sync. Incomplete corpus is not displayed.
- **Next:** resolve upstream dependency security blocker safely, then run exact-head CI and browser/offline tests across the stacked PRs. Do not merge/deploy on a partial gate.

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


## Current continuation checkpoint — 2026-11-18 07:58 +02:00

### Candidate / branch state
- PR #390 remains OPEN / Draft / HOLD: https://github.com/xm8eslam-stack/WIRD-APP/pull/390
- Feature branch: `feat/offline-mushaf-package-20261117`.
- Latest code+CI change SHA at time of verified run: `74c6552e5dfc386128c62d4c5fb17c5e52de063d`.
- Main remains unchanged at `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. No merge, promotion or production deployment was performed.

### Exact Quality Gate evidence
- Run #4652: `44246969500`, exact head SHA `74c6552e5dfc386128c62d4c5fb17c5e52de063d`.
- Verify job PASS: 190 Playwright tests passed, 2 skipped, 0 failed; Firestore Rules Emulator 31 passed / 0 failed; full 604-page map validation passed with 6,236 unique local Quran ayahs mapped exactly once; TypeScript, production build, API import smoke, approved audio CDN/range smoke, and production server startup smoke all passed.
- Security job FAIL only at full dependency audit. The newly separated production audit passed with 0 vulnerabilities across 241 production-reachable packages. Full graph audit still reports one High advisory: `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`.
- Vite, `@vitejs/plugin-react`, and `@tailwindcss/vite` are now devDependencies; `server.ts` only dynamically imports Vite in non-production mode. Frozen lockfile install passed.
- GitHub-reviewed GHSA-fc5q-39xc-vjpf / CVE-2026-112366 remains active; upstream PR #238 is open/unmerged. No patched published version verified. Do not suppress, override to an unmerged commit, or approve risk without explicit owner decision.

### Code review conclusions
- Multi-plan daily queue now collects due/overdue incomplete tasks across every active non-paused engine plan, sorts deterministically, and displays all remaining tasks under the primary daily card. Completion resolves by plan ID and schedule date, preventing duplicate ayah ranges from updating the wrong plan. Unit tests cover three plans, overdue/today/future, paused/inactive/completed, duplicate ranges and exact originating date.
- Explicit offline audio library uses IndexedDB jobs/items/locks/staging plus generation-scoped Cache Storage entries, read-back byte verification, quota preflight, cross-tab leases, pause/cancel, resumable downloads, and orphan reconciliation. Dedicated automated tests cover crash recovery, stale leases, cross-tab control, quota failure, cache eviction, and local-first playback.
- Printed Mushaf package uses a separate versioned cache (not the 24-page opportunistic SW cache), validates/sanitizes each SVG and maps every ayah coordinate against WIRD's local Quran. Source pinned to Quran.ws commit `3ff27b46cecb0c0519d77531d9c868a579d1f623`; exact LICENSE/NOTICE checked. Quran.ws polygon metadata is CC BY 4.0 with product-use attribution waived; underlying Hafs/KFQC artwork terms are reproduced from the King Fahd Complex and permit digital/web/software use. This is a source-terms check, not an accuracy warranty.
- Offline Muyassar is stored locally per-surah in IndexedDB; source-version and full ayah coordinate coverage are validated. Reading stored surahs does not require network; fetching/updating the package does.

### Release blockers / not verified
- Production flags `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` were observed on Production in read-only Vercel inspection. No values changed. Owner approval is required before changing them; offline-only release should not proceed while the production configuration conflicts with that boundary.
- Latest Vercel preview observed earlier was stale (SHA `6d3c8f...`), not the current candidate. Feature branch deployment is disabled in `vercel.json`; no preview for SHA `74c6552...` was established. Do not treat old Preview as verification.
- No physical-device cold restart / airplane-mode acceptance has been performed. Playwright browser offline tests do not replace a real Android/iOS acceptance test.
- Do not mark app as 100% offline: APIs, auth/account actions, live external sources and uncached optional resources remain network-dependent. Distinguish bundled, explicitly downloaded, previously cached, opportunistic and network-only content.

### Next actions
1. Keep PR #390 Draft/HOLD until upstream publishes a fix for the full-graph advisory, or the owner explicitly accepts a documented, time-boxed dev-tool-only risk exception after reviewing exposure.
2. Re-run Quality Gate on the exact latest SHA after this checkpoint documentation commit; verify frozen install, production audit, full audit, tests, build, 604-page coverage and Playwright results.
3. Obtain explicit owner approval before changing either Production sync flag. Do not modify Vercel settings or secrets otherwise.
4. Once code/security gates pass, verify the exact current preview SHA, then test install → prepare offline package → download audio/Mushaf/Tafsir → close app → enable airplane mode → reopen and use on a real device.
5. Only then consider removing Draft and merging. Production deploy is a separate step and may be blocked by Vercel Hobby daily deployment limits.


## 2026-11-18 — audio cold-restart recovery test added

- Added a focused unit/integration regression inside `src/services/offlineQuranAudioLibrary.test.ts` (latest code commit `95c74d808195a675d54338f87e7705bc33b319cd`). It simulates a tab closing while ayah 2 is in flight, creates a fresh `OfflineQuranAudioLibrary` instance over the same IndexedDB factory/database and Cache Storage, runs reconciliation, and asserts:
  - Ayah 1 remains verified and is not fetched again.
  - Only the interrupted ayah 2 is fetched twice (initial aborted request + one retry).
  - Ayah 3 is fetched once; all three files end available and the job completes.
- Confirmed: `src/tests/runAllTests.ts` imports and executes `runOfflineQuranAudioLibraryTests()`, so this regression is part of the normal `bun run test` aggregate suite.
- **Verification pending:** exact-head Quality Gate #4687 / run `44269753267` is now queued/in progress for the updated PR head `c2a60843d59aceaa16c57a387648973481895083`. The application and full dependency-audit jobs are both in progress. Do not report new tests as passing until the run completes.
- New Playwright reload-recovery tests for Tafsir and 604-page Mushaf are also present in `e2e/offline-restart-recovery.spec.ts` (commits `c52470c4dba00c71fd80a35a9c3345825efdc99d`, `b2dd84b8a78ca99532c71aa00db0af91e4259608`). They too remain unverified pending exact-head CI.
- Latest source commit: `95c74d808195a675d54338f87e7705bc33b319cd`. Latest documentation checkpoint will be recorded by a subsequent docs commit.
