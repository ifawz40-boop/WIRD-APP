# WIRD — Release Checklist

**Last verified:** 2026-11-14 22:41 +02:00  
**Current release decision:** BLOCKED — PR #378 documentation/package hygiene candidate awaits a fresh complete exact-head Quality Gate after documentation reconciliation; Production remains unchanged.

Use only these statuses: **PASS**, **FAIL**, **BLOCKED**, **NOT VERIFIED**. Record exact SHAs and run/deployment IDs. Never convert missing logs into a test failure or success.

## Current PR #378 release gate — 2026-11-14 22:41 +02:00

- [x] PASS — current main baseline: `f32988e8586431b0e5cadebe0cf84c6208e0341c`.
- [x] PASS — artwork-preserving candidate contains no image/media deletion; the gold Arabic حُكم artwork blob is present.
- [x] PASS — package/lockfile changes are root workspace-name changes only; no dependency resolutions changed.
- [x] PASS — PR #378 Preview `dpl_6Tf4wRCueTYqDkWjcS7boD32hwUn` READY on candidate head `33a0b6f265df87d0f1761576d85994a25cadb7d3`.
- [x] PASS — candidate run `43638493787` executed and passed the 604 printed Mushaf coordinate-map validation, Firestore Emulator, automated tests, TypeScript, build and server smoke steps.
- [ ] BLOCKED — candidate Playwright desktop/mobile step was still running at snapshot time; full workflow not yet successful.
- [ ] BLOCKED — docs refresh changes candidate SHA; all CI/Preview gates must be rechecked on the new exact head.
- [ ] BLOCKED — do not merge #378 until new exact-head Quality Gate succeeds and Preview is READY.
- [ ] BLOCKED — #377 artwork-deleting PR and obsolete #374 must remain unmerged; close only after safe replacement merges.

## A. Repository and change control

- [x] PASS — latest application-code merge recorded: `d265bdf37e9410ad6cd99273bb595526dce63b50`; documentation-only follow-up commits may advance main HEAD.
- [x] PASS — Production deployment `dpl_6rDxKfTk19xmc94uqnY7toYKfm5Q` is READY on exact code merge SHA `d265bdf37e9410ad6cd99273bb595526dce63b50`.
- [x] PASS — documentation PR #363 reviewed and merged at expected head `26c9deb5872868f1f74e119391a0b6f9ad74af3d`; merge commit `d265bdf37e9410ad6cd99273bb595526dce63b50`.
- [x] PASS — PR #373 Ruqyah lazy-loading fix reviewed and merged at exact tested head `c42286fa6a5a85bba414a45383a56bd7a00f0cc2`.
- [x] PASS — PR #372 Bun CI migration merged at `f264e4bdea7496090f60940e9e8db03e2fb15696`; exact tested head `950640ea78d29e87d426a89d8887c15e4de2abac`; Quality Gate `43391729769` passed all executed steps (optional 604 Mushaf map check skipped).
- [x] PASS — Vercel Production deployment `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` READY on exact merge SHA `f264e4bdea7496090f60940e9e8db03e2fb15696`.
- [ ] BLOCKED — PR #374 is stale (8 commits behind main), overlaps package/lockfile, and contains an obsolete engineering README; port safe changes only after reconstruction and exact-head gates.
- [ ] BLOCKED — every remaining candidate PR must be re-fetched and reviewed at its exact current head.
- [x] PASS — PR #363 exact-head Quality Gate run `43632493503` passed; documentation policy merged.
- [x] PASS — PR #373 exact-head Quality Gate run `43634212804` passed: 711/0 automated tests, Firestore Emulator, TypeScript, build, server smoke and 160 desktop/mobile Playwright checks; Ruqyah fix merged.
- [ ] BLOCKED — no remaining implementation PR merge until its own exact-head CI checks are inspectable and pass.
- [ ] NOT VERIFIED — Google AI Studio synchronization of main commit `d265bdf37e9410ad6cd99273bb595526dce63b50`.

## B. CI and build

- [x] PASS — PR #363 run `43632493503`, job `132562026967`, recorded complete successful steps on exact PR head `26c9deb5872868f1f74e119391a0b6f9ad74af3d`.
- [ ] BLOCKED — several other PR heads still have runner/log observability issues; assess each exact head independently.
- [ ] NOT VERIFIED — full test suite on a local complete checkout.
- [ ] NOT VERIFIED — TypeScript/lint exact-head run.
- [ ] NOT VERIFIED — Firestore Rules Emulator exact-head run.
- [x] PASS — PR #363 desktop/mobile Playwright smoke completed on exact PR head `26c9deb5872868f1f74e119391a0b6f9ad74af3d`.
- [x] PASS — PR #373 Ruqyah desktop/mobile E2E passed in both projects; 160 total Playwright tests.
- [ ] NOT VERIFIED — implementation PR Playwright checks remain independent.
- [x] PASS — PR #373 exact-head Vercel Preview build completed on `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca`.
- [x] PASS — PR #364 exact-head Vercel Preview build completed on `ad33875b0304020f930c7b606ef8782d36148707`.
- [x] PASS — Vercel Production deployment `dpl_6KvNeEcmRV53ERHisLNwQgNTcojV` is READY on docs-only main commit `1c025e0e476ebdaa1250fffce2e154848ca52eee`, which includes application-code merge `d265bdf37e9410ad6cd99273bb595526dce63b50`.

## C. Quran and Ruqyah

- [x] PASS — local Quran text remains the display authority.
- [x] PASS — targeted Ruqyah API proxy/security tests: 20/20 in isolated Node 26.
- [x] PASS — targeted Ruqyah view/audio-lock tests: 14/14 in isolated Node 26.
- [x] PASS — full 171-entry long-program handler fixture normalizes coordinates and strips provider text.
- [x] PASS — Preview build generated 114 Surah chunks and validated 6,236 ayah coordinates.
- [x] PASS — whole-Surah locator and lazy local Quran loading merged in PR #373 after exact-head CI.
- [ ] NOT VERIFIED — post-merge Production API short/medium/long smoke.
- [x] PASS — CI desktop/mobile Ruqyah E2E on exact PR head; [ ] NOT VERIFIED — live Production Ruqyah playback/navigation smoke.
- [ ] NOT VERIFIED — real-device/offline audio playback.

## D. Engine Plans and memorization

- [x] PASS — isolated archive codec tests: 6/6.
- [x] PASS — isolated memorized-range service tests: 7/7 with canonical Juz boundary fixture; Juz 30 now ends at An-Nas 114:6.
- [ ] NOT VERIFIED — full generated Juz index validation and browser-level range selection.
- [ ] BLOCKED — integrate archive chunk codec into real IndexedDB archive and sync persistence.
- [ ] BLOCKED — add explicit bounds for total archive bytes, record count, manifest size, and chunk count.
- [ ] NOT VERIFIED — old archive backward compatibility on a complete repository test run.
- [ ] NOT VERIFIED — corrupted archive recovery and rollback with real persisted fixtures.
- [ ] NOT VERIFIED — atomic manifest publication and chunk garbage collection.
- [ ] NOT VERIFIED — two/three-client Firestore Emulator conflict and restart tests.
- [ ] NOT VERIFIED — full memorization-range E2E and generated Juz-boundary validation.

## E. Offline and PWA

- [x] PASS — isolated offline audio tests: library 18/18, downloader 6/6, cache adapter 5/5 (29/29 total).
- [ ] BLOCKED — cross-tab job ownership/locking for concurrent downloads.
- [ ] BLOCKED — complete Cache Storage orphan cleanup lifecycle.
- [ ] BLOCKED — consistent Cache Storage quota detection and user-facing recovery.
- [ ] NOT VERIFIED — progress, pause/cancel/retry behavior in browser integration.
- [ ] NOT VERIFIED — restart recovery and partial-file cleanup.
- [ ] NOT VERIFIED — service-worker cache version migration and invalidation on supported browsers.
- [ ] NOT VERIFIED — storage quota exhaustion and multi-tab tests.
- [ ] NOT VERIFIED — Android/iOS PWA airplane-mode and restart verification.
- [ ] NOT VERIFIED — offline audio playback integrated with the reader.

## F. Security and Advisor

- [x] PASS — client-controlled history sender labels are no longer rendered as authenticated assistant messages on PR #364.
- [x] PASS — six targeted source assertions, including UTF-8 byte-based request-size enforcement.
- [x] PASS — two stubbed Advisor API route smoke assertions: oversized Arabic payload rejected; forged assistant history downgraded to untrusted user context.
- [ ] NOT VERIFIED — full advisor security suite and exact-head CI.
- [ ] BLOCKED — evaluate a distributed/global rate-limit strategy; current in-memory limit is best-effort per serverless instance.
- [ ] NOT VERIFIED — production request/abuse monitoring after release.
- [ ] PASS — no API secret values were read, logged, or changed during this audit.

## G. Seerah

- [x] PASS — prototype UI explicitly labels itself as non-published and uses draft navigation fixtures only.
- [ ] NOT VERIFIED — historical source reliability and edition-level citations.
- [ ] NOT VERIFIED — quotation rights and source license/permission evidence.
- [ ] BLOCKED — no chapter may be published until claims, sources, rights notes, scientific review, language review, narrative continuity, and accessibility review pass.

## H. Firebase and sync safety

- [x] PASS — inspected client configuration identifies `wird-quran-app`.
- [x] PASS — repository Firestore rules inspected; no rules/database/user data changed.
- [ ] FAIL — Vercel Production flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are both currently `true`.
- [ ] BLOCKED — explicit owner authorization required before disabling the two Production flags; no settings changed.
- [ ] BLOCKED — sync must not be treated as release-safe until server-owned revisions, base-revision capture, transactional compare-and-swap, validated bootstrap, durable cursors, atomic imports, duplicate handling, UID guards, conflict deferral, and multi-client emulator tests are all evidenced.
- [ ] NOT VERIFIED — deployed Firestore rules match repository rules at the current production project/version.

## I. Production verification

- [x] PASS — Production deployment is READY on the exact main SHA.

## Hygiene replacement release gate — 2026-11-14 22:24 +02:00

- [x] PASS — current main SHA re-fetched: `f32988e8586431b0e5cadebe0cf84c6208e0341c`.
- [x] PASS — PR #377 exact-head CI run `43636848964` completed successfully; 160 Playwright passed, 2 skipped.
- [ ] BLOCKED — PR #377 must not merge because its diff deletes visually confirmed حُكم brand artwork.
- [x] PASS — Vercel reports PR #377 Preview READY (`dpl_5Jd8Hoh8mWtp9UuxaRB1jxrTG9x4`).
- [x] PASS — Production remains READY on main SHA (`dpl_3mxckEPrdrR92kHX3T9sY55YJXUj`); no production mutation performed.
- [ ] NOT VERIFIED — 604 Mushaf coordinate-map validation: workflow step skipped.
- [ ] BLOCKED — artwork-preserving replacement branch `chore/retain-hukm-artwork-hygiene-20261114` awaits exact-head CI and Preview.
- [ ] BLOCKED — do not close obsolete PR #374 until the safe replacement is merged.
