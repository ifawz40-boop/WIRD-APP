# WIRD — Release Checklist

**Last verified:** 2026-11-17 (Google AI Studio workspace; prior GitHub/Vercel snapshot: 2026-11-14 20:16 +02:00)  
**Current release decision:** BLOCKED (workspace fixes verified locally in AI Studio, NOT pushed to GitHub CI, NOT deployed to Vercel; Firestore Emulator blocked by missing Java in Studio; sync/offline release gates remain open)

Use only these statuses: **PASS**, **FAIL**, **BLOCKED**, **NOT VERIFIED**. Record exact SHAs and run/deployment IDs. Never convert missing logs into a test failure or success.

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

- [x] PASS (AI Studio workspace 2026-11-17) — `npx tsc --noEmit`, `npm test` (`733 PASSED / 0 FAILED`), `npm run build` (`NODE_ENV=production vite build`, zero chunks > 500 kB, non-`jsxDEV` SW active), `npm run mushaf:validate-coverage` (604 pages / 6,236 ayahs), `npm run smoke:api-imports`, `npm run smoke:server`, and all 18 desktop/mobile Playwright E2E spec files (`164` passed / `2` intentionally skipped / `0` failed).
- [ ] BLOCKED (AI Studio workspace 2026-11-17) — `npm run test:firestore-rules` cannot run inside AI Studio sandbox due to missing Java runtime (`Could not spawn java -version`); must execute in GitHub CI Quality Gate after push.
- [ ] NOT VERIFIED — GitHub Quality Gate CI for 2026-11-16/17 AI Studio workspace modifications (changes are local to Studio and not yet pushed to GitHub).
- [x] PASS (Historical CI 2026-11-14) — PR #363 run `43632493503` and PR #373 run `43634212804` passed on GitHub Actions; PR #372 merged at `f264e4bdea7496090f60940e9e8db03e2fb15696`.
- [ ] BLOCKED — several other unmerged candidate PR heads still have runner/log observability issues; assess each exact head independently.
- [x] PASS (Historical Production 2026-11-14) — Vercel Production deployment `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` reached READY on prior `main` SHA `f264e4bdea7496090f60940e9e8db03e2fb15696` (does NOT include 2026-11-16 Studio changes).

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

- [x] PASS (AI Studio workspace 2026-11-16) — `NODE_ENV=production vite build` + non-blocking `/sw.js` registration (`src/main.tsx`) + non-blocking `precacheQuranFont` (`public/sw.js`) verified in desktop/mobile Playwright: installed SW serves full app shell after offline reload and full offline preparation caches all 252 lazy Quran assets and opens Mushaf offline.
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

- [x] PASS (2026-11-16) — `firebase-applet-config.json` confirmed by owner and verified as `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`.
- [x] PASS — repository Firestore rules inspected; no rules/database/user data changed.
- [ ] FAIL — Vercel Production flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` were observed `true` on 2026-11-14 (not modified).
- [ ] BLOCKED — explicit owner authorization required before disabling the two Production flags; no settings changed.
- [ ] BLOCKED — sync must not be treated as release-safe until server-owned revisions, base-revision capture, transactional compare-and-swap, validated bootstrap, durable cursors, atomic imports, duplicate handling, UID guards, conflict deferral, and multi-client emulator tests are all evidenced.
- [ ] NOT VERIFIED — deployed Firestore rules match repository rules at the current production project/version.

## I. Production verification

- [ ] NOT VERIFIED (2026-11-16 Studio changes) — 2026-11-16 AI Studio fixes are NOT pushed to GitHub and NOT deployed to Vercel Production per explicit owner directive (`"التحديث متنشرش على فيرسل"`).
- [x] PASS (Historical 2026-11-14) — Production deployment `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` was READY on prior `main` SHA `f264e4bdea7496090f60940e9e8db03e2fb15696`.