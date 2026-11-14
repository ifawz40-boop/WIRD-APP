# WIRD Repository Hygiene Audit — 2026-11-14 (safe reconstruction)

## Scope
- Repository: `xm8eslam-stack/WIRD-APP`
- Baseline: current `main` at `f32988e8586431b0e5cadebe0cf84c6208e0341c`
- Candidate branch: `chore/retain-hukm-artwork-hygiene-20261114`
- This reconstruction intentionally does **not** delete the Google AI Studio artwork at:
  `.aistudio/artifacts/brain/54884aa9-9ac7-4435-a6bc-5bf9ab6e69b8/.tempmediaStorage/media_1794314548557_10eec1ab.jpg`
- The artwork was inspected visually in the parent commit and is a gold Arabic حُكم brand mark. It is user-facing brand artwork, not proven disposable cache. It must remain tracked unless the owner explicitly authorizes removal after reviewing it.

## Changes in this candidate
1. Rename the root `package.json` package name from `react-example` to `wird-app`.
2. Align the root workspace name in `bun.lock` to `wird-app`.
3. No dependency versions, package resolutions, runtime code, Quran data, user data, Firebase rules/data, secrets, Vercel settings, sync flags, or Google AI Studio settings are changed.
4. No image/artwork deletion is included. The candidate is based directly on the current main branch so the artwork remains present.

## Evidence and boundaries
- The prior PR #377 candidate deleted the artwork; that deletion is rejected by the visual safety review.
- The package/lockfile patches are each a one-line root-name change only.
- PR #377's earlier exact-head Quality Gate run `43636848964` completed successfully, job `132575423877`; the 604 Mushaf coordinate-map validation step was **SKIPPED**, not passed. The workflow log reports 160 Playwright tests passed and 2 skipped.
- PR #377's Vercel Preview was provider-reported READY for its exact head. Production remains on main SHA `f32988e8586431b0e5cadebe0cf84c6208e0341c`; this reconstruction does not alter Production.
- At the time of the initial audit, candidate CI and Preview were pending; see the dated exact-head validation updates below.

## Retention rules
- Preserve Quran text and metadata, verified religious sources, Mushaf assets, user data, Firebase recovery paths, backup/restore logic, CI workflows, tests, scripts, artwork, and historical engineering evidence unless a separate evidence-led review proves a specific item safe to remove.
- Lack of code references or a temporary-looking directory name is not sufficient evidence to delete a user-facing asset.
- No runtime source or user data is deleted by this audit.


## CI validation request

The PR title includes `Mushaf` to request execution of the workflow's optional 604 printed-Mushaf coordinate-map validation step. Confirm the step is `success` in the final exact-head run; a skipped result is not accepted as coverage evidence.


## Historical candidate validation update — 2026-11-14 22:41 +02:00

- Artwork-preserving PR #378 head at validation snapshot: `33a0b6f265df87d0f1761576d85994a25cadb7d3`; image blob confirmed present in branch and matches the retained main asset.
- Preview `dpl_6Tf4wRCueTYqDkWjcS7boD32hwUn`: READY.
- Quality Gate run `43638493787`: the 604 printed Mushaf coordinate-map validation passed; Bun install/audit, automated tests, native TypeScript API imports, Quran audio CDN/byte-range, Firestore Rules Emulator, TypeScript, production build, and server smoke passed. Desktop/mobile Playwright was still running; therefore full CI was not yet green.
- Canonical documentation was reconciled after this snapshot; that documentation commit changes the PR head and requires a fresh exact-head Quality Gate and Preview before merge.


## Exact-head Quality Gate completed — 2026-11-14 22:47 +02:00

- PR #378 head tested: `dafb54647cb71b13ff742beedba9ed49601aaf49`; base main SHA: `f32988e8586431b0e5cadebe0cf84c6208e0341c`.
- GitHub Quality Gate run `43638841818`, job `132581609413`: completed SUCCESS. All 604 printed Mushaf coordinate maps passed. Automated tests, Bun frozen install/audit, native TypeScript API imports, Quran audio CDN/byte-range, Firestore Rules Emulator, TypeScript, production build, server startup smoke, Chromium/runtime, Desktop/Mobile Playwright and cleanup steps passed.
- Playwright: 160 passed, 2 skipped. The diagnostics upload action completed but found no files at its configured path; no artifact was uploaded.
- Vercel status on this exact SHA: `build-rate-limit`; no Preview deployment exists for this SHA. Earlier Preview `dpl_6Tf4wRCueTYqDkWjcS7boD32hwUn` is for the older head `33a0b6f265df87d0f1761576d85994a25cadb7d3` only.
- Main Production remains READY on SHA `f32988e8586431b0e5cadebe0cf84c6208e0341c`; no Production setting or deployment was changed.
- Artwork blob `c4e29d1c8db5234ef5dc4dfcfee94edf74499b55` remains identical between main and candidate. No image/media deletion is present.
- This documentation refresh changes the PR head and requires a fresh full exact-head Quality Gate before merge.
