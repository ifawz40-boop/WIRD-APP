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
