# Latest continuation checkpoint — 2026-11-18 05:00 +02:00

- Current release candidate: PR #390, branch `feat/offline-mushaf-package-20261117`, current code/test head before this documentation checkpoint: `b84b62b00e618a02784eed0fb502e55b413cc5c0`. Main remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; nothing has been merged or deployed.
- Follow-up correctness fix added: a dashboard-started memorization session now carries both the originating engine-plan ID and exact schedule date (`planDate`) through its deep link and completion transaction. This prevents two identical ayah ranges repeated on different days in the same plan from completing the wrong day. Added a regression unit test and strengthened the dashboard Playwright URL assertion.
- Latest observed Quality Gate run: #44239139339. Dependency security audit failed on `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366. The verify job was still running through Playwright installation at last inspection. Its merge commit included the date-specific unit fix; the final E2E URL assertion commit was pushed after that run started and is not yet proven by that run.
- Security handling: the official GitHub advisory lists affected versions through 4.0.7 and no patched version. Upstream candidate fixes #237/#238 are unmerged; do not pin either, suppress the audit, or weaken the gate. Re-check the official advisory/upstream status before making a dependency change.
- Automated checks previously passed on this candidate: test suite, TypeScript, production build, Firestore Rules emulator, and Desktop/Mobile Playwright on earlier exact SHAs. These are not proof for the current head. Current exact-head CI is required.
- Offline review: AuthGate can initialize guest scope locally; verified-user scope replays the local IndexedDB journal before mounting. Service worker explicit package includes all Vite bundle chunks and public assets; shell/content/audio/Mushaf caches remain separated. Cold browser restart + airplane-mode acceptance on a real device remains outstanding.
- Next: collect final jobs/logs from #44239139339; ensure the latest Playwright assertion is covered by a fresh run when a run can be triggered; fix only evidence-backed failures; then complete exact-head desktop/mobile/offline tests. Do not merge/deploy while the security gate fails or real-device offline acceptance is missing.

---

# WIRD — Master Project State

## Live owner execution state — 2026-11-17 22:45 +02:00

- Owner narrowed the current goal to local/offline readiness and four ordered tasks: multi-plan due-work on Dashboard, navigation controls below Quran ayahs, one-/two-page printed Mushaf, and offline opposite-page Tafsir al-Muyassar.
- PR #383 follow-up: code commit `77f360a4390466863c487dd164d567a95a83a605` carries the originating plan ID through Dashboard start → session → completion, so duplicate ayah ranges across plans cannot update the wrong plan. Changing the session range clears the identity; deep links without it retain fallback matching.
- PR #383 (multi-plan due queue): `77f360a4390466863c487dd164d567a95a83a605`, OPEN/Draft. Exact Quality Gate #4465 fails frozen Bun install because this branch is still based on main and does not include prerequisite #382's lockfile alignment; latest Vercel status is also build-rate-limit.
- PR #384 (ayah navigation): code head `022c1dd1cd5435f9c54a152e918e815dd601bbf5`, OPEN/Draft. Controls cover Quran study, Mushaf and Revision Center weak-verse cards. Latest Vercel status is `build-rate-limit`; no Actions run. Older READY preview predates Revision Center additions.
- PR #385 (printed spread): `10529d88e358b35a63c7b41060ffe966141d54e2`, OPEN/Draft. Vercel Preview READY on this exact SHA; no Actions run.
- PR #386 (offline Tafsir): Code-fix commit `3d4bcbaac5e1830faf369125536294a8f8487e02`; subsequent branch commits are documentation-only. Re-fetch PR #386 for the live exact head., OPEN/Draft. Latest Vercel status failed due `build-rate-limit`; no Actions run. It is stacked on #385. PR #383 is a separate branch off main.
- PR #382 prerequisite: `e8ca61cf86b0d49d94783670f76db1c250c7c146`, OPEN/Draft. Quality Gate #4461 fails `bun audit` on `picomatch@4.0.7` / GHSA-fc5q-39xc-vjpf / CVE-2026-112366. GitHub advisory has no patched version as of 2026-11-17. Do not bypass audit or use an incomplete upstream patch.
- Task 4 now has official QuranEnc catalogue version validation, resumable 114-surah IndexedDB storage, raw payload/footnotes preservation, offline-only reading, opposite-page Quran/Tafsir selectors and adjacent-ayah controls. A spread-anchor bug was fixed and covered by a new E2E assertion; offline-ready status now requires exact surah coverage 1–114.
- No local checkout/terminal is available; no local tests, TypeScript, or build pass is claimed. Older READY Previews certify only their own exact SHA, not newer changes.
- Next: safely resolve #382; then exact-head CI for the task branches, including desktop/mobile/offline E2E and full Mushaf coverage. Merge each task only after all required checks pass.
- No Production deploy, Firebase Rules/data, Vercel secrets/settings, sync flags, or user data changed.

> See `docs/CONTINUE_HERE.md` for the live checkpoint and detailed exact-head evidence. The older snapshots below are historical context.


## Current GitHub implementation snapshot — 2026-11-17 21:55 +02:00

- Last verified live main SHA: f70bf5e0617b558dfba4663da2667fb5d6c3ce8a. Re-fetch before merge/deploy.
- Owner scope: local/offline readiness only; four tasks in order: all active memorization plans on Dashboard, navigation below ayat, one-/two-page printed Mushaf, opposite-page Tafsir al-Muyassar.
- Task 1: PR #383, branch fix/dashboard-multiple-due-plan-tasks-20261117. Aggregates all due tasks across active non-paused plans and resolves completion against the matching plan. NOT VERIFIED: initial CI was blocked by bun.lock/package.json override mismatch.
- Task 2: PR #384, branch feat/ayah-navigation-controls-20261117, stacked on PR #382. Shared accessible controls added beneath Library study cards, continuous reading and Mushaf pages; session's existing sticky navigation remains. E2E coverage added. NOT VERIFIED pending exact-head CI.
- CI prerequisite: PR #382 aligns bun.lock. Its last inspectable run passed install, automated tests, API/audio checks, Rules Emulator, TypeScript, build and server smoke; desktop/mobile Playwright failed two timing-sensitive tests. Follow-up commits in #382 wait for the shortcut listener and the new audio instance. Re-fetch current run before proceeding.
- Task 3: NOT STARTED — one-/two-page printed Mushaf with responsive fallback and preservation of page/audio/bookmark state.
- Task 4: NOT STARTED — opposite-page Tafsir al-Muyassar requires a full verified offline corpus. QuranEnc's official Arabic Muyassar source is identified as arabic_moyassar; its reuse terms require unchanged content, explicit publisher/source attribution, version metadata and retention of embedded edition information. Existing per-ayah cache is insufficient for full offline use.
- No local build/test was run in this connector session. Vercel Preview readiness is not equivalent to Quality Gate or production verification.
- No production deployment, Firebase Rules/data, Vercel secrets/settings, sync flags, or user data changed.

> The older Google AI Studio workspace snapshot below is historical context only; it is not evidence for current GitHub or deployed state.

## Current GitHub implementation snapshot — 2026-11-17 22:05 +02:00

- Live main last verified: f70bf5e0617b558dfba4663da2667fb5d6c3ce8a.
- Owner scope: local/offline readiness only; tasks are all active plan due-work, navigation beneath ayat, one-/two-page printed Mushaf, and opposite-page Tafsir al-Muyassar.
- PR #383: task 1 multiple-plan aggregation, OPEN / Draft / NOT VERIFIED.
- PR #384: task 2 shared adjacent-ayah controls beneath Quran Library and Mushaf reading surfaces, OPEN / Draft / NOT VERIFIED.
- PR #385: task 3 printed Mushaf single/facing-spread mode, OPEN / Draft / NOT VERIFIED. Single page is default; spread aligns lower-numbered page to the right, steps by two, combines both page ayahs for audio in reading order, and stores preference locally. E2E coverage includes one/two-page switching and offline opening.
- PR #382: frozen Bun lockfile mismatch is addressed on its branch, but the exact-head Quality Gate now fails at bun audit because picomatch@4.0.7 is covered by a newly surfaced high-severity ReDoS advisory GHSA-fc5q-39xc-vjpf. No fixed version is stated; do not suppress audit or lower severity. No downstream PR may merge until this is safely resolved and all exact-head checks pass.
- Task 4: NOT STARTED. Official QuranEnc catalogue identifies Arabic Tafsir al-Muyassar as translation key arabic_moyassar, publisher King Fahd Complex, version 1.0.1 dated 2026-11-09. QuranEnc API returns per-surah aya/translation/footnotes. Its republishing rules require no content modification/addition/deletion, clear publisher and source attribution, version number, preserving embedded edition info, reporting feedback, updating to source versions and no unsuitable ads. A complete 114-surah local IndexedDB package with validation/resume/update metadata is required.
- No local build/tests were run in this connector session. No production deploy, Firebase Rules/data, Vercel secrets/settings, sync flags or user data changed.

> The older Google AI Studio workspace snapshot below is historical context only.

## Current GitHub implementation snapshot — 2026-11-17

- Live main last verified: f70bf5e0617b558dfba4663da2667fb5d6c3ce8a.
- Owner scope: local/offline readiness only; four tasks: multiple active plan due-work, navigation beneath ayat, one-/two-page printed Mushaf, opposite-page Tafsir al-Muyassar.
- PR #383 task 1, #384 task 2, #385 task 3, #386 task 4 are OPEN / Draft / NOT VERIFIED. Exact heads: #383 45acc719a90049f1f71606995cb02943ac5e337d; #384 3f59506204e21f702749159333162e80ab2f324d; #385 10529d88e358b35a63c7b41060ffe966141d54e2; #386 e007a9cd149fa81fe74240d1a0f6bc2e41f6f308. They are stacked in order and require the prerequisite #382 lockfile branch.
- CI: #382 run #4461 reaches bun audit and fails on picomatch 4.0.7; #383 run #4460 fails at bun install --frozen-lockfile because main's lockfile is out of sync; #384–#386 have no workflow runs yet because they are based on stacked feature branches.
- Task 4 details: local IndexedDB package for QuranEnc Arabic Tafsir al-Muyassar, key arabic_moyassar, King Fahd Complex, catalogue V1.0.1 (2026-11-09). The app downloads all 114 surahs explicitly, validates complete verse counts, sequential coordinates and non-empty translations, stores the original payload including footnotes, supports pause/resume, and displays Tafsir on either spread side for the opposite Quran page. Both pages default to Quran; the other side remains Quran when Tafsir is selected. No API calls occur while reading after download; no cloud sync.
- Quran text remains exclusively from WIRD's canonical local Quran data; Tafsir text is not AI-generated and is never used as Quran text.
- PR #382 currently fails exact-head bun audit on GHSA-fc5q-39xc-vjpf / CVE-2026-112366 affecting picomatch through 4.0.7. Upstream candidate #237 remains open/unmerged; #238 has a documented remaining vulnerable pattern. Do not suppress audit or pin a partial/unmerged patch. This blocks all stacked merges until safely resolved.
- No local build/test was run in this connector session. No production deploy, Firebase Rules/data, Vercel secrets/settings, sync flags or user data changed.

> The older Google AI Studio workspace snapshot below is historical context only.

**Current snapshot reconciled:** 2026-11-17 (Google AI Studio workspace)  
**Last refreshed GitHub/Vercel snapshot (not re-fetched in AI Studio):** `main` HEAD `f264e4bdea7496090f60940e9e8db03e2fb15696`, app-code merge `d265bdf37e9410ad6cd99273bb595526dce63b50` (2026-11-14)  
**Repository:** `xm8eslam-stack/WIRD-APP` · **Production URL:** https://wird-app.vercel.app/ · **Primary branch:** `main`

- **AI Studio workspace verification (uncommitted local changes; NOT pushed to GitHub and NOT deployed to Vercel):**
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