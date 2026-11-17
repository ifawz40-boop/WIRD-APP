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
