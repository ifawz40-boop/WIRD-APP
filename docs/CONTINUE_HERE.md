# WIRD — Continuation Entry Point

**Last reconciled:** 2026-11-14 22:47 +02:00  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Latest application-code merge on main:** `d265bdf37e9410ad6cd99273bb595526dce63b50`  
**Verified main HEAD:** `f32988e8586431b0e5cadebe0cf84c6208e0341c`.  
**PR #363:** MERGED at `fb8e57640db78545fc93ce3f482b7ab3a9f59ded`  
**PR #373:** MERGED at `d265bdf37e9410ad6cd99273bb595526dce63b50`  
**PR #372:** MERGED at `f264e4bdea7496090f60940e9e8db03e2fb15696`

> This is the authoritative current snapshot. Older dated snapshots below are historical evidence only. Re-fetch live GitHub/Vercel/Firebase state before every new task.

## Current verified continuation state — 2026-11-14 22:47 +02:00

- Repository: `xm8eslam-stack/WIRD-APP`; Production URL: https://wird-app.vercel.app/.
- Verified `main` HEAD: `f32988e8586431b0e5cadebe0cf84c6208e0341c`. Production deployment `dpl_3mxckEPrdrR92kHX3T9sY55YJXUj` is provider-reported READY on that exact SHA. No Production mutation was made.
- PR #378 is OPEN / Draft, base `main`, candidate head at this snapshot `dafb54647cb71b13ff742beedba9ed49601aaf49`, 13 commits ahead / 0 behind. It changes only `package.json`, `bun.lock`, four canonical docs, and the hygiene audit. The package/lockfile diff is one root-name line each; dependency resolutions are unchanged.
- The gold Arabic حُكم artwork is retained: its Git blob is identical in main and candidate (`c4e29d1c8db5234ef5dc4dfcfee94edf74499b55`). No image/media deletion is present. PR #377 remains OPEN / Draft / HOLD because it deletes this artwork. PR #374 remains obsolete and must not merge.
- Exact-head Quality Gate run `43638841818`, job `132581609413`, completed SUCCESS on `dafb54647cb71b13ff742beedba9ed49601aaf49`. It passed Bun frozen install/audit, automated tests, all 604 printed Mushaf coordinate maps, native TypeScript API imports, Quran audio CDN/byte-range, Firestore Rules Emulator, TypeScript, production build, server startup smoke, Chromium install, runtime checks, and desktop/mobile Playwright. Playwright result: 160 passed, 2 skipped. Diagnostics upload step completed successfully but reported no files found at its configured path.
- Vercel status for this exact head is FAILURE solely with `build-rate-limit`; no Preview deployment exists for this SHA. Prior Preview `dpl_6Tf4wRCueTYqDkWjcS7boD32hwUn` was READY only for the earlier head `33a0b6f265df87d0f1761576d85994a25cadb7d3`. This is a provider quota block, not a verified application build failure. Owner explicitly accepts safe merge when GitHub CI and safety gates pass despite this quota block; do not change Vercel settings.
- This documentation reconciliation itself changes the candidate head. Therefore run a fresh complete Quality Gate on the resulting exact head before merging; the successful run above remains evidence for its exact prior SHA only.
- Next: verify new exact-head CI, re-fetch PR diff and artwork blob, mark #378 ready, squash-merge with expected head SHA, verify main and Production, then close #377 and #374 with supersession comments. No Google AI Studio sync or live Production Ruqyah verification is claimed.

## Historical snapshot — superseded by the PR #378 checkpoint below

- PR #372 Bun CI migration: MERGED at `f264e4bdea7496090f60940e9e8db03e2fb15696`; exact tested head `950640ea78d29e87d426a89d8887c15e4de2abac`; Quality Gate run `43391729769` SUCCESS. Bun frozen install, audit, automated tests, API imports, Quran audio byte-range, Firestore Emulator, TypeScript, production build, server smoke, Chromium install, and desktop/mobile Playwright all passed. The optional 604 Mushaf coordinate-map step was SKIPPED.
- Vercel Production deployment `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` READY on exact main SHA `f264e4bdea7496090f60940e9e8db03e2fb15696`; production alias `https://wird-app.vercel.app/` assigned.
- PR #374 remains OPEN / DRAFT / HOLD at head `6673bb149a2ffa58177c35b9f68c76423dfb2a0b`, based on stale main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; do not merge. It is 8 commits behind current main and overlaps package metadata/lockfile. Port only verified temp-media deletion and carefully reapply workspace-name change on current main, regenerating/validating the lockfile. Its `docs/engineering/README.md` is obsolete against #363 and must not be merged unchanged.
- Live Production Ruqyah route/audio and Google AI Studio sync remain NOT VERIFIED.


- Latest application-code merge remains `d265bdf37e9410ad6cd99273bb595526dce63b50` (Ruqyah). Latest `main` HEAD is `f264e4bdea7496090f60940e9e8db03e2fb15696` after CI-only PR #372.
- Documentation policy: PASS. PR #363 merged; `DOCUMENTATION_OPERATING_STANDARD.md`, `AGENTS.md`, `GEMINI.md`, and root `README.md` are on main.
- Ruqyah lazy loading: PASS / merged. PR #373 merged; removes eager complete-Quran dependency, loads selected local Surah chunks, keeps API indexes coordinate-only, and renders local verified Quran text.
- PR #373 exact-head CI: PASS. Run `43634212804`, job `132567343695`, exact PR head `c42286fa6a5a85bba414a45383a56bd7a00f0cc2`. Automated suites: 711 passed / 0 failed; Firestore Rules Emulator, TypeScript, production build, server smoke and desktop/mobile Playwright passed. Playwright: 160 passed, including Ruqyah audio/category and locator-library cases.
- 604 printed Mushaf coordinate-map verification was SKIPPED; remains NOT VERIFIED.
- Vercel Production: READY, deployment `dpl_6KvNeEcmRV53ERHisLNwQgNTcojV`, source SHA `1c025e0e476ebdaa1250fffce2e154848ca52eee` (docs-only descendant containing application merge `d265bdf...`), alias `https://wird-app.vercel.app/`.
- Browser readback confirmed Production app loaded at `/#/session`; Ruqyah route/audio was not directly live-smoke-tested.
- Preview: READY on PR #373 head `c42286f...`, deployment `dpl_JE7AddCKxTgu5XygzznNjnSL4STq`.
- Previous read-only inventory reported both sync flags `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true`. No changes authorized or made.
- Google AI Studio pull/synchronization is NOT VERIFIED.
- No Quran corpus, Firebase Rules/data, secrets, Vercel settings, sync flags, or manual deployment changed.

## Open PR inventory — refreshed after #373 merge

All listed PRs were OPEN / DRAFT at refresh time. Re-fetch exact heads/checks before action.

| PR | Head SHA | Current handling |
|---:|---|---|
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Hygiene; overlaps #372 package/lockfile; defer until reconciled |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun CI/lockfile candidate; previous run failed before steps/logs; rerun after #373 |
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

## Immediate next actions

1. #372/#374 dependency hygiene: reconcile package/lockfile overlap, rerun exact-head CI with inspectable logs, then consider merge. Port #374's safe artifact cleanup separately if still needed.
2. #366/#368 offline audio: one canonical DB/cache model; resolve crash, cross-tab, restart, quota and account-isolation gates.
3. #364 Advisor: finish adversarial/security review.
4. #369/#370: verify generated Juz/range indexes, boundary fixtures, browser E2E and persisted settings.
5. #367/#371: no end-to-end chunked persistence/sync claim until IndexedDB archive, manifest integrity, atomic publication, rollback and multi-client tests exist.
6. Continue the stale-document audit across all 55 Markdown files under `docs/`.
7. Verify Google AI Studio has pulled main SHA `d265bdf...`; GitHub merge does not prove Studio sync.


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


## Historical continuation checkpoint — 2026-11-14 22:24 +02:00

- Verified `main` HEAD: `f32988e8586431b0e5cadebe0cf84c6208e0341c`.
- PR #377 remains OPEN / Draft / HOLD. Its branch head is `f543f23b7ea4d33806217cce9a2815489c2bf5a8`; it deletes a visually confirmed gold Arabic حُكم brand artwork and must not merge.
- PR #377 Quality Gate run `43636848964` passed on that exact head. Job `132575423877`: 160 Playwright passed, 2 skipped; the dedicated 604 Mushaf coordinate-map validation was SKIPPED and is not a pass.
- PR #377 Preview deployment `dpl_5Jd8Hoh8mWtp9UuxaRB1jxrTG9x4` is provider-reported READY. Production deployment `dpl_3mxckEPrdrR92kHX3T9sY55YJXUj` remains READY on main SHA above.
- Safe replacement branch created from main: `chore/retain-hukm-artwork-hygiene-20261114`. It changes only root package/workspace names and adds an artwork-preserving audit; no image deletion is included.
- New candidate CI/Preview are pending. Do not merge until exact-head gates pass and the artwork-preserving diff is verified.
- PR #374 remains obsolete; do not merge. Close it only after the safe replacement is integrated and its supersession is verified.
