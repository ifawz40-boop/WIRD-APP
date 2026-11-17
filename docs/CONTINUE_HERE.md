# WIRD — Continuation Entry Point

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
