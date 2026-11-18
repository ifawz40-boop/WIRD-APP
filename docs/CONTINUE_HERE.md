# WIRD — Continuation Entry Point

**Last reconciled:** 2026-11-17 (Google AI Studio workspace)  
**Repository:** `xm8eslam-stack/WIRD-APP` · **Primary branch:** `main`  
**Last refreshed GitHub/Vercel checkpoint (2026-11-14):** `main` HEAD `f264e4bdea7496090f60940e9e8db03e2fb15696`; app-code merge `d265bdf37e9410ad6cd99273bb595526dce63b50`

> This is the authoritative current snapshot. Older dated snapshots below are historical evidence only. Re-fetch live GitHub/Vercel/Firebase state before merging or deploying.

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

## Latest continuation checkpoint — 2026-11-17 (GitHub recheck)

- Current `main` SHA observed: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- PR #380: current head `99408208b8bd4027b05ee544b908211911949c96`, base still `68dc6ea...`, `mergeable=false`; no GitHub workflow run found for this head. Vercel status context is green, but deployment source-SHA and browser smoke are not verified. Diff is non-runtime: artwork restoration, package/lockfile changes, and Playwright selector/flow updates. Reconcile with current main and rerun all gates; do not merge yet.
- PR #381: current head `d02a38154eaf6c2c48d5e6b05f1ba2b0decf03c2`. Quality Gate run `44103216018` (run #4446) failed on merge ref `502d3cea...` during frozen Bun install because `package.json` override `@grpc/grpc-js: 1.14.6` is not represented in `bun.lock`. Later gates skipped. Main currently has that override in its manifest but no `overrides` block in lockfile; PR #380 branch contains the block but is based on stale main. Keep #381 Draft.
- Exact latest branch file SHA for this tracker before this update: `b5e8fe83a265b2504c8719422b799d23fd5ef7cb`. This entry and the master plan are updated together after this checkpoint.
- No merge, production change, secret/config change, or sync-flag change was made.

**Next action for a new chat:** read this file and `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md` first; fetch live `main` and PR #380 metadata/diff; reconcile #380 on current main; obtain a green exact-head Quality Gate; only then rebase/revalidate #381. Never assume a historical SHA/check is current.

---

## Latest live PR graph — 2026-11-17

- `main`: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- #380: head `99408208b8bd4027b05ee544b908211911949c96`; branch diverged from main, 13 ahead / 2 behind, merge base `68dc6ea...`; `mergeable=false`. No GitHub Actions run returned for this head. Vercel context is not CI evidence. Rebase/reconcile and rerun all gates.
- #381: head `eb0c71ea09987e61c7a8b944866265e8ded4e5b3`; current PR merge ref `3f0430a4fd951de8fdbaa6223d3fb5f1c3f4c914`; no workflow run/status returned for that latest merge ref yet. Previous merge-ref run #4446 failed on frozen Bun install due to missing `overrides` in main's `bun.lock`. The latest docs commits may trigger a new run; re-fetch it before proceeding.

**Continuation instruction:** first inspect the current #381 workflow on merge ref `3f0430a...`; then reconcile #380 with current main. Keep both PRs Draft/HOLD until their exact merge-ref checks pass. Read `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md` for the full roadmap, gap matrix, safeguards and evidence history.

---

## Latest source-level audit — 2026-11-17 (main SHA f70bf5e)

The four approved roadmap tracks are **not greenfield**. Source audit has identified substantial existing implementations; read Section 7 of `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md` for exact paths/SHAs and gaps.

- Hifz: cumulative mode, progressive masking, cumulative audio range, and weak-ayah capture exist in `MemorizationSessionView.tsx`; durable guided-session state/resume and full staged workflow remain unproven.
- Missed-day recovery: all three recovery transforms and UI choices/confirmation exist; no computed before/after schedule preview was found. Local-text test generator supports all/surah/weak-priority and missing-word mode.
- Archive: actual `wird-sync-journal` IndexedDB v10 archive stores, SHA-256 manifest verification, AuthGate awaited hydration, and atomic journal/outbox commit exist. Aggregate archive bounds and chunked remote transport remain gaps.
- Offline: audio manager UI, approved-reciter range downloads, two-worker cap, quota preflight, cache generation/read-back, reference-aware deletion, local-first playback and app-shell preparation exist. Web Locks fallback, crash-orphan sweep, and real-device offline restart proof remain gaps. EveryAyah remains stream-only.
- Docs `OFFLINE_CAPABILITY_MATRIX_AR.md` and `OFFLINE_AUDIO_STORAGE_CONTRACT.md` are partly stale and need reconciliation after audit.

**Exact source audit base:** `main` `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. This is source inspection, not test pass or Production verification.

## Durable continuation instructions

- Canonical roadmap and audit: `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md` (Section 7 is the latest source map and gap assessment).
- Continuation branch: `docs/advanced-hifz-offline-roadmap-20261117`; PR #381: https://github.com/xm8eslam-stack/WIRD-APP/pull/381. Fetch its current head before editing; the tracker itself is updated by commits on this branch.
- Main baseline used for the source audit: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. This is not a claim that main is still at that SHA; refresh it live before code changes.
- Do not rebuild existing features in parallel. Inspect the exact source gaps recorded in Section 7, then create narrow implementation PRs with exact-head CI, tests, and dated tracker updates.
- Do not merge #380 or #381 based on Preview status alone. #380 is diverged from main and has no current-head GitHub Actions run; #381's last inspectable Quality Gate failed frozen Bun install on the older merge ref. Latest checked #381 merge ref `49dfc447...` had no workflow run/status returned yet; re-fetch.

## Last observed tracker-PR check — 2026-11-17

Immediately before this note update, PR #381 was Draft/open, branch head `ecfe66a8023f6522f6dafcf28148a316d6623dec`, merge ref `b5cc51532698dddbc5a9168ce1afd33d882808f5`, mergeable=true; no GitHub workflow run or combined status was returned for that merge ref. This note update itself creates another commit on the same branch, so **always fetch the live PR head and merge ref at the start of a new chat** rather than treating the SHA above as current.

## Latest dependency repair PR — 2026-11-17

- PR #382: https://github.com/xm8eslam-stack/WIRD-APP/pull/382 — clean branch from current main; one-file lockfile-only repair. Head c98a31f7a1a9ee41f1489b15609d3c2ccce18e69, merge ref cf378fb15af4e9423154c34dbaaf79b13139312d.
- Pre-PR structural validation: workspace name, dependencies, devDependencies, overrides, trustedDependencies all match manifest. Exact comparison: one changed file, bun.lock only.
- Quality Gate run #4452 / 44105033897: frozen install and Bun dependency audit passed; automated tests in progress at last check. Recheck every remaining gate on exact merge ref before any merge.
- PR #380 remains Draft/HOLD: branch diverged from main, and its added binary is in .aistudio/.../.tempmediaStorage/, not a verified brand asset. Its test patches are partly stale against current main. PR #382 excludes both the temp artifact and old tests.

## PR #382 latest CI state — 2026-11-17

Run #4452 (`44105033897`) on head `c98a31f7a1a9ee41f1489b15609d3c2ccce18e69` / merge ref `cf378fb15af4e9423154c34dbaaf79b13139312d` is still running. Frozen install, dependency audit, automated tests, native API imports, audio CDN/range, Firestore Rules, TypeScript, build and server smoke all passed. 604 Mushaf coordinate step was skipped due lockfile-only diff, not run. Desktop/mobile Playwright is in progress; Chromium and Node 26 setup succeeded. Keep Draft until the final run concludes green.

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


---

## Latest continuation checkpoint — 2026-11-17 14:42 UTC (PR #382 still running)

- Live PR #382 remains OPEN / Draft / mergeable=true / not merged.
- Exact head remains `c98a31f7a1a9ee41f1489b15609d3c2ccce18e69`; merge ref remains `cf378fb15af4e9423154c34dbaaf79b13139312d`; base SHA remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- Quality Gate run #4452 / ID `44105033897`, job `134114950644`, still reports `in_progress`. Desktop/mobile Playwright step #21 is still `in_progress`; diagnostics upload and post-job cleanup are pending.
- Completed successfully on this exact run: Node/Vercel runtime, Bun setup, frozen lockfile install, dependency graph audit, automated test suites, native TypeScript API imports, approved audio CDN/range, Firestore Rules Emulator, TypeScript, production build, and server startup smoke.
- The 604 Mushaf coordinate-map validation was `skipped`, not passed. Because PR #382 changes only `bun.lock`, this may be an intentional path filter; it must remain recorded as skipped.
- Attempt to retrieve the running job log returned GitHub Azure `BlobNotFound` (404). Do not infer Playwright result from this.
- Re-reviewed PR #382 patch: only `bun.lock` is changed; manifest root settings/dependencies, trustedDependencies and `@grpc/grpc-js` override are represented. No runtime/Quran/Firebase/Vercel files changed.
- PR #381 tracker remains OPEN / Draft / mergeable=true, head `03306460b695f0e48b8def6ab018c165fb0464f0`. Its canonical files are `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md` and this file.
- **Next:** re-fetch run #44105033897 until terminal. If Playwright succeeds and cleanup finishes, re-fetch #382 head/base/mergeability and final patch; verify all applicable checks then merge using expected head SHA `c98a31f...`. If Playwright fails, inspect diagnostics and fix only on a new narrow PR. After #382 merge, update/rebase this tracker branch against the new main and begin the first source-gap implementation PR (durable Hifz session recovery is a strong first candidate).
- No merge, production deployment, Firebase change, secret/config change, or sync-flag change has occurred in this checkpoint.


## Latest continuation checkpoint — 2026-11-17 (PR #382 gate failed)

- PR #382 is still OPEN / Draft / mergeable=true / not merged. Exact head `c98a31f7a1a9ee41f1489b15609d3c2ccce18e69`; merge ref `cf378fb15af4e9423154c34dbaaf79b13139312d`; base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; only changed path is `bun.lock`.
- Quality Gate run #4452 / `44105033897`, job `134114950644`, terminal conclusion **failure**. Passed: frozen Bun install, dependency audit, automated suites, native API imports, audio CDN/range, Firestore Rules Emulator, TypeScript, build, server smoke. Mushaf 604-map check was **skipped**. Playwright: **160 passed, 2 skipped, 4 failed**.
- The four Playwright failures are two scenarios failing on both desktop and mobile: (1) synthetic Ctrl+KeyB shortcut test cannot find the collapsed sidebar toggle at `e2e/app-shell.spec.ts:164`; (2) audio load-error test sees stale `جارٍ تحميل التلاوة` status after manually calling mock `onerror` at `e2e/memorization-audio-repeat.spec.ts:115`.
- Source review shows the audio `onerror` handler does clear `isAudioLoading`; test does not await async offline source resolution/mock creation before invoking `onerror`, so a race is plausible but unproven. Sidebar failure root cause is still unknown. Do not weaken tests or alter app code without reproducing and reading artifact error contexts.
- Playwright diagnostics artifact: `playwright-smoke-results`, ID `14338856662`, SHA-256 `978ba2e18968257d614fe2451cfe919fd9eb3ec1c0c4dda0675f1daf3b491c11`. Artifact not yet extracted in this checkpoint.
- PR #381 tracker is OPEN / Draft; update this tracker only after re-fetching its current head/blob SHAs. Canonical plan: `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md`.
- **Next action:** obtain/extract artifact `14338856662`; inspect `error-context.md` for both scenarios; compare test results on unchanged main and PR #382 merge ref; make a separate minimal fix for proven root cause(s); run exact-head Quality Gate. Keep #382 and #381 Draft/HOLD. No merge or Production/config/secret/sync-flag change.


## Continuation checkpoint — 2026-11-17 22:40 +02:00

- Re-fetched GitHub state. Repository default branch remains `main`; latest verified historical baseline in this workstream is `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. Do not assume that baseline is still the live HEAD without re-fetching it.
- PR #382 exact head `4332ea4cc4b2fa75e99d3e7a5dee22e2391b6f34`: frozen install PASS; full dependency audit FAIL on high-severity `picomatch@4.0.7` ReDoS advisory GHSA-fc5q-39xc-vjpf. Keep the audit blocking; do not suppress, downgrade, or pin an incomplete upstream patch.
- Quality Gate run #4467 (`44168185637`): unit suites PASS (756 passed), Firestore Rules Emulator PASS (31), native API import PASS, approved audio CDN/range check PASS, but Playwright failed one mobile audio idle-state assertion in `e2e/memorization-audio-repeat.spec.ts` (expected no audio status node after stopping; timed out). This is a real E2E failure, separate from the security audit.
- PR #383 initial exact-head run #4468 (`44168397712`): unit suites PASS (754 passed), Firestore Rules Emulator PASS (31); TypeScript failed in `src/App.tsx` because optional `day.memorizationTask` was spread into required `ScheduledTaskUnit`, and in `DashboardView.tsx` because the blocked daily-task union has no `enginePlanId`. Build/browser stages were skipped.
- Applied narrowly scoped source fixes on PR #383 branch `fix/dashboard-multiple-due-plan-tasks-20261117`: App.tsx now captures the already-filtered task as a non-null `task` on the match record and spreads that value; DashboardView forwards `enginePlanId` only for the non-blocked branch. Commits: `a2773fdc55e29975d16bfc0d0dbb4445cfffae4e`, `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`.
- Latest PR #383 head is `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`. At checkpoint time, no GitHub Actions run was associated with this new head; Vercel Preview was blocked by Free-plan `build-rate-limit`. Therefore the TS fixes are committed but NOT VERIFIED. Re-fetch workflow runs/status before proceeding.
- PR #384 head `022c1dd1cd5435f9c54a152e918e815dd601bbf5`, PR #385 head `10529d88e358b35a63c7b41060ffe966141d54e2`, PR #386 head `e3e26f26ac684fb97c0b1cffc636e1e5d5aa12db`; all remain Draft/unverified. PR #385 had a Vercel success context for its exact head; #384/#386 previews were blocked by build-rate-limit. PR #386 has no Actions run because it targets a feature branch and workflow evidence must be rechecked after trigger changes.
- PR #380 remains stale Draft/HOLD; do not merge. PR #381 remains documentation-only Draft in this checkpoint; keep this tracker updated in subsequent implementation commits.
- No merge to main, Production deployment, Firebase mutation, Vercel settings/secrets changes, or sync-flag changes were made. No production readiness is claimed.

### Next exact actions
1. Re-fetch PR #383 and workflow runs for head `8c7c5cd...`; if no run exists, inspect the PR workflow trigger and create a safe main-targeted validation path without merging unverified runtime changes.
2. Validate the TypeScript fixes, then resolve the mobile audio E2E failure with a behavior-correct assertion/fix (do not weaken the test to hide a real state issue).
3. Resolve the picomatch advisory only through a complete, reviewed upstream fix or safe dependency graph update; keep `bun audit --audit-level=high` blocking.
4. Only after parent gates pass, validate #383 on exact head, then #384, #385, #386 in dependency order with full desktop/mobile/offline coverage.
5. Update this file and `docs/CONTINUE_HERE.md` with exact SHAs, run IDs, failures, and verification results. Merge/publish only after all required gates and user-requested acceptance criteria pass.


## CI follow-up — 2026-11-17 22:55 +02:00

- PR #383 exact head `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`, Quality Gate run #4474 (`44171290167`) completed.
- Main validation job PASS: 756 unit assertions, 31 Firestore Rules Emulator tests, API import smoke, Quran audio CDN smoke 8/8, production and development server JSON smoke, TypeScript/lint, production build, and Playwright 164 passed / 0 failed (desktop + mobile Chromium).
- The two earlier TypeScript failures in #383 are resolved and verified on this exact head. The prior mobile audio idle-state Playwright failure did not reproduce in this full exact-head run; 164 E2E tests passed. Do not claim that this proves a dedicated audio fix unless separately verified.
- Overall Quality Gate remains FAIL solely because the complete dependency audit reports `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366, High severity ReDoS. The official GitHub advisory currently lists no patched version. Upstream picomatch PR #194 is an extglob parsing correctness change and explicitly says it does NOT fix the remaining repeated-extglob ReDoS shape `+(*a)`; it is not an acceptable security remediation for this advisory. Do not force an override to an unverified/nonexistent release, suppress the audit, downgrade the gate, or merge while this gate is required.
- Exact-head PR #383 is functionally green for unit/TS/build/Playwright/Firestore but remains Draft/HOLD pending a vendor-supported security fix or a reviewed architecture change that removes the vulnerable dependency without bypassing audit coverage.
- No merge, production deploy, Firebase data/rules change, Vercel settings/secrets change, or sync-flag change occurred.

### Next actions
1. Keep #383 Draft. Monitor the official picomatch advisory/release for a verifiably patched version and inspect its upstream regression tests before updating the lockfile.
2. If no patch is available, evaluate a supported Vite/toolchain version that removes picomatch from the resolved graph; prove compatibility with build, preview, test and dev server before changing dependencies.
3. Once security gate is genuinely clean, rerun the full exact-head Quality Gate and review #383's dashboard behavior with three active plans, duplicate ayah ranges across plans, overdue tasks, pause/inactive/future/completed cases, and reload persistence.
4. Continue #384–#386 only with the same exact-SHA gates and keep the offline-readiness plan as the release criterion.


## Integration / CI recheck — 2026-11-17 23:05 +02:00
- PR #383 exact head `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341` Quality Gate run #4474: functional validation job PASS (756 unit assertions; 31 Firestore Rules tests; API/audio/server smoke; TypeScript; production build; 164 Playwright tests passed). Overall gate remains FAIL only at `bun audit` for `picomatch@4.0.7`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366. The official advisory has no patched version listed. Keep all dependent PRs Draft/HOLD.
- PRs #384, #385, #386 have no workflow runs associated with their current exact heads. Their current CI status is NOT VERIFIED, regardless of older Preview statuses.
- Branch ancestry is not a clean linear stack: #384 head vs #385 head compares as diverged (14 commits ahead / 4 behind; merge base `3f59506204e21f702749159333162e80ab2f324d`). #386 is ahead of #385 by 92 commits with no divergence. #384 head vs #383 head is also diverged (19 ahead / 13 behind; merge base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`). Therefore do not assume #384/#385/#386 are safely sequential or merge them by number; first reconcile branch ancestry and overlapping Mushaf/AyahNavigationControls files, then run integration tests.
- #385 and #386 both touch Mushaf reading/navigation code; #386 is based on #385. #385 has copied/shared navigation changes but is not a descendant of #384, so a later merge of #384 may conflict or overwrite behavior. Resolve this deliberately before integration.
- No PR merge, production deploy, Firebase/Vercel configuration change, secret change, or sync-flag change.

## Live GitHub reconciliation — 2026-11-17 (continued session)

This addendum supersedes older status snapshots above where they conflict. It is a repository/CI checkpoint, not a Production verification.

### Live repository and PR state
- Live `main` remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- PR #382 is OPEN/DRAFT, head `4332ea4cc4b2fa75e99d3e7a5dee22e2391b6f34`, based on main. Its actual diff is **four paths**, not lockfile-only: `.github/workflows/ci.yml`, `bun.lock`, `e2e/app-shell.spec.ts`, and `e2e/memorization-audio-repeat.spec.ts`. It adds all-branch PR CI triggering and separates the security audit from application tests. Exact run #4461: frozen install PASS; complete dependency audit FAIL on picomatch.
- PR #383 is OPEN/DRAFT, base `fix/main-bun-lockfile-alignment-20261117`, head `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`. Exact Quality Gate #4474 / run `44171290167`: application validation job PASS (756 unit assertions, 31 Firestore Rules Emulator tests, API/audio/server smoke, TypeScript, production build, Playwright 164 passed / 0 failed); separate complete dependency audit FAILs on the high-severity picomatch advisory. No merge or deploy.
- PR #384 head `022c1dd1cd5435f9c54a152e918e815dd601bbf5`, #385 head `10529d88e358b35a63c7b41060ffe966141d54e2`, #386 head `e3e26f26ac684fb97c0b1cffc636e1e5d5aa12db`: no GitHub Actions workflow runs associated with these exact heads at this recheck. They remain NOT VERIFIED.
- PR #381 tracker branch head `70721397ea30c055cb443e8d9e85a2f6262237bf`; its merge-ref Quality Gate #4477 failed before tests at `bun install --frozen-lockfile`, because the main-based documentation branch does not include the manifest/lockfile override alignment from #382. This is a stale-base lockfile failure, not evidence of runtime-code failure. Keep #381 Draft; rebase/retarget only after deliberate integration planning.
- Branch graph remains unsafe to merge by PR number: #384 vs #385 diverged 14 ahead / 4 behind (merge base `3f59506204e21f702749159333162e80ab2f324d`); #386 is 92 commits ahead of #385 and descends from it; #384 vs #383 diverged 19 ahead / 13 behind (merge base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`). Reconcile the shared Mushaf/navigation files before integration.

### Security finding confirmed from the resolved lock graph
- The actual locked chain is `vite@8.3.5 > tinyglobby@0.2.17 > fdir@6.5.0 > picomatch@4.0.7`. Vite itself also declares `picomatch: ^4.0.7`; tinyglobby declares `picomatch: ^4.0.4`.
- GitHub Advisory `GHSA-fc5q-39xc-vjpf` / `CVE-2026-112366` still lists versions through 4.0.7 as affected and patched version as unknown. The latest audit log reports exactly one high finding on this package.
- Do not force an older picomatch version outside upstream dependency ranges, pin an unmerged PR, suppress the advisory, or downgrade the audit threshold. No safe released fix was verified in this session.
- Official references: https://github.com/advisories/GHSA-fc5q-39xc-vjpf and https://github.com/micromatch/picomatch/issues/247 .

### Next actions
1. Keep #382/#383 and #384–#386 Draft/HOLD; no Production changes.
2. Re-check the upstream picomatch advisory/releases and evaluate a supported toolchain change only if its complete lock graph removes the vulnerable package without invalid overrides.
3. Once the dependency gate is clean, rerun the full exact-head Quality Gate on #383 and its integration head.
4. Reconcile #384 navigation with #385/#386 Mushaf/Tafsir changes in a single deliberate integration branch; then run all desktop/mobile and offline E2E on the exact final SHA.
5. Continue the broader offline audit: cold restart/airplane mode, downloaded audio lifecycle, IndexedDB quota/resume/corruption, local Quran/tafsir reads, PWA cache updates, and plan archive/recovery.
6. No merge, deployment, Firebase/Vercel settings/secrets, or sync-flag change was made in this recheck.

## Offline Tafsir manifest recovery fix — 2026-11-17

- A second-pass source review of PR #386 found a recoverability defect in `getOfflineTafsirDownloadStatus()`: it trusted only `manifest.downloadedSurahs`. If the browser closed after a validated surah record was committed but before its manifest update, or if the manifest was missing/stale, the UI could report zero even though valid offline tafsir records were present. Resume logic already scanned the actual records, so the status panel and resume behavior could disagree.
- Fixed on PR #386 branch `feat/offline-tafsir-opposite-page-20261117`:
  - Service change commit: `41e4eefcf62af8b02fd2c02eac27b2fb166579d1`.
  - New unit-test file commit: `ed56c26bbb6aa1e262fb187db99dca7152c3aef5`.
  - Test-runner registration commit: `ca5b3d0a13453b9c208e0ba3fcafa02201284b8f`.
  - Current PR #386 head at this checkpoint: `ca5b3d0a13453b9c208e0ba3fcafa02201284b8f`.
- Status is now derived from individually validated IndexedDB records; a missing/stale manifest no longer hides saved surahs. A manifest's `complete` marker cannot make an incomplete record set appear complete.
- Added five pure regression cases: missing manifest recovery, stale manifest list recovery, invalid payload rejection, stale source-version rejection, incomplete records with a false complete marker, and empty-package behavior (the suite currently contains five grouped tests).
- Exact-head Quality Gate run #4481 / `44173595935` was observed queued then in progress. **No pass/fail result is claimed yet**; fetch the final run result and inspect both jobs after completion.
- This fix does not change Quran text, tafsir source/payload, Firebase, Vercel settings/secrets, sync flags, or Production. PR #386 remains Draft/HOLD until exact-head CI and integration checks pass.

## Tafsir reader CI regression correction — 2026-11-17

- Quality Gate #4481 on the earlier #386 head `ca5b3d0a13453b9c208e0ba3fcafa02201284b8f` confirmed all five new offline-tafsir recovery tests PASS.
- The application job failed one existing static source assertion in `src/tests/quranMushafReader.test.ts`: it expected `setPage(page + 1)`, while the facing-page implementation correctly uses `setPage(page + pageStep)` with a one-page/two-page step. This was a stale test expectation, not a runtime failure.
- Updated the assertion to require the page-step contract and expanded the Mushaf 604-page coverage condition to run for Tafsir PRs/branches, since the opposite-page feature changes `QuranMushafReader.tsx`.
- Commits: assertion correction `7362bd813bc55b70efe28e2f4e2ec4b32d05e39a`; CI coverage condition `d3cc59dc15160e8a367ad3189742b3d962ca9c14`.
- New exact-head Quality Gate #4484 / `44173785987` is queued on #386 head `d3cc59dc15160e8a367ad3189742b3d962ca9c14`. Its result is pending; do not claim the regression is cleared until the new run completes.
- #386 remains Draft/HOLD. No merge, Production deployment, Firebase/Vercel settings/secrets, or sync-flag changes.

## Latest PR #386 exact-head run — 2026-11-17

- Fixed the TypeScript fixture error in `src/services/tafsirOfflineLibrary.test.ts`: explicitly typed the source-version fixture parameter as `string` so the stale-version test value `0.9.0` is accepted. Commit `e6efc84febe2ca63319f857c567db110183d01ff`.
- Current PR #386 head: `e6efc84febe2ca63319f857c567db110183d01ff`.
- Quality Gate #4486 / `44173952341`: application checks observed PASS so far — frozen install, full unit suite (**759 passed / 0 failed**), 604 Mushaf page/ayah coverage, API import smoke, Quran audio CDN/range smoke, Firestore Rules Emulator, TypeScript, production build, and production server startup smoke.
- Desktop/mobile Playwright browser installation was still in progress at the last check; browser tests and overall application job are therefore **PENDING**, not yet passed.
- Separate dependency security audit completed FAIL on `picomatch@4.0.7` / `GHSA-fc5q-39xc-vjpf`. This remains the only observed audit finding and continues to block merge/release.
- No merge or Production deploy. Firebase/Vercel settings/secrets and sync flags remain unchanged.

## Latest #386 exact-head run #4486 — 2026-11-17

- Latest #386 head: `e6efc84febe2ca63319f857c567db110183d01ff`.
- Run #4486 / `44173952341`: automated suites PASS with **759 passed / 0 failed**; all 604 printed Mushaf page coordinate maps verified; API imports and approved Quran audio CDN/range smoke PASS; Firestore Rules Emulator PASS; TypeScript PASS; production build PASS; production server startup smoke PASS.
- At last inspection, browser smoke (desktop/mobile Playwright) was still in progress; do not claim the entire application job has passed until that job concludes.
- Dependency security audit has conclusively failed again on `picomatch@4.0.7`. Current official GitHub Advisory still reports no known affected/patched version boundary and links the upstream tracking issue; no safe released remediation is verified. See https://github.com/advisories/GHSA-fc5q-39xc-vjpf and upstream https://github.com/micromatch/picomatch/issues/247.
- The TypeScript issue from run #4484 was fixed by widening the stale-version test fixture parameter from the literal source-version type to `string`; run #4486 confirms TypeScript now passes.
- PR #386 remains Draft/HOLD due the audit gate and pending browser result. No merge/deploy or production configuration changes.


## Follow-up inspection — run #4486 audit evidence / main unchanged — 2026-11-17

- Re-polled Quality Gate #4486 (`44173952341`) on PR #386 exact head `e6efc84febe2ca63319f857c567db110183d01ff`.
- Application job `134360175934` remains in progress specifically at **Desktop and mobile browser smoke tests**. Its prior steps remain successful; do not report Playwright or the complete application job as passed yet. GitHub's job-log endpoint currently returns BlobNotFound while the job is running, so no browser result is inferred.
- Audit job `134360175493` is conclusively failed. Its log confirms the exact chain `vite > tinyglobby > fdir > picomatch`, resolved `picomatch@4.0.7`, and one High finding: `GHSA-fc5q-39xc-vjpf` (single-branch repeated-extglob ReDoS). Frozen install succeeds; this is not a lockfile install failure.
- Rechecked `main` against the last known baseline `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`: compare status **identical**, 0 ahead / 0 behind. Production branch has not moved in this work.
- PRs #383–#386 remain open Draft/HOLD; no PR merge, Production deploy, Vercel/Firebase settings or secrets change, or sync-flag activation.
- Next: poll #4486 until Playwright and the application job terminate; then record the final exact-head outcome. Security gate remains a separate hard blocker regardless of browser outcome.


## Newest continuation pointer — 2026-11-17

Read [PR #386 browser diagnosis checkpoint](./checkpoints/2026-11-17-PR386-4486-browser-diagnosis.md) before continuing. It records the final #4486 Playwright failure analysis, the two corrective commits, new run #4491, current dependency security blocker, and refreshed branch ancestry. Re-fetch run #4491 and current PR heads before taking further action.

- Offline audio/app-shell integration audit: [2026-11-17 checkpoint](./checkpoints/2026-11-17-offline-audio-integration-audit.md). PR #366/#368 remain stale Draft foundations; explicit audio downloads still lack worker/UI/playback/cross-tab and real-device offline proof.

- Latest integration checkpoint: [2026-11-17 latest work](./checkpoints/2026-11-17-latest-integration-work.md). Current #386 head is `e0c7d9d...`, Quality Gate #4494 is running, #4491 was cancelled by a subsequent push, and weak-verse navigation has been ported from #384.

- PR #386 latest head updated after TypeScript correction: `6c62465d97e855701217ce2e3b8fe00d0574ba58`. See the latest integration checkpoint for #4494's 759 unit passes / 31 Rules passes / TS failure and the narrow prop-type correction; fetch a new exact-head run before proceeding.

- Cumulative release integration is tracked in existing Draft PR #387, current head `199743fa60974ee650d51e6579bb5db87fba6487`. Exact-head Quality Gate #4504 (`44179885024`) has the security audit failed separately and the application job running. The latest checkpoint records the integration tree and workflow correction; re-poll #4504 before any status change.

- PR #387 now also preserves the originating engine plan ID in the session URL so refresh/reopen cannot route completion to a different plan when ranges overlap. Latest head `6d7f435dd2caca3cc400783fc2a7ee152f3e1fd1`; tests added. Run #4504 is still validating the preceding head; fetch a new exact-head run after it concludes.

- PR #387 route persistence now includes the nullable in-app RouteState typing correction at exact head `abe008dc1b03e1e04c6f7497bfd6138b4728cb19`. Quality Gate #4511 (`44180386559`) is running; last poll was 604-page coverage, with the audit separately failing on picomatch.

- Offline readiness matrix refreshed on the documentation branch: `docs/offline/OFFLINE_CAPABILITY_MATRIX_AR.md`. It distinguishes PR #387 implementation from release verification and records that pinned offline audio, cold-start airplane-mode proof, and full route acceptance remain outstanding.

- PR #387 exact-plan completion matching is now extracted and tested for duplicate ranges across plans. Current head `be3188764505b601d7867d05b50f1a4a4c422223`; Quality Gate #4517 is pending, while #4511 was still in Playwright on the previous head. See latest integration checkpoint.

- Important correction from latest main source audit: main already has a full offline audio manager/library/cache/local-first playback; PR #368 is a stale alternate implementation and must not be merged as a duplicate store. Remaining gaps are job-level cross-tab worker lock/fallback (PR #388), cross-tab pause/cancel, crash-safe cache staging/orphan sweep, and real-device cold-restart airplane playback. The current Vite manifest also does not recursively include public assets; PR #366's narrow shell improvements need port/rebase. See the corrected `OFFLINE_AUDIO_STORAGE_CONTRACT.md` and capability matrix.

- PR #387's latest Playwright result (#4517) was 178 passed / 2 skipped / 2 failed, both from the new weak-verse test's nested locator; the actual navigation landmark was present in captured desktop/mobile snapshots. Test locator fixed at head `2532ddbcd985702ed2af84986c7dc3587ecf3303`; re-fetch exact-head CI.

- PR #389 adds durable Cache Storage staging/orphan grace cleanup and cross-tab pause/cancel propagation on top of #388. Initial run #4530 had 770 passed / 1 test-helper failure; corrected to use listJobs at head `00313ec2b42b0f9bd0e700a8a4b2d7cc29dc222d`. New exact-head CI pending.

- Cumulative PR #389 now targets `main` and includes the full release stack plus offline audio cross-tab leases, durable staging/orphan sweep, cross-tab pause/cancel, recursive public-asset precache manifest, 6s navigation fallback timeout, quota-adaptive runtime caches, and accurate persistence diagnostics. Exact head `6bec8fbabd260d3abcfd6e9f9ca1bbf960504057`; Quality Gate #4543 has audit FAIL on picomatch and application job running at 604-page coverage. Continue polling before any release decision.

- Clarification for PR #389: recursive public-asset manifest does not include the 604 external Quran.ws Mushaf SVG pages; those remain a bounded on-demand runtime cache. A separate optional full-604-page download package is still outstanding and must be quota-preflighted/resumable. Local Quran text remains independent of facsimile images.


## Checkpoint 2026-11-18 — full offline Mushaf package candidate

- New PR #390: https://github.com/xm8eslam-stack/WIRD-APP/pull/390 — Draft/HOLD, branch `feat/offline-mushaf-package-20261117`, currently based on `main` and includes cumulative candidate code from PR #387/#389 plus full offline printed-Mushaf work.
- Offline printed-Mushaf package: all 604 pinned Hafs/KFGQPC SVG pages; sample pages 1/300/604 for size estimate; 1.35 safety factor; 32MB/15% storage reserve; sequential verified caching; resume; pause; inspect status; delete. Reader checks the versioned Cache Storage package before network. Local Quran text/ayah data remain authoritative.
- Settings now offers the optional package and removes the inaccurate “100% offline” claim. It explicitly warns that the artwork package may consume hundreds of MB and that offline readiness depends on downloading optional external content.
- Added unit/source checks and E2E that seeds page 1 in the dedicated cache, switches the browser offline, and expects printed page rendering without any external request.
- New candidate commit sequence includes `b7e6c537...`, `1e7ef121...`, `33e5ee4b...`, `c5ec160f...`, `6e80d237...`, `3bc565c0...`, `003a4407...`, `665cd02f...`, and latest docs commit `8ee956df...`. Confirm latest branch head before test assertions.
- PR #389 exact-head run #4550 (`44186321154`) is still running its desktop/mobile Playwright job; audit job fails on picomatch. Do not treat #4550 as validation for PR #390 because #390 adds new source and E2E tests.
- Next: confirm #390 exact-head CI starts; inspect and fix any TypeScript/unit/Playwright issues; poll #4550 and verify the QuranEnc version fixture change. Security audit remains blocking due picomatch@4.0.7 GHSA-fc5q-39xc-vjpf. No merge/deploy.


### PR #390 exact-head test corrections — 2026-11-18

- Run #4550 (`44186321154`) confirmed the QuranEnc metadata fixture correction: the partial-download resume test passed on both desktop and mobile. The remaining Playwright failures were the weak-verse navigation test's stale `.wird-card` nested locator (desktop + mobile); ported the verified fix from PR #387 commit `2532ddbcd985702ed2af84986c7dc3587ecf3303` into #390 as `a892d5e378e9b5ec3bfa2598640c2218a28ddd3f`.
- Added `e2e/offline-mushaf-package.spec.ts`: simulates one interruption at page 4, resumes the 604-page download, asserts page 1 is not redownloaded and page 4 is retried once, then opens the printed page after browser offline mode without a second page-1 request.
- Tightened the offline package so every newly downloaded and cached SVG is validated/sanitized and its ayah coordinates are resolved against WIRD local Quran chunks before it is counted. Cache status remains readable even if StorageManager quota estimation is unavailable; only starting a bulk download requires quota estimation.
- Latest PR #390 head `5b953e3a47bf75ea33607abe5a62af8ca4aa6e65`. Exact Quality Gate #4560 / run `44187977275` is pending. Earlier #4558 was cancelled when the test follow-up was pushed. Audit remains red on picomatch@4.0.7. Poll #4560 through unit, all-604 validator, Firestore, TypeScript, build, smoke and Playwright before next action.

- Playwright harness correction: the full 604-page synthetic download test now blocks Service Worker control for its isolated context, because the SW's own external Mushaf runtime-cache handler would bypass page-level route mocks and risk downloading the real upstream artwork. Cache Storage remains available and is still directly exercised. Latest PR #390 SHA `ae074cbeda26829198bba3ba4478986401709b2c`; exact run #4563 (`44188618781`) pending. #4560 does not validate this final harness revision.

- Source ancestry recheck: `main` remains at `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; PR #390 candidate is 187 commits ahead / 0 behind main. Compared with PR #387 head `2532ddb...`, the branch is still graph-diverged by one test-only commit, but that exact weak-verse selector change was ported into #390 as a normal file update. No runtime change was omitted from the one-commit gap. No merge or deployment.

- Added a real-device offline acceptance gate to `docs/offline/OFFLINE_CAPABILITY_MATRIX_AR.md`: iPadOS Safari + Android Chrome; three-plan due-task integrity; full app shell + 604 printed pages + 114-surah Tafsir + audio; cold close/reopen in airplane mode; quota/persistence denial; cache failure; update lifecycle; and local/cloud data isolation. CI/Playwright is not sufficient to claim cold-start offline readiness.

- Full checkpoint file: docs/checkpoints/2026-11-18-PR390-4563.md (exact candidate SHA, cumulative scope, current CI, security blocker, real-device gates, and safe continuation sequence).

- Security dependency detail rechecked against Vite v8.3.5 package manifest: Vite declares picomatch ^4.0.7 directly and also brings tinyglobby ^0.2.17. The current audit log reports the resolved path vite > tinyglobby > fdir > picomatch@4.0.7; this is not just an unrelated optional development package that can be removed by pruning a leaf. No safe released fix is available yet.

- Final public-asset allowlist review added JS/MJS/WASM extensions (in addition to CSS, images, fonts, JSON and webmanifest), still excluding sw.js. This ensures public worker/wasm assets are not silently omitted from the explicit app-shell package. Regression assertion added. Latest PR #390 head `086aac24baa380a0801e00e88b9e7c777b621010`; earlier run #4563 no longer validates this change; new exact-head Quality Gate required.

- Run #4563 diagnostic: unit suite 774 passed / 0 failed; Firestore Rules 31 passed / 0 failed; 604-page validator, TypeScript, production build and server smoke passed. Desktop new offline Mushaf package E2E passed in 5.4s. Mobile test timed out before opening Settings because it attempted a direct Settings button; on mobile Settings is inside the More drawer. Fixed test to open More then Settings under 768px; no app runtime navigation change. New exact-head run required for latest branch.

- Latest PR #390 head `3708e76432e89e00ce27f12cad8b64a1224aa9f1`; exact Quality Gate #4574 / run `44190087671` is in progress. The new run already passed the automated suite and all-604 Mushaf coordinate validator; Firestore Rules tests are running. Previous run #4563 desktop package test passed; mobile selector was corrected to navigate through the More drawer before Settings.


## Quality Gate #4574 completed — 2026-11-18
- Exact PR #390 head `3708e76432e89e00ce27f12cad8b64a1224aa9f1`; run `44190087671` completed. Application/test job SUCCESS; security audit job FAILURE only on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch` (GHSA-fc5q-39xc-vjpf / CVE-2026-112366).
- Unit suite: 774 passed / 0 failed. Firestore Rules Emulator: 31 passed / 0 failed. All 604 Mushaf coordinate maps, API module import smoke, approved Quran audio CDN/range smoke, TypeScript, production build, production server startup smoke all passed.
- Playwright: 184 passed / 0 failed / 2 intentional skips. Offline 604-page Mushaf partial-download/resume/open-while-offline passed on desktop and mobile. The two skips are complementary viewport-only tests: full offline app-shell asset download is desktop-only, while mobile settings reachability is mobile-only; both have separate coverage in the same run.
- Audit remains unresolved: official npm latest and official GitHub releases still show picomatch 4.0.7, no fixed version. No override, suppression, threshold reduction, or risk acceptance. Keep PR #390 Draft/HOLD; do not merge or deploy.
- PR #390 currently 44 changed files, 3,576 additions / 249 deletions, 190 commits ahead of main. Full review of the cumulative diff and integration scope remains required before promotion.


## MJS/WASM offline asset parity follow-up — 2026-11-18
- After #4574 passed, code review found an extension mismatch: public asset enumeration accepted `.mjs`/`.wasm`, while Service Worker MIME allowlisting and Vite-emitted asset filtering did not. A manifest containing these types would fail closed at download time.
- Updated `public/sw.js` to accept MJS JavaScript MIME variants and `application/wasm`; updated `vite.config.ts` emitted asset filter to include MJS/WASM; added regression assertions in `src/tests/pwaIntegration.test.ts`.
- Commits: `2ca6b0944d9cc90f6cef6e80446ebeb7d7df8a47`, `2e13ce6049c88e524988362b8debdba02ac9da79`, `0942f625477b3d053f2934d387942771efef20c9`.
- Latest PR #390 head is now `0942f625477b3d053f2934d387942771efef20c9`. Run #4574 validates only prior SHA `3708e76432e89e00ce27f12cad8b64a1224aa9f1`; a new exact-head Quality Gate is mandatory. PR remains Draft/HOLD; security audit remains unresolved.


## Offline Mushaf cache sanitization hardening — 2026-11-18
- Review found `fetchValidatedPage()` called `sanitizeMushafSvgMarkup(markup)` but discarded the returned safe string and cached the original response. The render path sanitized again, but the persistence invariant was inaccurate.
- Changed downloads and existing cached records to store the sanitized SVG response, remove stale content-length/encoding headers, and calculate byte estimates from the safe payload. Added an E2E malicious-attribute fixture (`onload`, unknown `data-*`) and assertions that cached SVG contains neither attribute.
- Commits: `588d4b63568ced30de83eaca1275a8bb020d237f`, `c90b9dae9bc03e1704c232caca4f9c3bfca6446d`.
- Latest PR #390 head: `c90b9dae9bc03e1704c232caca4f9c3bfca6446d`. Run #4582 was triggered before these commits; exact-head validation required. PR remains Draft/HOLD; audit remains unresolved.


## Offline audio and capability docs refreshed — 2026-11-18
- Verified Settings exposes user-initiated full Surah, Juz, and memorization-plan downloads using the curated Al Quran Cloud reciter allowlist. Pause, resume/retry, cancel and delete controls are present. The library is separate from opportunistic 20-ayah/40-entry playback cache, and EveryAyah remains stream-only.
- Updated `docs/offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md`, `docs/offline/OFFLINE_CAPABILITY_MATRIX_AR.md`, and `docs/offline/OFFLINE_FIRST_ARCHITECTURE.md` to remove stale statements that audio downloads were not implemented and that the 604-page Mushaf package was unavailable. The docs explicitly retain Draft/HOLD and real-device acceptance caveats.
- Documentation commits on PR #390 branch: `f9a52b5c03abdaafb353d25855e33cd77b975a08`, `88bf374f483b4a64811c5f70f53adc52eddc2896`, `7010ef67812f382e9e81569094a2b3e46d1e72a3`.
- Latest PR head now `7010ef67812f382e9e81569094a2b3e46d1e72a3`. The currently running #4585 was triggered before the last code and documentation updates; require a fresh exact-head Quality Gate.


## Offline audio job fingerprint collision fix — 2026-11-18
- Static review found that audio job identity used only scope, reciter, item count, first ayah and last ayah. Different disjoint ranges with the same count/endpoints could collide and return the wrong existing active job.
- Fingerprint now includes the exact ordered global-ayah sequence. Regression test creates two disjoint ranges with equal count and endpoints and asserts distinct jobs plus exact item lists.
- Commits: `c609b8b335c2c67d3c7779cad4f51e1819a8f568`, `0376e86aea1284c5f5c2fd4f64cd27b112226aee`.
- Latest PR #390 head: `0376e86aea1284c5f5c2fd4f64cd27b112226aee`. Previous run #4589 predates this change; a new exact-head gate is required. Security audit remains blocking.


## Legacy audio fingerprint migration — 2026-11-18
- Exact request fingerprints now use the ordered global-ayah sequence. Added IndexedDB DB v3→v4 migration that recalculates fingerprints from persisted job items in the versionchange transaction, preserving paused/queued states. Regression test seeds two v3 jobs with the old colliding count/endpoint key and verifies distinct migrated fingerprints.
- Commits: `17bf9b9301f9edd5dde3aadc149d85a66ae753de`, `dccf42f0e0b253fe83b24ead95285f5816d55709`, `e3f328e4c17f96f24592f33141c88a824f14aff0`.
- Latest PR #390 head: `e3f328e4c17f96f24592f33141c88a824f14aff0`. Run #4592 predates this migration; require a fresh exact-head gate. Security audit remains unresolved.


## Latest exact-head Quality Gate #4599 — in progress
- Current PR #390 SHA: `eb7394e5f86c5d9b2d3a155df04861bb8e634bea`; run `44235296378` / #4599 is running on this exact SHA.
- Automated unit suites, 604-page Mushaf coordinate validator, API import smoke, approved audio CDN/range smoke, Firestore Rules Emulator, TypeScript, production build and server startup smoke all passed. Desktop/mobile Playwright is in progress.
- Security audit failed on `picomatch@4.0.7` via Vite toolchain. Do not merge/deploy.


## Al Quran Cloud audio terms recheck — 2026-11-18
- Rechecked official provider Terms & Conditions (last updated 2026-11-13): audio CDN is free and needs no key; recitations remain copyright of the reciters/estates; streaming, embedding and downloading are permitted for personal and educational use; the terms warn that reciters may request removal if used in a commercial product. Official CDN documentation confirms the HTTPS ayah path pattern `https://cdn.islamic.network/quran/audio/{bitrate}/{edition}/{number}.mp3` and global ayah range 1–6236.
- WIRD's implementation downloads only user-selected, curated Al Quran Cloud editions to the user's device; it does not rehost or redistribute. Keep a release-time terms recheck and do not assume the same permission covers future commercial monetization.


## Quality Gate #4599 final results and dashboard UI regression — 2026-11-18
- Exact candidate SHA `eb7394e5f86c5d9b2d3a155df04861bb8e634bea`; application/test job PASS. `FINAL RESULT: 776 PASSED | 0 FAILED`; Firestore Rules Emulator 31/31; 604 Mushaf coordinate maps; API import smoke; approved Quran audio CDN/range smoke; TypeScript; production build; production server startup smoke all passed.
- Playwright: 184 passed / 0 failed / 2 intentional viewport skips (4.7m). Full 604-page Mushaf partial-download/resume/offline-open E2E passed Desktop 6.0s and Mobile 6.7s. Cached SVG sanitizer assertions passed. Audio exact-range fingerprint and v3→v4 migration tests passed in the unit suite.
- Security audit job still FAILS only on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch` (GHSA-fc5q-39xc-vjpf); no patched upstream release; no overrides/suppressions.
- Added a new dashboard E2E regression to `e2e/app-shell.spec.ts`: seeds three active plans, checks all due tasks appear with two additional quick-start actions, and verifies selected `plan` ID survives into the session route. Latest PR #390 head is now `c69f6dc15b7067bcd7d40f266d5ab7dbe35e36fe`; #4599 predates this test, so new exact-head CI required.
- PR #390 remains Draft/HOLD, main SHA remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; no merge/deployment.


## Latest Quality Gate #4604 — in progress
- Exact PR #390 head `c69f6dc15b7067bcd7d40f266d5ab7dbe35e36fe`; run `44236188421` / #4604. Automated unit suite, 604 Mushaf map validation, API import/audio smoke, Firestore Rules, TypeScript, production build, and production server smoke have completed successfully. Chromium installation is in progress before Desktop/Mobile Playwright.
- The run includes a new UI-level three-plan dashboard regression and selected-plan deep-link assertion. Security audit has already failed on the unresolved picomatch@4.0.7 advisory.

- Master execution tracker refreshed with the 2026-11-18 candidate state, exact #4599 evidence, #4604 in-progress UI regression, current security hold, and revised Phase 0/2/5 statuses. Commit: `e7af48be4ddcbe22f3c63248e84a0d87f4a73a19`.

- Master plan Phase 2 checklist updated: source terms/allowlist/EveryAyah boundary, unified IndexedDB audio repository, exact cache verification/recovery, cross-tab/concurrency controls, user controls, storage/readiness center, selective deletion, PWA install/Safari guide, and offline capability matrix are checked as implemented. Cold-restart/airplane-mode physical acceptance remains unchecked. Latest master-plan commit: `3450c951db1dd8e5780da426682ca26074551cf7`.


## Quality Gate #4604 completed + Service Worker cache v4 — 2026-11-18
- Exact tested SHA `c69f6dc15b7067bcd7d40f266d5ab7dbe35e36fe`; application job PASS: 776 unit assertions, 31 Firestore Rules, 604 Mushaf maps, API/audio smoke, TypeScript, production build/server smoke; Playwright 186 passed / 0 failed / 2 intentional viewport skips. New dashboard three-plan test passed Desktop 483ms and Mobile 527ms; offline Mushaf and sanitizer tests passed.
- Security audit job remains FAIL on `picomatch@4.0.7` through Vite toolchain; official npm latest and GitHub releases still 4.0.7, no fixed version. No bypass.
- After #4604, bumped Service Worker shell cache `wird-app-v3` → `wird-app-v4` so a failed SW install cannot overwrite the currently active shell cache. Activation cleans the old shell only after new worker readiness; explicit content cache `wird-app-content-v1` and dedicated audio/Mushaf caches remain preserved. Updated PWA unit and E2E assertions.
- Refreshed official Al Quran Cloud terms in the audio plan: personal/educational recitation downloads allowed; reciters retain copyright; commercial products may receive removal requests; no rehosting/redistribution assumed.
- Latest PR #390 head `c36d982e4b29385b56fecbbdd0fa82c0289a3e65`, 45 files (+3,822/-269), 211 commits ahead of main `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. #4604 predates cache v4 and doc changes; new exact-head Quality Gate required. Draft/HOLD, no merge/deploy.

- Exact-head Quality Gate #4616 / run `44237566210` is now running on PR #390 SHA `c36d982e4b29385b56fecbbdd0fa82c0289a3e65`; security audit has already failed on picomatch@4.0.7, application job is installing Chromium before Playwright.


## Upstream picomatch remediation watch — 2026-11-18
- Focused candidate [micromatch/picomatch#254](https://github.com/micromatch/picomatch/pull/254) open, updated 2026-11-18 00:52 UTC. Author reports 2,001 upstream tests and 22,860 parity checks; however it is from a fork, unmerged, has no GitHub status checks, and no maintainer approval visible. It changes capture semantics for some patterns.
- [#260](https://github.com/micromatch/picomatch/pull/260) is explicitly a partial mitigation with documented semantic tradeoffs and known limitations; unmerged and no GitHub status checks. #258 Draft; #261 unmerged proposal.
- None is an official patched release. Do not cherry-pick/vendor/override/suppress; security hold remains until maintainer-reviewed upstream release and advisory update.


## Exact-head Quality Gate #4616 — 2026-11-18
- Candidate PR #390 SHA `c36d982e4b29385b56fecbbdd0fa82c0289a3e65`; run `44237566210`.
- Application job PASS: Playwright 186 passed / 0 failed / 2 intentional viewport skips; 604 Mushaf coordinate maps; API import and approved Quran audio CDN/range smoke; Firestore Rules Emulator; TypeScript; production build; production server startup smoke. Dashboard multi-plan regression and offline Mushaf sanitized-cache/download/resume/offline-open checks passed on desktop and mobile. Offline Muyassar download/resume/corruption checks passed.
- Dependency security audit FAIL remains solely `picomatch@4.0.7` through Vite toolchain (GHSA-fc5q-39xc-vjpf, High ReDoS). No override/suppression. No merge/deploy.
- PR #390 remains Draft/HOLD. Physical Android/iOS/Safari cold restart + airplane mode and storage quota/eviction acceptance are outstanding. Exact-head app gate is green but overall release gate is not.


## 2026-11-18 — WIRD offline readiness continuation (PR #390)

### Active candidate and safety boundary
- Repository: `xm8eslam-stack/WIRD-APP`; candidate branch: `feat/offline-mushaf-package-20261117`.
- Integrated candidate PR: [#390](https://github.com/xm8eslam-stack/WIRD-APP/pull/390), still **Draft/HOLD**.
- Exact current candidate SHA at this checkpoint: `b9cfaabc8e7e884549f27508bb517f5de6064bdf`.
- `main` remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; no merge, production deployment, secret/environment change, Firebase/Vercel configuration change, or remote-sync flag activation.
- PR #390 is the integration candidate for the preceding offline/hifz work. Do not merge the older draft PRs #382–#389 independently; compare content first to avoid duplicate/conflicting integration.

### Changes added during this continuation
- Due-task identity now carries both plan ID and scheduled date from dashboard selections through the session route. Repeated identical ranges on different days no longer resolve to the wrong occurrence. The header “جلسة اليوم” action now passes the same date identity; navigation away/bare session links clear stale plan identity.
- Mushaf cache status now distinguishes key-presence from content validation. At 604/604, the action remains available as “إعادة التحقق من صفحات المصحف”, including offline when all pages are present. A corrupt cached SVG is removed and can be repaired when online. Added a Playwright regression for a 604-entry cache with one malformed page, then a second full verification offline.
- Durable offline audio is now wired across the normal Mushaf reader, Surah library, and memorization session. Approved reciters use `getLicensedAyahAudioUrl()`; stream-only reciters remain network-only. The Service Worker maps an approved CDN URL to the exact local IndexedDB file record and generation-keyed Cache Storage response before network fallback. Added an E2E that seeds one durable file and fetches it through the controlled worker with network disabled.
- The settings “check Mushaf cache” message no longer claims it verified the contents of all 604 files; it reports presence only.

### Exact-head Quality Gate
- Run #4639 / GitHub run `44241511583`, exact head `b9cfaabc8e7e884549f27508bb517f5de6064bdf`.
- Completed successfully so far: frozen Bun lockfile install, automated test suites, all 604 Mushaf coordinate maps, native API import smoke, approved Quran audio CDN/range smoke, Firestore Rules Emulator, TypeScript, production build, and production server startup smoke.
- Desktop/Mobile Playwright is still running at this checkpoint. Do not claim the new Service Worker audio test or the complete application job has passed until the run terminates and its logs are reviewed.
- The separate security audit job fails on High `GHSA-fc5q-39xc-vjpf` for `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`. Frozen lockfile installation itself passes; there is no current lockfile mismatch.

### Security remediation watch
- Official npm latest/release remains `picomatch@4.0.7`; no fixed upstream release is available at this checkpoint.
- Upstream PR #237 is approved but open/unmerged; review discussion identifies additional multi-branch patterns not covered. PR #238 is incomplete. PR #269 is newer but open without maintainer review/approval and changes complex-pattern behavior.
- Do not silence audit, add an arbitrary override, or vendor an unreviewed patch. Security remains a hard release blocker.

### Deployment state
- Vercel refused a new preview deployment due to its 24-hour deployment creation limit. The last available preview points to an older commit (`d0f5bd...`) and is **not** the current candidate.
- No production deployment occurred.

### Remaining release gates / next actions
1. Poll #4639 until Desktop/Mobile Playwright finishes; inspect any failures and rerun on the exact final SHA.
2. Verify the new durable-audio Service Worker E2E and both daily-plan entry points (header quick-start and dashboard due-task cards).
3. Add/perform cold-start offline acceptance: close the tab, reopen a new tab while offline, verify app shell, local Quran, all three plans, tafsir, printed Mushaf, and downloaded audio.
4. Physical acceptance remains required on Android Chrome, iOS Safari, and desktop Safari/Chromium, including airplane mode, storage quota pressure, eviction, resume, and app restart.
5. Keep PR #390 Draft/HOLD until the High dependency audit is resolved by an official maintainer-reviewed upstream release and exact-head Quality Gate is fully green.
6. Only after release gates pass: request/perform merge to `main`, then production deployment when Vercel quota permits. Never activate remote-sync flags as part of this offline-only release.


### Follow-up findings after the #4639 run started
- Mushaf 604/604 integrity verification currently still passes through the full-package quota-reserve gate. On nearly-full storage, a no-missing-pages verification can be blocked despite requiring no new package bytes. Next fix: apply full-package quota preflight only when pages are missing; add a 604/604 low-quota verification test. If a corrupt page is discovered, delete/replace it and report an honest incomplete state if Cache Storage cannot accept the replacement.
- The three-plan Playwright fixture currently seeds all three plans with the same start date. Strengthen it to use distinct start dates (two-days-overdue, yesterday, today), verify the selected `planDate` for each, click the dashboard primary CTA, the header quick-start, and both additional plan cards. This matches the original user scenario more closely.
- Add a cold-tab offline acceptance test: after the app shell and offline audio are cached, close the page, open a new tab in the same browser context while offline, and verify app shell + durable audio still work.
- Audio UX follow-up: the offline downloader lists seven Al Quran Cloud reciters while the main player maps four approved editions plus Ghamdi as stream-only. Align the selectable lists or explicitly mark stream-only / non-playable download options before broad release.


### 2026-11-18 — #4639 completed; corrective round #4645 running
- Run #4639 (`44241511583`, SHA `b9cfaabc8e7e884549f27508bb517f5de6064bdf`) completed **FAIL**: 182 passed, 8 failed, 2 skipped across Desktop/Mobile (9.9 minutes). The new durable-audio Service Worker E2E passed.
- The 8 failures were four duplicated browser regressions: old EveryAyah filename expectations after the deliberate approved-CDN migration (global ayah filenames are correct), and a timing-sensitive Mushaf “button disabled” assertion because the repaired page fetch completed before the assertion.
- Corrective code now updates the audio expectations to Al Quran Cloud canonical global-ayah URLs; delays the one mocked repair response to assert loading state deterministically; distinguishes “verified existing 604-page package” from “download completed”; and skips the full-package quota reserve check when no pages are missing, allowing integrity-only verification on nearly-full storage.
- Added a low-quota 604/604 offline revalidation assertion to the Mushaf E2E.
- New exact-head run #4645: GitHub run `44243189810`, SHA `6e28979549d6e0bbaef442b9b409426e99504571`; application job is running. The separate dependency audit still fails on the same High `picomatch@4.0.7` advisory. Do not merge until exact-head browser tests pass and the security audit is resolved.


### Security advisory nuance and dependency hygiene (2026-11-18)
- Upstream review now explicitly disputes CVE-2026-112366. GitHub GHSA remains **High / unreviewed**; NVD says “Awaiting Enrichment”; Snyk's matching advisory has been revoked as “not a vulnerability”, explaining that exploitation requires an untrusted actor to control the glob pattern. Maintainer/community discussion says not to accept untrusted glob patterns and raises correctness/coverage concerns with proposed fixes. Sources: [GitHub GHSA](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), [NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-112366), [Snyk revocation](https://security.snyk.io/vuln/SNYK-JS-PICOMATCH-21248802), upstream PRs #237/#238/#269.
- WIRD's only observed chain is `vite > tinyglobby > fdir > picomatch`; Vite and its plugins are used by `vite.config.ts`/build/preview, not imported by `server.ts` or browser runtime. However `vite`, `@vitejs/plugin-react`, and `@tailwindcss/vite` are currently incorrectly listed in root `dependencies`. Move these build-only packages to `devDependencies` and add a separate `bun audit --prod` CI step to establish whether the production graph is clean. Keep the full all-groups audit visible and failing until owner approval; do not silently ignore the GHSA.
- If the production audit passes after dependency hygiene, present the exact evidence and ask the product owner whether to accept this disputed build-tool-only advisory as a documented residual risk. No waiver has been granted at this checkpoint.


### Production configuration finding — requires explicit owner decision
- Read-only Vercel environment inspection found `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` on the **production** target (not shown on preview). This conflicts with the offline-only release boundary recorded earlier.
- No Vercel environment values were changed. Do not toggle either flag without explicit product-owner approval, even though the previous project decision was to keep remote sync/projection disabled until release gates pass.
- Before any production release, owner must confirm whether these flags should be set to `false` for the offline-only phase. This is a separate production configuration action, not part of the current PR/code changes.


### Vercel preview reconciliation — 2026-11-18
- Read-only Vercel inspection shows the latest READY deployment is preview SHA `6d3c8f41596d7cf80896a2b6a0b57505982831c3` on `feat/offline-mushaf-package-20261117` (deployment `dpl_CRuv1GaQDDsuN5SXWjjaFBzJG9fH`).
- Current candidate head is `6e28979549d6e0bbaef442b9b409426e99504571`; therefore the available preview is stale by the subsequent test/settings fixes. Do not use it as live verification for the current candidate.
- No deployment was created or promoted during this continuation.


### 2026-11-18 — #4645 follow-up
- #4645 (`44243189810`, SHA `6e28979549d6e0bbaef442b9b409426e99504571`) completed **FAIL** with 188 passed, 2 failed, 2 skipped. Both failures were the same Mushaf revalidation test on Desktop/Mobile: the transient disabled-state assertion was not reliable, even with a delayed mock route.
- Updated the test to assert the actual success toast, repaired-page request count, and completion state instead of a transient button-disabled state. It also verifies the full 604/604 package can be integrity-checked offline with only 1 MiB free quota remaining.
- New exact-head run #4650: `44244747430`, SHA `037aeb8fd55a1990b5fcc2268b29bd0ac691e4d5`; core tests are running. Security audit remains red only for the disputed picomatch advisory.


### 2026-11-18 — Production dependency separation and upstream advisory status
- On offline feature branch, moved build-only `vite`, `@vitejs/plugin-react`, and `@tailwindcss/vite` from `dependencies` to `devDependencies`. Confirmed `server.ts` dynamically imports Vite only when `NODE_ENV !== 'production'`; Vite config is build/dev tooling.
- Updated `bun.lock` root workspace classifications; programmatic comparison confirmed exact package-name parity between package.json and lockfile dependency/devDependency maps.
- CI now reports `bun audit --prod --audit-level=high` separately from the full dependency graph audit. Run `44246969500` confirmed production audit PASS: no vulnerabilities across 241 production-reachable packages. Full audit still fails only on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch` (285 total installed packages).
- Upstream status checked through GitHub repository: fix PR #238 for master and #246 for v2 are still OPEN/unmerged; do not consume unmerged upstream code or invent an override. GitHub-reviewed GHSA remains active and no released fixed version verified. Keep full audit visible and release blocked pending upstream release or explicitly approved risk exception.
- Current feature PR #390 remains OPEN + Draft. Run #4650 (`44244747430`, SHA `037aeb8...`) had 190 Playwright tests passed, 2 skipped; full verify job was successful. New run #4652 (`44246969500`, SHA `74c6552...`) is rerunning after dependency/workflow changes; its production audit passed, full audit failed for the same advisory, and verify job is still running at Chromium installation at last check.
- Do not merge, promote, or change production env flags. Production flags remain true pending explicit owner decision; no Vercel values were changed.


### Mushaf SVG source/license review — 2026-11-18
- Inspected the exact pinned upstream `quran-ws/quran-svg` commit `3ff27b46cecb0c0519d77531d9c868a579d1f623`, including its `LICENSE` and `NOTICE.md`.
- Quran.ws states its own ayah-polygon geometry and page metadata are CC BY 4.0, with attribution waived when used inside an application/product. The underlying Hafs/KFQC Mushaf artwork remains third-party material from the King Fahd Complex; the NOTICE reproduces the Complex's free digital-use terms for software/web/digital publishing. The physical printing-for-commercial-sale restriction does not apply to WIRD's digital app use.
- This is a source-terms check, not a guarantee of the source's accuracy. PR code independently sanitizes SVG to a strict svg/g/path element allowlist and validates all 604 pages' ayah coordinates against WIRD's local Quran text. Continue to preserve source commit pin and do not republish the artwork/data as a standalone dataset.


### Tafsir source-version maintenance check — 2026-11-18
- Official QuranEnc terms allow downloading/republication only if the original content is unchanged, publisher/source and version are credited, edition/transcript metadata is preserved, corrections are sent to the source, the copy is updated when a newer version is issued, and no inappropriate advertising is displayed.
- Current Arabic Tafsir al-Muyassar remains `arabic_moyassar` V1.0.1 dated 2026-11-09, confirmed on QuranEnc's official catalogue page on 2026-11-18.
- Found a lifecycle gap: once the 114-surah local package was complete, the panel hid the download action, so the user could not manually recheck the live source version. Added a visible `التحقق من تحديث المصدر` action in the completed state; it reuses the existing fail-closed version check, does not redownload surahs when the version matches, and leaves the previous verified copy intact if QuranEnc reports a newer version (which requires a reviewed app metadata update first).
- Added Desktop/Mobile E2E coverage to seed all 114 valid stored surahs, verify a same-version check performs no surah downloads, then simulate a newer version and verify the existing 114/114 local package remains intact while WIRD reports that its pinned source metadata must be updated. This change awaits the exact-head CI run.
- Official terms: https://quranenc.com/en/home (Terms and Policies panel); official API schema: https://quranenc.com/en/home/api/.


### Exact-head rerun after Tafsir version-check E2E — 2026-11-18
- Feature PR #390 current head at this checkpoint: `a728f1aae7d25a73c6f26c7f00ba989b5e4f8b22`.
- Quality Gate run #4664 (`44248132284`) is running against that exact head. The security audit remains expected to fail on the full dependency graph unless upstream changes; production audit is separately expected to pass. Do not report tests as passed until this exact run completes.
- The prior exact run #4652 (`44246969500`, SHA `74c6552...`) verified 190 Playwright passed / 2 skipped, 31 Firestore Rules passed, 604/604 Mushaf maps, and build/type checks. The new run adds the completed-Tafsir source-version recheck regression test and reruns the full matrix.


### Tafsir compact-panel regression follow-up — 2026-11-18
- Run #4667 (`44249374284`, SHA `6201304...`) confirmed the compact panel was rendered and the same-version catalogue check made exactly one metadata request and zero surah downloads. The test then failed only because it still expected the long-form success sentence, while compact mode intentionally displays `التفسير محفوظ محليًا دون اتصال.`.
- Updated the assertion to compact-mode copy and started run #4668 (`44250448085`, SHA `9860528...`). This exact-head run includes the compact panel in the completed reader and the two-stage source version test (same version: no redownload; newer version: preserve the existing local copy and report that the WIRD source metadata needs updating).


### Offline release gate update — 2026-11-18 (latest)
- PR #390's completed exact-head run #4668 (`44250448085`, SHA `9860528b4b532770d2323fc6abf0700daffb7d79`) passed the complete test/build job: 192 Playwright passed, 2 skipped, 0 failed; Firestore Rules Emulator 31 passed / 0 failed; TypeScript, production build, and remaining smoke steps passed.
- The overall workflow still failed only in the full dependency audit. The separate production-only audit passed. The full graph path is `vite > tinyglobby > fdir > picomatch@4.0.7`; Vite is a devDependency, not a production dependency. The reviewed GHSA remains active, so keep the full audit visible and do not suppress it or add an arbitrary override. This lowers runtime exposure but does not clear the repository's all-dependencies release gate.
- The source-version recheck E2E passed on desktop and mobile, including same-version no-redownload and newer-version preservation.
- Added a stricter offline cold-start E2E: after the full app asset package is cached, switch the browser context offline, reload the page (simulating app close/reopen), verify the service worker still controls the page and the app navigation is available, then open the 604-page Mushaf. Exact-head run #4669 (`44254360677`, SHA `be6c28b5febe3a191851804f8fe1bb251f4eabae`) is currently running; do not claim this new cold-start test passed until that run completes.
- PR #390 remains Draft/HOLD. `main` remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. No merge, production deployment, Vercel environment edit, or remote-sync flag change was made.


### Cold-restart offline verification result + multi-plan dashboard regression — 2026-11-18
- Exact-head run #4669 (`44254360677`, SHA `be6c28b5febe3a191851804f8fe1bb251f4eabae`) completed: test/build job PASS; 192 Playwright passed, 2 skipped, 0 failed; Firestore Rules Emulator 31 passed / 0 failed. The full offline preparation test now reloads the app after setting the browser offline and verifies service-worker control, dashboard navigation, and opening the printed Mushaf; this passed on desktop. Tafsir source recheck passed on desktop and mobile.
- Overall workflow remains FAIL only on full dependency audit; production-only audit PASS. Full graph: `vite > tinyglobby > fdir > picomatch@4.0.7`, with Vite in devDependencies. Keep GHSA visible; no suppression/override.
- Added a dashboard E2E regression in PR #390 that seeds three active engine plans with different due dates (two overdue, one today), reloads the dashboard, and verifies all three tasks appear: oldest task in the primary daily card, other two in the multi-plan list, with overdue/today labels. Exact-head run #4670 (`44255318631`, SHA `e2688c92843c3d5b55f716dccfce32a0356e03b4`) is queued. Await its result before considering multi-plan dashboard coverage complete.
- Main remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; PR #390 remains Draft/HOLD. No merge/deploy or Vercel production-setting changes.


### Multi-plan dashboard E2E fixture correction — 2026-11-18
- Run #4670 (`44255318631`, SHA `e2688c92843c3d5b55f716dccfce32a0356e03b4`) confirmed the new dashboard test was the only failure (once each on desktop and mobile); the other 192 Playwright tests passed. The missing dashboard multi-plan card was a fixture issue, not evidence of a production regression.
- Root cause: AuthGate had already initialized an empty guest Engine Plan archive head in IndexedDB. The test then wrote only the legacy `wird_engine_plans` localStorage key; on reload, the verified archive head correctly took precedence over the legacy bytes, so the test's fixture was never imported.
- Corrected the E2E setup to clear only the three Engine Plan archive stores in the isolated test browser context, seed the legacy localStorage archive, and reload through AuthGate's actual copy/verify migration path. No production application code changed for this fixture correction.
- Exact-head run for SHA `029495d3cd76ce8396b5957fe340259a7219d126` is running (run #4671 expected). Verify the dashboard now displays all three tasks before marking this regression covered.


### Tafsir recheck regression — failed run diagnosed and corrected — 2026-11-18
- Run #4677 (`44248132284`) completed with 190 Playwright passed, 2 skipped, and 2 failures. Both failures were the same new E2E case on desktop and mobile: the test looked for the compact Tafsir download panel as an implicit named region before the asynchronous local Tafsir pane had settled. No unrelated Playwright failures were reported.
- Follow-up fix on PR #390: wait for the completed-state recheck button, use a stable section locator, and explicitly expose the compact download panel as `role="region"` for accessible discovery. Commits: `4bdf0506...` and `89e13885...`.
- New exact-head Quality Gate #4678 (`44266490225`) is running on `89e13885e4ad9074aeab62fbd8dc5b8dfd3c50cf`. Do not claim the fix passes until this run completes.
- Security audit distinction confirmed in #4678: production dependency audit PASS (0 vulnerabilities across 241 packages); all-groups audit FAIL only because dev/build chain `vite > tinyglobby > fdir > picomatch@4.0.7` is still flagged by GHSA-fc5q-39xc-vjpf. No arbitrary override or audit suppression applied.
