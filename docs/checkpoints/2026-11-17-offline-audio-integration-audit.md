# WIRD offline audio / app-shell integration audit — 2026-11-17

## Scope
Read-only source audit of the outstanding offline audio and explicit offline app-package work while PR #386 browser validation continues. This is not a release approval.

## Current PR state
- PR #366 `feat/offline-first-app-readiness-20261112`, head `cade1b630bb429d6a4106de5bf12713df18f3491`, base `main` at old SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, OPEN/DRAFT.
- PR #368 `feat/offline-audio-unified-store-20261112`, head `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8`, base `main` at the same old SHA, OPEN/DRAFT.
- PR #366 exact-head run #4139 / `43258830250` ended FAILURE. PR #368 exact-head run #4376 / `43571432459` ended FAILURE. Historical logs currently return BlobNotFound, so no particular test or code failure is inferred from those aggregate conclusions. Both branches are stale relative to current main and require rebase/reconciliation plus exact-head reruns.
- Current main remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` at last verification. Do not merge these old-base branches wholesale.

## PR #366 — explicit app shell/offline preparation
Source diff inspected:
- Adds a six-second timeout for network-first navigation before falling back to the cached app shell.
- Recursively adds eligible public static assets to the explicit offline package manifest, excluding `sw.js` so the browser can update the worker through its lifecycle.
- Separates StorageManager availability from the optional `persist()` API, so lack of persistent-storage permission support is not mislabeled as lack of local storage.
- Adapts opportunistic audio and Mushaf cache entry limits using `navigator.storage.estimate()`, retaining conservative hard caps and storage headroom.
- Adds unit/source tests for these behaviors.
- This does not itself prove all routes work offline after cold restart, nor does it provide a pinned audio download library. It must be tested after service-worker update, offline reload, and browser restart.

## PR #368 — offline audio storage foundation
Source diff inspected:
- Adds a device-local IndexedDB library with `jobs`, canonical `files`, and `jobItems` stores, shared-file references, pin/deletion-pending state, and cache-eviction reconciliation.
- Adds a synthetic same-origin Cache Storage adapter with response validation, read-back byte equality, generation-specific keys, and stale-generation-safe deletion.
- Adds a bounded downloader with max concurrency 2, AbortController pause/cancel, approved Al Quran Cloud CDN URL generation, retryable item states, and cache/IndexedDB reconciliation.
- Adds unit tests for library, cache adapter, and downloader.
- Important boundary: the PR currently does **not** include the Service Worker message protocol, accessible download UI/library, playback local-first lookup, full quota preflight/re-check UI, or real browser/device airplane-mode playback proof. It is a persistence/downloader foundation, not a user-ready offline audio feature.
- Source inspection found no cross-tab download lock in the current library/downloader implementation (`navigator.locks` / `BroadcastChannel` absent in those files). Cross-tab concurrent resume/cancel/delete and database upgrade races remain explicit release tests from `OFFLINE_AUDIO_STORAGE_CONTRACT.md`.
- Existing opportunistic session cache is a separate bounded feature; EveryAyah remains stream-only. Do not conflate it with explicit pinned downloads.
- No audio data or metadata is added to Firebase sync, backup, or account export by the inspected foundation.

## Integration order
1. Keep #366 and #368 Draft/HOLD. Do not merge either stale branch to current main.
2. After the dependency security gate is resolved, rebase or selectively port #366 app-shell/storage changes onto the current integration branch; inspect `public/sw.js`, `vite.config.ts`, `SettingsView.tsx`, and the offline preparation service for conflicts with newer work.
3. Port #368 library/cache/downloader foundation only after validating the exact provider allowlist, URL generation, database schema, Cache Storage reconciliation, and no-cloud-data boundary.
4. Add the missing worker message protocol and UI as a separate implementation step; wire playback to check exact verified local file first, then online fallback, with an explicit unavailable state offline.
5. Add Web Locks or a tested cross-tab lease fallback, idempotent resume, service-worker lifecycle recovery, quota interruption/retry, cache eviction/orphan cleanup, and deletion/reference safety.
6. Add desktop/mobile E2E for download, pause, resume, cancel, delete, reload, worker update, offline playback, account switching, and quota exhaustion.
7. Finally test an installed PWA after a true browser/app cold restart in airplane mode. Record browser/device/OS, exact SHA, cache/download state, and results.

## Release boundary
Neither #366 nor #368 is currently merged into main or Production. No offline audio download library, complete offline shell, or real-device offline guarantee is claimed. No production deployment, Firebase/Vercel settings/secrets, or sync flags were changed by this audit.


## Correction after re-fetching current main — 2026-11-17

The earlier audit above described PR #368 as the only audio library foundation. That was incomplete because it did not re-check the latest main implementation. Current main already contains the Settings audio manager, IndexedDB job/file metadata, approved reciter/range planning, quota preflight, bounded two-worker download, generation-scoped Cache Storage writes/read-back, reference-aware deletion/reconciliation, and local-first ObjectURL playback. PR #368 is now a stale alternate implementation and must not be merged as a duplicate store.

The actual remaining current-main gaps are narrower: no job-scoped cross-tab worker ownership, no lock fallback when Web Locks is absent, pause/cancel state from another tab is not reliably observed by a running worker, no durable staging record for crash between Cache Storage write and IndexedDB commit, no scan for unknown cache keys without metadata, and no real-device cold restart/airplane playback proof. See the updated `docs/offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md` and current PR #388 for the precise implementation plan.

The app-shell findings remain valid: main's Vite manifest enumerates build bundle assets but not recursive public assets; PR #366's `offlinePublicAssets` and service-worker timeout/adaptive-cache changes are not in main and need a narrow port/rebase, not a wholesale merge.
