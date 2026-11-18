# WIRD — Master Completion & Release Plan

**Updated:** 2026-11-18  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Baseline:** `main` at `026a86bc5e26d8f27cafadbf1ddce3b155fe00d6`  
**Execution branch:** `release/wird-completion-20261118`  
**Existing offline candidate:** PR #390, branch `feat/offline-mushaf-package-20261117` (291 commits ahead / 2 behind baseline at last comparison)

## Owner execution instruction

Execute in large, coherent phases without pausing after each small change to await test results. Complete implementation and integration work first, then run the full verification matrix, fix every evidence-backed failure, rerun until all required gates pass, and only then merge/deploy and verify the live release. Continue to the next phase after the previous phase is released and verified.

This does not authorize bypassing security gates, deleting user data, changing production secrets/settings/sync flags, or shipping unverified functionality.

## Verified starting facts

- Current `main` HEAD is `026a86bc5e26d8f27cafadbf1ddce3b155fe00d6`.
- Main includes the Google AI Studio UX restructuring integration commit.
- Main has `docs/CONTINUE_HERE.md`; it does not currently have this master-plan file.
- PR #390 is a separate, diverged candidate: comparison against current main reports 291 commits ahead, 2 behind, merge base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- PR #390 contains the offline Mushaf/Tafsir/audio, multi-plan scheduling, recovery and related E2E work. Do not merge blindly or overwrite current main UX files.
- Candidate `package.json` places Vite and its plugins in devDependencies; main places them in dependencies. Do not copy package manifests/lockfiles across without a deliberate dependency and deployment analysis.
- Latest candidate checkpoint reports 780 unit/integration tests, 31 Firestore Rules tests, 604 Mushaf page maps / 6,236 ayah coordinates, and 194 Playwright passes + 2 intentional skips on an earlier SHA. These are historical results, NOT proof for current HEAD.
- Later restart/recovery E2E additions and subsequent branch changes need exact-head verification.
- Candidate full dependency audit previously failed on dev-only `picomatch@4.0.7` (GHSA-fc5q-39xc-vjpf / CVE-2026-112366); production audit passed. Do not suppress/waive the advisory or pin an unreviewed patch. Re-check official advisory and upstream release status.
- A previous latest-head workflow attempt failed the full dependency audit and cancelled the application test job before tests ran. A cancelled job is not a passing test.
- Physical Android/iOS/Safari cold-restart + airplane-mode acceptance remains outstanding.
- Production sync flags were previously observed enabled in the candidate checkpoint; re-read current Vercel production state before any offline-only release. Do not change production flags without explicit owner approval.

## Phase 1 — Reconcile branches and protect data

1. Re-fetch current main, PR #390 head, PR metadata, workflow runs and all continuation docs.
2. Build a file-level integration map for all changed files; classify each as candidate-only, main-only, identical, or conflicting.
3. Preserve current main UX work and candidate offline/hifz functionality. Resolve conflicts surgically; no whole-file replacement for App, Dashboard, audio preferences, router, reader or settings without behavior-by-behavior comparison.
4. Review IndexedDB schema/versioning, archive immutability, checksums, export/import, rollback, scope isolation and sync journal behavior.
5. Preserve all verified Quran content, user data, Firebase auth behavior and trusted-source boundaries.
6. Update continuation docs with exact source SHAs and integration decisions.

**Exit:** one integrated branch based on latest main, no known dropped feature, data-integrity review documented.

## Phase 2 — Multi-plan Hifz and daily task engine

1. Aggregate due/overdue work from every active, non-paused plan and revision queue.
2. Preserve source plan identity and exact schedule date through dashboard, quick start, deep links, session state and completion writes.
3. Prevent duplicate tasks; exclude future, completed, paused and inactive work.
4. Verify plan isolation: completing/rescheduling one task updates only its originating plan/date.
5. Preserve cumulative linking, free memorization, revision, weak-ayah tracking, repeat controls and recovery after interruption.
6. Verify plan creation/edit/pause/resume/delete and missed-day recovery behavior.

**Exit:** multiple active plans work independently and all due tasks appear once in the unified daily queue.

## Phase 3 — Complete offline experience

1. Audit PWA shell precache, cache versioning, asset MIME coverage and update/rollback behavior.
2. Verify local Quran data and navigation remain available offline.
3. Verify downloaded Tafsir al-Muyassar integrity, resume, corruption detection and mapping to canonical WIRD ayah coordinates.
4. Verify optional printed Mushaf package: all 604 pages, coordinate coverage, RTL ordering, single-page and facing-spread layouts.
5. Verify offline audio: approved reciters only, IndexedDB metadata + Cache Storage bytes, resumable jobs, pause/resume/cancel/retry/delete, quota preflight, locks, cross-tab safety and crash recovery.
6. Ensure stream-only sources remain network-only; never sync audio bytes to Firebase or auto-download the entire Quran.
7. Exercise cold restart and airplane mode, including interrupted and partially completed downloads.

**Exit:** supported downloaded content opens and plays after a cold restart with no network; incomplete/corrupt items recover safely.

## Phase 4 — Recovery, sync and long-run reliability

1. Test app termination during every durable write/download stage.
2. Test IndexedDB upgrade/reopen, stale locks, interrupted outbox replay, account-scope change and conflict handling.
3. Verify archives and backups are immutable, checksummed and restorable.
4. Verify guest-to-account migration, verified-user sync boundaries and account deletion behavior.
5. Verify no Quran/audio payload is accidentally projected to Firestore.
6. Add recovery evidence to automated tests and continuation docs.

**Exit:** no reproducible loss/duplication/cross-account leakage across defined interruption and recovery scenarios.

## Phase 5 — UX, accessibility and responsive completion

1. Integrate current Google AI Studio UX decisions with the offline candidate.
2. Verify Mushaf spread/tafsir return-to-page state, responsive layouts and RTL behavior.
3. Verify unified reciter preference while preserving session-specific repeat/speed configuration.
4. Verify memorization ayah focus, adjacent navigation, cumulative-linking controls and revision flows.
5. Verify dashboard task identity, clear empty/error/loading states, touch targets, keyboard/screen-reader behavior.
6. Remove dead controls and misleading “offline ready” or “verified” claims.

**Exit:** coherent end-to-end user journeys on desktop, tablet and mobile, with accessible states.

## Phase 6 — Full verification and remediation

Run against the exact final candidate SHA:
- Frozen dependency installation.
- Production and full dependency security audits (both visible; no threshold reduction or suppression).
- Unit/integration suite.
- Firestore Rules emulator.
- TypeScript/lint.
- Quran dataset and canonical coordinate validation.
- 604-page Mushaf coverage validation.
- API import and server smoke tests.
- Production build.
- Desktop/mobile Playwright suite, including all new regression and restart-recovery tests.
- Offline cold-restart/airplane-mode tests.
- Preview deployment and HTTP/runtime smoke checks.

Fix all failures in coherent batches and rerun affected checks plus the full suite. Do not treat Vercel READY as application test evidence. Record exact SHA, workflow run IDs, pass/fail/skip counts and reasons.

**Exit:** every required automated gate passes on the exact SHA intended for merge; remaining physical-device checks are either completed or explicitly identified as a release limitation rather than claimed as passed. No unresolved high-severity security gate.

## Phase 7 — Release and live verification

1. Confirm PR base is latest main and mergeability is clean.
2. Require exact-head quality gate and review evidence.
3. Merge using the agreed safe method; never force-push over unknown changes.
4. Verify Vercel production deployment references the merged SHA.
5. Smoke-test live app routes, auth, daily plans, Mushaf, Tafsir and audio endpoints.
6. Verify production environment and sync flags are consistent with the explicitly approved release scope; do not mutate secrets/settings.
7. Record rollback point and update `docs/CONTINUE_HERE.md` with deployment URL, SHA, checks and next phase.

**Exit:** production is live on the verified SHA and key flows pass live smoke checks.

## Execution log

### 2026-11-18 — Kickoff
- Created `release/wird-completion-20261118` from current main SHA `026a86bc5e26d8f27cafadbf1ddce3b155fe00d6`.
- Added this persistent master plan.
- No application source files changed yet.
- Next action: refresh PR #390 head and workflow state, then perform the file-by-file reconciliation map before integrating code.


## Phase 1 — initial reconciliation findings (2026-11-18)

- Refreshed PR #390 metadata: current head `f41c969dfb9652890a1db369a8e0d695e8ae0ee1`; still Draft / HOLD / not mergeable; 291 commits, 54 changed files, +5,253 / -317.
- Current exact-head workflow run `44289967861` / Quality Gate #4710 is completed but **cancelled**. The full dependency audit failed on dev-only `picomatch@4.0.7`; the application job was cancelled before tests began. No passing exact-head gate exists for this SHA.
- Compared the shared base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` against both branches. Main has 2 newer commits; PR has 291 commits after the shared base.
- Overlapping runtime files requiring surgical integration include:
  - `src/App.tsx`
  - `src/components/dashboard/DashboardView.tsx`
  - `src/components/library/QuranLibraryView.tsx`
  - `src/components/library/QuranMushafReader.tsx`
  - `src/components/session/MemorizationSessionView.tsx`
  - `src/services/audioService.ts`
  - `src/services/dailySessionSelection.ts`
  - `src/tests/runAllTests.ts`
  - `src/tests/quranMushafReader.test.ts`
- Main also adds UX-specific components/tests and updates `audioPreferences.ts`, cumulative linking, spread/tafsir UI and plan lifecycle. These must be retained while bringing across offline package features.
- Dependency manifests differ: candidate moves Vite + Vite plugins to devDependencies while main keeps them in dependencies. Keep main dependency classification unless a production/runtime audit proves otherwise; reconcile lockfile intentionally, never copy blindly.
- Current main contains tracked Playwright artifacts in `test-results/`; review repository hygiene, but do not delete unrelated history as part of this merge without checking provenance.
- No application source has been modified in this execution branch yet. The branch currently contains the persistent plan/checkpoint only. The next concrete implementation task is to create a file-level reconciliation patch set for the overlapping runtime files and candidate-only offline services/components.


### Phase 1 integration progress — 2026-11-18

- Created an integration branch directly from current main; branch remains based on main and is not behind it.
- Transplanted all candidate-only offline/PWA/audio/Tafsir services, API relay, settings controls, service worker changes, supporting tests, and E2E coverage. Main's package manifest and lockfile were intentionally retained; candidate's Vite dependency reclassification was not copied.
- Surgically reconciled overlapping App/Dashboard/daily-session selection changes. Daily hub now collects every due/overdue task from all active non-paused plans, excludes completed/future work, and preserves `enginePlanId` + scheduled date through quick start, route deep links, and exact completion writes.
- Added deterministic regression tests for multiple due tasks, duplicate ayah ranges across plans, repeated schedule dates, and paused/inactive/completed exclusions.
- Preserved current main UX in Mushaf spread, Tafsir pane, profile-synced audio preferences, and session view; merged candidate's audio failure recovery guard instead of replacing the newer session UI.
- Integrated local-first audio resolution into Quran Library, Mushaf page/spread playback, and memorization sessions. Playback now resolves verified downloaded audio from the local audio library before network fallback and releases object URLs on stop/completion/error; study segment downloads resolve only the selected range.
- Integrated the optional pinned Tafsir Muyassar package into Settings and added an explicitly labelled local fallback for edition 16 when online retrieval fails. Other Tafsir editions are not silently substituted.
- Integrated 604-page Mushaf offline package controls while preserving the newer main PrintedMushafSpread layout; the page service checks the validated offline cache before network.
- Added an offline reader integration test suite and registered offline Tafsir/audio proxy suites in the aggregate runner.
- Current execution branch is 60+ commits ahead of main and 0 behind at last compare. No merge or production deployment has occurred.
- Full tests have intentionally NOT been run yet, per the agreed batch workflow; implementation/reconciliation continues first.
- Remaining Phase 1 review items: inspect all changed-file imports and dependency assumptions; ensure no unused or disconnected offline UI paths; confirm exact current PR security advisory status; review PWA and data recovery boundaries. Then proceed through the remaining planned implementation phases before the full test matrix.

### Phase 1/2/3 integration addendum — 2026-11-18

- Individual plan-detail launches now pass the active plan ID and exact scheduled date through `PlanningEngineWizard` → `MemorizationPlansView` → `App`, in addition to dashboard and quick-start launches.
- Completion matching now fails closed if an old session has an ambiguous duplicate ayah range or a repeated range without its scheduled date. It will not guess and mark another plan's task complete.
- The facing Mushaf now mounts the full opposite-page Tafsir view on either side. Each side has Quran/Tafsir selectors; only one visible side is Tafsir at a time; preferences are local per reader surface and keyed by source page. Navigation from Tafsir resolves the actual printed page before restoring the Tafsir side.
- The single-ayah Tafsir pane now checks the complete pinned local Muyassar corpus before making a network request.
- Package manifest and Bun lock were reconciled with the current declared overrides; Vite/Tailwind build tooling was moved to devDependencies (not runtime). This addresses the prior stale lock resolution for esbuild and the declared gRPC override.
- Draft PR opened for continuous CI: https://github.com/xm8eslam-stack/WIRD-APP/pull/391. It targets current main and remains unmerged.
- The GitHub-reviewed high-severity picomatch advisory still has no official patched release in the upstream package at last check. The advisory is disputed by the upstream maintainer, but it remains present in the full audit; do not suppress or waive it. Keep production merge blocked until official remediation or explicit release decision.
