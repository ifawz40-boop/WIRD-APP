

## Follow-up checkpoint — 2026-11-17 23:25 +02:00 (PR #386 browser diagnosis)

- Quality Gate #4486 / run `44173952341` on PR #386 head `e6efc84febe2ca63319f857c567db110183d01ff` is now complete. Application job failed only at Playwright after all prior steps passed: **170 passed, 2 skipped, 8 failed**. The separate complete dependency audit failed on `picomatch@4.0.7` / GHSA-fc5q-39xc-vjpf.
- Failure diagnosis from the uploaded Playwright trace/error contexts:
  - Seven mobile failures were selector mismatches: tests looked for the desktop sidebar label `القرآن والمصحف`, while the real mobile quick-navigation control is `القرآن`. The page snapshots confirm the mobile quick-nav and drawer are rendered and functional; these failures occur before entering the Quran reader.
  - One desktop spread test reached the correct facing spread and verified spread mode, but waited for the nonexistent label `الصفحتان التاليتان`; the actual control was labelled `الصفحة التالية` even though it advances by `pageStep=2`.
- Corrective commits on `feat/offline-tafsir-opposite-page-20261117`:
  - `e92f86d1f4e9c9e5b8472b5dab689a6545cf2944`: update eight Quran-entry locators to accept the responsive mobile/desktop labels.
  - `db1c5468ba43e5d3c16dce17f724c8a235e14849`: make the next-page accessible label reflect single-page vs two-page movement.
- New exact-head Quality Gate #4491 / run `44178530734` is running on `db1c5468ba43e5d3c16dce17f724c8a235e14849`. At the last poll, the application job was still running Firestore Rules Emulator tests; the separate dependency audit had failed again. Re-poll this run and inspect final Playwright result before claiming success.
- Dependency investigation: official Vite latest release v8.3.8 still declares `picomatch: ^4.0.7`; Vite 7.3.8 and 6.4.6 also directly declare vulnerable-range picomatch 4.x. Vite 5.4.21 has no direct picomatch dependency but is outside current Vite supported versions, and current `@vitejs/plugin-react@6` requires Vite 8. Do not downgrade to unsupported Vite 5 as a security workaround. Vite official supported lines are 8.3, 7.3, 8.2, 6.4 and 8.1; these current manifests do not remove picomatch.
- Upstream remediation proposals remain unmerged: picomatch PR #237/#238 OPEN; PR #261 is an open fork PR from `diegomors/picomatch`, not an official upstream release; PR #240 was closed unmerged and belongs to a fork. No patch or release is verified as vendor-approved. Keep `bun audit --audit-level=high` blocking.
- Branch graph refreshed: #382–#386 all target `fix/main-bun-lockfile-alignment-20261117` (base SHA `4332ea4cc4b2fa75e99d3e7a5dee22e2391b6f34`). #386 is 100 commits ahead / 0 behind #385. #386 vs #384 is diverged (114 ahead / 4 behind); #384's unique Revision Center work still needs deliberate integration. #386 vs #383 is diverged (129 ahead / 13 behind). Do not merge PRs by number.
- `main` remains exactly `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` (0 ahead / 0 behind in comparison). No merge, Production deployment, Firebase/Vercel settings or secrets change, or sync-flag activation.

### Next actions
1. Poll Quality Gate #4491 on exact head `db1c5468...`; inspect Playwright output and artifact if it fails.
2. Re-run any targeted browser tests after the selector/label correction; do not alter expected app behavior to make tests green.
3. Continue security remediation research only through official upstream release/advisory updates or a supported toolchain path that removes the vulnerable dependency and passes the full gate.
4. Reconcile #384's Revision Center controls with #386's latest Quran/Mushaf/Tafsir implementation on a dedicated integration branch after security is resolved.
5. Add cold-restart/airplane-mode and local IndexedDB/audio recovery coverage before declaring offline readiness.
