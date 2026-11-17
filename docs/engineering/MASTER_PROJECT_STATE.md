# WIRD — Master Project State

**Current snapshot reconciled:** 2026-11-16 (Google AI Studio workspace)  
**Last refreshed GitHub/Vercel snapshot (not re-fetched in AI Studio):** `main` HEAD `f264e4bdea7496090f60940e9e8db03e2fb15696`, app-code merge `d265bdf37e9410ad6cd99273bb595526dce63b50` (2026-11-14)  
**Repository:** `xm8eslam-stack/WIRD-APP` · **Production URL:** https://wird-app.vercel.app/ · **Primary branch:** `main`

- **AI Studio workspace verification (uncommitted local changes; NOT pushed to GitHub and NOT deployed to Vercel):**
  - **Firebase configuration verified (`firebase-applet-config.json`):** `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`.
  - **Code & build fixes applied in workspace:** `api/advisor.ts` TypeScript narrowing fix; `server.ts` Arabic rate-limit message typo fix (`يرجى الانتظار قليلاً`); `src/components/brand/BrandDesignShowcase.tsx` clipboard timer cleanup (`copyTimerRef`); `package.json` `build` script pinned to `NODE_ENV=production vite build` (eliminating `jsxDEV` bloat and restoring `import.meta.env.PROD` Service Worker registration); `src/main.tsx` non-blocking SW registration on `DOMContentLoaded`/ready DOM; `public/sw.js` non-blocking `precacheQuranFont` so external font timeouts never stall SW install; plus E2E selector updates in `e2e/plans-ux.spec.ts`, `e2e/ruqyah-ux.spec.ts`, `e2e/memorization-audio-repeat.spec.ts`, `e2e/memorization-session-display-ux.spec.ts`, `e2e/progress-ux.spec.ts`, and `e2e/wird-navigation-tafsir.spec.ts`.
  - **Local workspace gates executed on final state:**
    - `npx tsc --noEmit`: **PASS**
    - `npm test` (`runAllTests.ts` + pre-scripts): **PASS** (`731 PASSED | 0 FAILED`)
    - `npm run build` (`NODE_ENV=production vite build`): **PASS** (zero chunks > 500 kB, 9-asset shell precache manifest + 252 lazy assets, `/sw.js` active without `jsxDEV`)
    - `npm run mushaf:validate-coverage`: **PASS** (all 604 SVG pages / 6,236 unique local ayahs mapped once)
    - `npm run smoke:api-imports` & `npm run smoke:server`: **PASS**
    - Desktop + Mobile Playwright (all 18 `e2e/*.spec.ts` files): **PASS** (`162` executed passed, `2` intentionally skipped, `0` failed; includes offline app-shell reload and 252-asset full offline preparation)
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