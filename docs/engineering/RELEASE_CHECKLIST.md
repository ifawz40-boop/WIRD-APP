# WIRD — Release Checklist

**Last verified:** 2026-11-14 21:58 +02:00  
**Current release decision:** BLOCKED (PR #363 and Ruqyah #373 are merged; other application release gates remain open)

Use only these statuses: **PASS**, **FAIL**, **BLOCKED**, **NOT VERIFIED**. Record exact SHAs and run/deployment IDs. Never convert missing logs into a test failure or success.

## A. Repository and change control

- [x] PASS — latest application-code merge recorded: `d265bdf37e9410ad6cd99273bb595526dce63b50`; documentation-only follow-up commits may advance main HEAD.
- [x] PASS — Production deployment `dpl_6rDxKfTk19xmc94uqnY7toYKfm5Q` is READY on exact code merge SHA `d265bdf37e9410ad6cd99273bb595526dce63b50`.
- [x] PASS — documentation PR #363 reviewed and merged at expected head `26c9deb5872868f1f74e119391a0b6f9ad74af3d`; merge commit `d265bdf37e9410ad6cd99273bb595526dce63b50`.
- [x] PASS — PR #373 Ruqyah lazy-loading fix reviewed and merged at exact tested head `c42286fa6a5a85bba414a45383a56bd7a00f0cc2`.
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
- [x] PASS — Vercel Production deployment `dpl_6rDxKfTk19xmc94uqnY7toYKfm5Q` is READY on exact main SHA `d265bdf37e9410ad6cd99273bb595526dce63b50`.

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