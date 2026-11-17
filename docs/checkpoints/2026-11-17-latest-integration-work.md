# WIRD — latest integration work checkpoint — 2026-11-17

## PR #386 current exact head
- Branch: `feat/offline-tafsir-opposite-page-20261117`
- Current head: `e0c7d9d63c00c86ed3010ef340bcc7ce34536b1e`
- PR #386 remains OPEN / Draft / HOLD.

## Browser regression repair
- Run #4486 (`44173952341`) on earlier head `e6efc84...` completed: 170 Playwright passed, 2 skipped, 8 failed.
- Seven mobile failures were stale desktop-only navigation labels; mobile uses the quick-nav button `القرآن`. Corrected all eight Quran entry locators to accept the correct responsive labels.
- One desktop failure expected the nonexistent spread label `الصفحتان التاليتان`; corrected the UI label so spread mode announces two-page navigation while single-page mode retains singular wording.
- Commits: `e92f86d1f4e9c9e5b8472b5dab689a6545cf2944`, `db1c5468ba43e5d3c16dce17f724c8a235e14849`.

## Revision Center integration
- Ported PR #384's unique weak-verse navigation into #386 rather than merging divergent branches:
  - `36db5a382649c69e65bafab19f0b4318bfcdad66`: previous/next controls on weak-verse cards, starting a one-ayah review session.
  - `e0c7d9d63c00c86ed3010ef340bcc7ce34536b1e`: Playwright regression for weak-verse navigation.
- This reduces the unique runtime work still outstanding from #384. Do not close or merge #384 until its remaining diff is compared and its work is fully accounted for.

## Current CI
- Run #4491 (`44178530734`) was cancelled after later commits arrived on the same PR branch. Cancellation is not a test result.
- Run #4494 (`44179010898`) is the current exact-head Quality Gate on `e0c7d9d...`.
- Last poll: application job was running the 604 Mushaf coordinate verification; security audit job completed FAILURE on `picomatch@4.0.7` / GHSA-fc5q-39xc-vjpf.
- Re-poll #4494, inspect final Playwright results/artifacts, and do not infer success while in progress.

## Security/toolchain decision
- Vite latest v8.3.8 still declares `picomatch: ^4.0.7`; supported Vite 7.3 and 6.4 lines also declare vulnerable-range picomatch 4.x.
- Vite 5 has no direct picomatch dependency in its manifest, but is outside current supported Vite release lines and would require downgrading `@vitejs/plugin-react` from v6 (which requires Vite 8). Do not use unsupported Vite 5 as a production security workaround.
- Upstream picomatch proposals #237/#238 remain open/unmerged; #261 is an unmerged fork proposal; #240 was closed unmerged. No official patched release is verified. Keep the complete dependency audit blocking.

## Offline audio/app shell
- Read [offline audio integration audit](./2026-11-17-offline-audio-integration-audit.md).
- PR #366 is an old-main app-shell/storage preparation branch; PR #368 is an old-main IndexedDB/cache/downloader foundation. Neither is merged or complete. #368 lacks Service Worker protocol, user-facing download library, local-first playback, cross-tab locking, and real-device airplane-mode/restart proof.
- Do not merge stale branches wholesale. Rebase/selectively port only after security gate and reconcile with current integration branch.

## Safety
- Last verified `main` remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- No merge, Production deploy, Firebase/Vercel settings/secrets changes, or sync-flag activation.


## TypeScript follow-up — 2026-11-17
- Quality Gate #4494 / run `44179010898` on head `e0c7d9d...` completed application validation FAILURE at TypeScript. All 759 unit assertions passed, all 604 Mushaf coordinate maps passed, Firestore Rules Emulator passed (31), but TypeScript rejected the weak-verse navigation prop because `AyahNavigationControls` required the full `Ayah` object while this component only needs canonical coordinates.
- Corrected the reusable component contract to `Pick<Ayah, 'surahNumber' | 'numberInSurah'>` on commit `6c62465d97e855701217ce2e3b8fe00d0574ba58`. This is the correct narrow type; no dummy Quran text/page/juz fields are fabricated.
- Current PR #386 head is now `6c62465d97e855701217ce2e3b8fe00d0574ba58`. Re-fetch workflow runs for this exact SHA; a new run was not yet visible at the first poll after the push. Run #4494 does not validate the fix and never reached Playwright because TypeScript stopped the application job.
- Security audit remains failed on picomatch. No merge/deploy/config changes.


## Cumulative release PR reconciliation — 2026-11-17
- Existing Draft integration PR #387 was discovered; no duplicate PR was opened. The more complete cumulative integration branch was reconciled into its existing head branch `release/wird-offline-tasks-integration-20261117` using a force-with-lease update from the verified prior head.
- The cumulative tree includes PR #383 multiple-plan Dashboard logic, #384 navigation plus the newly ported weak-verse card controls, #385 facing Mushaf, #386 offline Muyassar Tafsir, the corrected responsive navigation tests, the narrow coordinate-only navigation prop, and the mobile audio-error cleanup fix.
- PR #387 exact head first became `6dec1cbb...`; its workflow file was then corrected because it had inherited the older one-job CI workflow from the #386 branch. Restored the #382 split full dependency audit + application test jobs and extended the 604-page coverage condition to run on Tafsir and offline integration branches.
- Current PR #387 exact head: `199743fa60974ee650d51e6579bb5db87fba6487`. Quality Gate #4504 / run `44179885024`: separate dependency audit completed FAILURE on picomatch; application job is running independently (last poll: Node.js setup). Re-poll through Playwright and inspect artifacts.
- Run #4503 on previous head `6dec1cbb...` used the older single-job workflow and failed within that job; it is superseded by #4504 and does not validate the split gate.
- Current PR #387 remains Draft/HOLD. No merge or Production deploy; no Firebase/Vercel settings/secrets or sync-flag changes. Main remains unchanged at the last verified SHA.


## Multi-plan session identity durability — 2026-11-17
- Source review found a real recovery gap: #383 passed enginePlanId into React session state, but the route hash did not preserve it. Refreshing a session or reopening its deep link therefore lost the source plan; if two active plans contained the same ayah range, completion could update the first matching plan instead of the plan that launched the session.
- Fixed on cumulative PR #387: RouteState.enginePlanId, validated `plan` query parsing/building only on session routes, App initial-state and hash-change restoration, and inclusion in the session deep link. Changing ayah range intentionally clears the plan association.
- Added tests for route round-trip, malformed plan IDs, and no plan context on non-session routes.
- Commits: `f73704b6f7546e9373f9bca041c09281a4bdcdc7`, `88fd617b17eb1590f041359c298820adc2fc81f1`, `6d7f435dd2caca3cc400783fc2a7ee152f3e1fd1`.
- PR #387 current head: `6d7f435dd2caca3cc400783fc2a7ee152f3e1fd1`. Run #4504 (`44179885024`) was still in Playwright on the preceding head when last checked; it does not validate this route fix. Wait for that run to conclude/cancel, then confirm a new exact-head run is triggered.
