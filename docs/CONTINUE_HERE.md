# WIRD — Continuation Entry Point

**Last reconciled:** 2026-11-17 (Google AI Studio workspace)  
**Repository:** `xm8eslam-stack/WIRD-APP` · **Primary branch:** `main`  
**Last refreshed GitHub/Vercel checkpoint (2026-11-14):** `main` HEAD `f264e4bdea7496090f60940e9e8db03e2fb15696`; app-code merge `d265bdf37e9410ad6cd99273bb595526dce63b50`

> This is the authoritative current snapshot. Older dated snapshots below are historical evidence only. Re-fetch live GitHub/Vercel/Firebase state before merging or deploying.

## Active continuation note — Google AI Studio UX work (2026-11-18)

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


## Master completion execution — 2026-11-18

- Owner instruction: execute in large coherent phases without waiting for test jobs after every small change; complete implementation/integration first, then run the full matrix, fix failures, rerun, and release only after gates pass.
- Persistent master plan: `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md`.
- Execution branch: `release/wird-completion-20261118`, created from `main` SHA `026a86bc5e26d8f27cafadbf1ddce3b155fe00d6`.
- Existing offline candidate PR #390 is diverged (291 commits ahead, 2 behind; merge base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`). It must be reconciled file-by-file; do not merge blindly or overwrite UX changes.
- Historical candidate tests are not exact-head proof. Latest observed attempt had a full dependency audit failure for dev-only `picomatch@4.0.7` (GHSA-fc5q-39xc-vjpf / CVE-2026-112366) and application tests cancelled before execution. No suppression or unreviewed patch is permitted.
- Physical-device cold restart + airplane-mode acceptance remains outstanding.
- No application source changes, merge, or deployment have been made in this kickoff. Latest plan commit: `6e69a64d5158737b0d038d46674463f16401a1fd`.
- Next: refresh PR #390 exact head and CI state, inspect all changed files and reconcile current main with offline/hifz work surgically.


### Integration checkpoint — 2026-11-18 (continuing)

- Master plan updated: `docs/MASTER_EXECUTION_PLAN_HIFZ_OFFLINE.md`.
- Integration branch now contains candidate-only offline services, API relay, service worker/cache changes, offline Mushaf package, optional Tafsir Muyassar package, settings controls, E2E and regression tests.
- Main UX preserved and reconciled with multi-plan due queue + exact `enginePlanId` / `enginePlanDate` routing and completion.
- Local-first audio playback integrated in Quran Library, Mushaf reader (including two-page spread order), and memorization session; stale requests and object URL cleanup are guarded.
- TafsirContentPane falls back only to the explicitly selected pinned Tafsir Muyassar edition when online fetch fails; Settings exposes the optional package download.
- Current integration branch was 60+ commits ahead and 0 behind main at last compare. Latest implementation checkpoint commit before this documentation update: `80e9fb5f9678d22a01470ed69b48b2fcd54209d8`.
- No application test suite has been run yet by design; do not claim tests pass. Continue implementation and review first, then run the full quality matrix on one exact SHA.

### Latest continuation checkpoint — 2026-11-18

- Active release branch: `release/wird-completion-20261118`.
- Draft PR: https://github.com/xm8eslam-stack/WIRD-APP/pull/391 (base `main`; not merged).
- Plan detail now forwards exact engine plan ID + scheduled date through the launch chain. Completion matcher fails closed on ambiguous legacy duplicate ranges instead of guessing.
- Opposite-page Tafsir is now mounted in both Mushaf spread slots. The side selector maps to the opposite Quran source page, preserves page preference locally per surface, and navigates back to the actual printed page.
- Tafsir full-page mode requires the complete validated QuranEnc Muyassar package; single-ayah pane checks the local package first before network.
- Bun package manifest/lockfile were reconciled; Vite/Tailwind build tools are dev-only.
- No full exact-head test result is claimed yet. CI is running from the draft PR while implementation/review continues. The full audit advisory remains a release blocker; do not waive it.

### Current execution checkpoint — 2026-11-18 (after first CI remediation)

- Active branch: `release/wird-completion-20261118`.
- Draft PR: https://github.com/xm8eslam-stack/WIRD-APP/pull/391, base current `main`; do not merge while any required gate is red.
- Current latest branch SHA when recorded: `ec01ab507a1036c5bec206c94f3bbf16d7917c6f`; latest workflow `44312458783` was still running.
- Previous exact-head `44307063505` had 803/0 aggregate tests, API import pass, CDN smoke 8/8, Firestore Rules 31/0, but TypeScript failed. Fixes committed: narrow the blocked dashboard task before reading plan identity; move spread-mode computation before the audioAyahs expression.
- Earlier stale Mushaf test assertion was corrected; 803/0 confirms the aggregate test suite now passes on the earlier exact SHA.
- Full dependency audit remains red on unpatched dev-only picomatch 4.0.7; production-only audit passes. npm latest is still 4.0.7, so do not invent 4.0.8 or use a waiver.
- Vercel preview is currently blocked by Free plan deployment-rate limit. Do not touch production settings/secrets or remote sync flags.
- Next: inspect exact latest workflow; fix any remaining TS/build/E2E failures; continue source review and device acceptance plan. Only merge/publish after all required release gates are genuinely green.
