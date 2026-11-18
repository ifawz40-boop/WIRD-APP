# Current implementation status — 2026-11-18

> Current branch-aware status. The historical planning checkpoints below are retained for traceability and are not the current implementation status.

- The unified explicit offline Quran-audio library is implemented in the PR #390 candidate branch, not merged to main or released. Users can download a complete Surah, Juz, or selected memorization plan using seven curated Al Quran Cloud reciter editions.
- Audio download architecture: IndexedDB jobs/files/jobItems/locks/staging; Cache Storage bytes; exact ordered ayah-sequence fingerprints; schema v4 migration of legacy job fingerprints; bounded concurrency (2), quota preflight with 25 MiB reserve, exact HTTP/MIME/length checks, 8 MiB per-file cap, cross-tab leases, pause/abort, cancel, retry/resume, delete, startup reconciliation, and local-first playback.
- EveryAyah remains stream-only. Opportunistic upcoming-ayah cache remains separate (up to 20 ayahs / 40 entries). Audio is device-local and excluded from Firebase sync/backups.
- Al Quran Cloud official terms rechecked 2026-11-18 (terms page last updated 2026-11-13): streaming, embedding and downloading recitations are permitted for personal/educational use; copyright remains with reciters/estates; reciters may request removal if used in a commercial product. WIRD caches only user-selected audio locally and does not rehost/redistribute. Recheck before release and before any commercial use. Source: https://alquran.cloud/terms-and-conditions.
- Latest completed exact application gate: #4604 / run `44236188421`, SHA `c69f6dc15b7067bcd7d40f266d5ab7dbe35e36fe`: 776 unit assertions, 31 Firestore Rules tests, 604 Mushaf coordinate maps, API/audio smoke, TypeScript, production build/server smoke, 186 Playwright passed / 0 failed / 2 intentional skips. Includes three-plan dashboard UI test on Desktop and Mobile.
- Security audit remains failed on `picomatch@4.0.7` via Vite toolchain; no fixed upstream release. PR #390 is Draft/HOLD. The current Service Worker shell cache has now been bumped to v4 to isolate updates from the active worker; this newest cache-version change requires a fresh exact-head Quality Gate.
- Physical device cold-restart/airplane-mode, storage eviction, and Preview/Production verification remain outstanding. No merge or production deployment.

---


# WIRD — Offline Quran audio download plan

## Live implementation checkpoint — 2026-11-12 14:35 +02:00

- PR #355 pure range planner remains merged.
- PR #368 is the current unified metadata foundation replacing the overlapping #358/#359 proposals. It implements jobs/files/jobItems, shared canonical file relations, pinned retention, cache-eviction state, recoverable deletion markers, and tests.
- PR #358 and #359 remain Draft/unmerged and are superseded by #368.
- Not implemented yet: HTTP downloader, Cache Storage adapter, service-worker message protocol, download UI, playback local-first lookup, and real-device offline playback.
- Exact-head #368 Quality Gate run `43210985755` / job `131158220859` ended failure with no steps/logs; do not claim test success or code failure. Vercel Preview is blocked by Free build-rate.


**Live checkpoint:** 2026-11-12 01:23 +02:00  
**Current main:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` — Vercel Production `READY` on the same SHA.
- PR #355's pure range planner is merged; PR #361 keeps EveryAyah network-stream-only and cleans legacy cache entries; PR #362's guest-entry Playwright wait fix is merged.
- PR #358 and #359 remain OPEN / DRAFT / unmerged. Their exact-head runs failed only at the desktop/mobile revision Playwright flow because the helper never navigated from guest entry; logs show it waited for the add-portion button. Other test suites, TypeScript, Firestore emulator, and production build passed on the observed heads.
- Do not merge either manifest implementation as-is. Both are based on old main `4b299042...` and overlap in IndexedDB ownership. Build one implementation on current main using `OFFLINE_AUDIO_STORAGE_CONTRACT.md`.
- No downloader, persistent manifest, Cache Storage coordination, download UI, or real-device offline playback is claimed as implemented. No runtime code changed in this documentation checkpoint.
- Re-test interruption/recovery, shared files across jobs, deletion reference safety, quota, orphan/missing entries, sync conflicts, browser eviction, and multi-tab behavior before release.

---
# WIRD — Optional Offline Quran Audio Downloads

## Status
Implemented in the current PR #390 candidate branch as a user-initiated device-local library. It is separate from the app-shell preparation and the opportunistic next-ayah cache. It is not merged/released, and real-device airplane-mode acceptance remains outstanding.

## Source terms re-check — 2026-11-11
- Official Al Quran Cloud terms explicitly permit streaming, embedding, and downloading recitations for personal and educational use at the published bitrates; copyright remains with the reciters or their estates: https://alquran.cloud/terms-and-conditions
- The official CDN documentation defines the ayah audio URL pattern and canonical global ayah range 1–6236: https://alquran.cloud/cdn
- This permission is limited to the provider's approved recitations and stated use; it is not a blanket license for other providers or for WIRD to rehost the audio.
- EveryAyah has no confirmed provider-wide offline-storage permission in the reviewed sources. Existing app behavior is therefore stream-only: the service worker no longer caches these files and prunes any legacy EveryAyah entries on activation. Do not restore offline caching for this provider without a documented rights basis.

## Goal
Let a user explicitly download a chosen Quran reciter's surah or ayah range to the current device, verify the saved files, play them without a network connection, inspect storage use, cancel an active download, and remove selected downloads. Never download the full Quran automatically.

## Approved source boundary
- Use only the existing curated Al Quran Cloud / Islamic Network reciter allowlist in src/services/ruqyahAudioService.ts and its documented CDN URL pattern.
- The provider's published terms describe recitations as licensed by reciters/estates and permit streaming, embedding, and downloading for personal and educational use at published bitrates. Re-check the terms at implementation/release time.
- Do not use EveryAyah as a bulk-download source until its redistribution/offline-storage terms are independently established.
- Do not bundle or rehost audio on WIRD infrastructure. Downloads remain on the user's device, are user initiated, and can be deleted.

## User experience
1. Add a clearly named تنزيلات التلاوة area in Quran audio controls/settings.
2. Let the user choose one approved reciter, one surah or an explicit ayah range, and confirm an estimated count/size before starting.
3. Show queued/downloading/completed/partial/failed states, bytes/files progress, current surah/range, pause/cancel, and retry of missing items.
4. Show a local library with reciter, surah/range, file count, storage size, last verification, and delete action.
5. Playback checks the exact local cache entry first, then uses the network if online. Offline missing items must show a clear message rather than silently stalling.
6. Downloads are device-local and must never enter Firestore sync, account backup, or user-content exports.

## Storage and reliability rules
- Use navigator.storage.estimate() before download; display current usage/quota and a conservative estimate for the requested range. Estimates are advisory because browser quota can change.
- Ask for persistent storage only after an explicit download action; never imply that persistence is guaranteed.
- Require explicit confirmation if the estimated download approaches a configurable local budget or leaves too little headroom. Do not invent a universal device quota.
- Use a dedicated versioned Cache Storage namespace and a small IndexedDB manifest containing only approved reciter ID, surah/ayah coordinates, exact CDN URL, byte length when available, timestamp, and verified state.
- Verify every response: HTTPS, exact cdn.islamic.network host, allowlisted edition/bitrate, expected ayah number, HTTP 200, audio content type, bounded size, and non-empty body. Never cache redirects to unknown hosts or HTML error pages.
- Limit concurrent fetches (start with 2), use abortable requests, and persist progress after each file so interrupted work resumes safely.
- Before each batch, check quota again. On quota/storage errors, stop cleanly and preserve completed files; never evict user-pinned downloads silently.
- Cancellation stops future requests and aborts in-flight requests. Deletion removes both cache objects and manifest records, then refreshes usage/status.
- Avoid partial/range caching unless the provider's behavior is proven; cache complete ayah MP3 responses only.
- Provide explicit cache version migration and cleanup that never deletes other WIRD caches or user data.

## Architecture work items
1. Add a pure URL builder that derives global ayah IDs from canonical local Quran metadata and approved reciter configuration.
2. Add a download manifest repository with schema version, idempotent keys, atomic updates, and tests for malformed/stale records.
3. Add a worker message protocol for DOWNLOAD_AUDIO_RANGE, CANCEL_AUDIO_DOWNLOAD, GET_AUDIO_DOWNLOADS, and DELETE_AUDIO_DOWNLOAD; validate every message and payload in the worker.
4. Implement bounded, resumable downloads with progress messages and storage checks. Keep the current 40-entry opportunistic session cache independent from pinned downloads.
5. Add local-first playback lookup for approved audio only; preserve current online fallback and continuous queue behavior.
6. Add accessible mobile-first UI, screen-reader progress announcements, empty/error/quota states, and clear device-local privacy copy.
7. Add deterministic unit tests, Service Worker integration tests, and Playwright tests for start/resume/cancel/delete/offline playback/quota exhaustion/account switching.

## Release gates
- Source/license terms rechecked and recorded.
- Exact reciter/bitrate allowlist tests pass; arbitrary URLs rejected.
- No full-Quran automatic download; no cloud sync/backup of audio files.
- Download/cancel/retry/delete survive reload and service-worker update without orphaned manifest/cache entries.
- Offline playback verified after network is disabled on a real browser/device.
- Storage usage is bounded and no user-pinned files are silently evicted.
- Desktop/mobile accessibility and performance tests pass.

## Explicit non-goals
- No full-Quran automatic download.
- No rehosting, redistribution, or third-party audio pack integration.
- No automatic downloads over mobile data.
- No change to current reciter defaults or existing continuous playback semantics.
- No claim that tafsir, Firebase/Auth, IslamicAPI, or all remote resources work offline.


## Cache Storage + downloader implementation checkpoint — 2026-11-12
- PR #368 adds a generation-scoped Cache Storage adapter and bounded downloader orchestration. See OFFLINE_AUDIO_STORAGE_CONTRACT.md for validation and recovery boundaries.
- Downloader supports 1–2 concurrent requests (default 2), approved CDN host validation, redirect rejection, retryable failed items, pause/abort, cancel, and resume of queued/partial jobs.
- Cache data is only committed to IndexedDB metadata after Cache Storage write and exact read-back verification. Audio remains device-local and excluded from sync/backup.
- New service tests cover cache key generations, invalid responses, byte-length mismatch, downloader success, retry, pause, cancel and bounded concurrency.
- Exact-head #368 run 43275108775 / job 131381335018 ended failure with no steps/logs; no code-level diagnosis or test pass is available.
- Still missing: Service Worker protocol, download UI, local-first playback, orphan-cache cleanup policy, actual browser integration, and real-device offline test. This is not a released feature.

## Implementation status update — 2026-11-18 — PR #391

The design above has now been integrated in the current release candidate (not yet merged to main):

- IndexedDB jobs/items/verified file metadata plus generation-scoped Cache Storage; files are device-local and excluded from cloud sync/backups.
- Approved reciter allowlist (7 editions), canonical local Quran coordinates/global ayah IDs, same-origin allowlisted /api/quran-audio-download relay for Cache Storage fetches, and a matching Express route for local/Node server execution.
- Bounded concurrency, per-item abort controllers, quota preflight, resumable queue state, cross-tab Web Locks with IndexedDB lease fallback, BroadcastChannel status notifications, stale generation protection, interrupted-worker recovery, orphan cleanup and local-first playback.
- Settings supports Surah/Juz/engine-plan scope, pause/resume/cancel/retry/delete, progress and quota messages. Quran Library, Mushaf page/spread and memorization session playback all resolve verified local audio before network fallback.
- Automated coverage includes invalid edition/coordinates, HTML rejection, byte-length/MIME validation, quota failures, cross-tab locks, pause/cancel/resume, restart recovery and offline playback resolution.
- E2E reload test verifies a failed ayah download resumes after reload and resolves from local Cache Storage while offline. App-shell E2E separately verifies the service worker serves durable audio while offline.
- Exact-head candidate run 44307063505 recorded 803 aggregate tests passing, CDN smoke 8/8, Firestore Rules 31/31, TypeScript/build/server smoke passing after the subsequent fixes; run 44312846261 was exercising desktop/mobile Playwright at the last checkpoint.
- Release blockers remain: full dependency audit on dev-only picomatch 4.0.7, current-head Playwright result, physical-device cold restart/airplane mode, and Vercel preview rate limit. No claim of production release.
