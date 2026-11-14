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
- New candidate CI and Preview are pending and must be checked on the exact resulting head before merge.

## Retention rules
- Preserve Quran text and metadata, verified religious sources, Mushaf assets, user data, Firebase recovery paths, backup/restore logic, CI workflows, tests, scripts, artwork, and historical engineering evidence unless a separate evidence-led review proves a specific item safe to remove.
- Lack of code references or a temporary-looking directory name is not sufficient evidence to delete a user-facing asset.
- No runtime source or user data is deleted by this audit.
