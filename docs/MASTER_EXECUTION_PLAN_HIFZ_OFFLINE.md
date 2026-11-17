# WIRD — Master Execution Plan
## Advanced Hifz, Full Offline Readiness, Missed-Day Recovery & Durable Plan Archive

**Created:** 2026-11-17  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Production:** https://wird-app.vercel.app/  
**Plan status:** APPROVED — implementation must proceed through evidence-gated phases  
**Baseline source:** `main` at `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` (documentation/workspace status commit; verify live HEAD before every implementation or merge action)

> This is the persistent, editable execution tracker. Update this file in every implementation PR/checkpoint. A task is not complete because code exists: mark it complete only when its acceptance criteria pass on the exact tested SHA. Keep historical evidence and never rewrite prior user-progress records.

---

## 1. Confirmed product and engineering decisions

1. **Memorization studio:** retain the existing Free mode and add guided cumulative linking. Each new ayah follows listen/repeat → progressive masking/recall → cumulative linking to earlier ayat. Default linking window is up to the previous five ayat, configurable within the current session/range. No AI tajweed grading.
2. **Offline-first content:** verified local Uthmani Quran text and local tafsir remain the canonical source. Audio downloads are local-device-only and never uploaded to Firestore. EveryAyah is online-streaming fallback only when no approved local audio is available.
3. **Audio source/licensing gate:** downloadable recitations are restricted to approved Al Quran Cloud reciters only after verifying the applicable API terms, reciter/source rights, caching/storage permission, attribution requirements, and commercial/non-commercial restrictions. Do not treat a generic “personal/educational” description as sufficient legal evidence. Do not enable downloads for any source/reciter whose rights are unclear.
4. **Audio architecture:** one IndexedDB repository for `jobs`, `files`, and `jobItems`; canonical file key `reciterId:globalAyahNumber`; isolated Cache Storage cache `wird-offline-quran-audio-v1`; generation identity `cacheGenerationId`; maximum two concurrent downloads; cross-tab coordination; reference-aware deletion.
5. **Missed days:** detect overdue work and present user-approved options: (a) gradual carry-forward, (b) light consolidation/revision day, or (c) rebalance remaining pace against the target date. Never silently reschedule or rewrite completed history.
6. **Plan archive:** migrate long plan history to IndexedDB v10 stores `enginePlanArchiveHeads`, `enginePlanArchiveManifests`, and `enginePlanArchiveRecords`, isolated by `guest` / `user:<uid>`. Copy → validate → SHA-256 → commit/activate; retain legacy localStorage data read-only for a defined rollback window.
7. **Production safety:** no changes to Vercel secrets/environment variables, Firebase project/rules/data, production sync flags, or deployment promotion without the specific owner authorization. No audio bytes in Firestore. No production migration without a tested rollback.
8. **PWA scope:** app shell, verified Quran text, local tafsir, and installed application navigation should work offline after preparation. Explicitly label features that still require a live service. Provide storage estimates, quota/persistence status, selective deletion, and install guidance (including Safari/iOS limitations).

## 2. Baseline audit — do not confuse with feature completion

### Last recorded Google AI Studio workspace evidence (2026-11-17; not yet GitHub/Production evidence)
- Workspace changes were reported as **not committed/pushed to GitHub and not deployed to Vercel** at the time of the checkpoint.
- Reported checks: TypeScript PASS; unit tests 733 passed; production build PASS; 604 Mushaf page coverage / 6,236 unique ayah mappings PASS; API/server smoke PASS; desktop/mobile Playwright 164 passed, 2 intentionally skipped, 0 failed.
- Firestore Rules emulator test was blocked in the AI Studio container because Java was unavailable. GitHub Quality Gate must provide the authoritative Java-backed Rules run.
- `npm run lint` and `compile_applet` were still listed for final verification.
- Workspace included PWA shell/Service Worker fixes and offline-shell/252-asset preparation tests. This does **not** prove complete offline audio download, cross-tab audio lifecycle, full feature offline coverage, or physical-device reliability.

### Last recorded implementation queue (historical; re-fetch current PRs/branches before reuse)
- Offline audio work existed across PRs #366/#368; required reconciliation of unified store, cross-tab lock, orphan cleanup, quota recovery, restart, and account isolation.
- Plan archive work existed across PRs #367/#371; codec/payload work was not yet equivalent to complete chunked IndexedDB archive integration.
- Older PR heads and CI evidence are historical only. Never merge an old head without re-fetching current head/base, changed files, checks, and mergeability.
- Latest GitHub commit observed while creating this plan: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. Its combined status reported a Vercel success check, but the WIRD Vercel team deployment inventory returned 403 due to missing team authorization. Production state therefore remains **not freshly verified** in this checkpoint.

---

## 3. Execution phases and live checklist

Status vocabulary: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `PASS` · `HOLD`.  
Do not mark a phase PASS until its acceptance criteria and evidence are recorded below.

### Phase 0 — Repository and product baseline audit
**Status: IN PROGRESS**

- [ ] Re-fetch live `main` HEAD, open PR inventory, branch heads, exact CI checks, and changed paths.
- [ ] Reconcile the uncommitted Google AI Studio workspace changes into a dedicated feature branch/PR; inspect the complete diff before push.
- [ ] Map current implementation against all four workstreams: cumulative memorization, audio/PWA, missed-day recovery/testing, plan archive.
- [ ] Inspect existing IndexedDB schema/version, localStorage plan history, sync journal/outbox transactions, Service Worker routes/cache policy, audio providers, and existing E2E coverage.
- [ ] Record current production deployment/source SHA and live smoke status when Vercel team access is authorized; do not infer deployment from a generic status check.
- [ ] Produce a gap matrix linking each requirement to existing source files, tests, and the next smallest safe PR.

**Exit criteria:** one verified baseline SHA; inventory of open PRs and conflicts; no duplicate competing implementations; explicit list of gaps and safe PR sequence.

### Phase 1 — Cumulative memorization studio
**Status: NOT STARTED — implementation not yet audited against this plan**

- [ ] Preserve existing Free mode behavior and regression coverage.
- [ ] Add a guided `cumulative_linking` session mode with explicit phases: `listen_repeat`, `masking_recall`, `cumulative_link`.
- [ ] Support per-ayah repetition target, progressive masking, completion state, and a bounded cumulative window (default up to five preceding ayat or current session start).
- [ ] Play the current ayah and cumulative range through the shared local-first audio resolver.
- [ ] Add immediate “record struggling ayah” action through the durable activity/review transaction; session progress must survive navigation/reload.
- [ ] Keep session state recoverable after interruption; avoid requiring microphone access or AI pronunciation scoring.
- [ ] Add unit, integration, and desktop/mobile Playwright coverage for mode switching, phase progression, audio boundaries, failure recovery, and weak-ayah recording.

**Acceptance:** Free mode unchanged; cumulative mode completes an end-to-end session; ayah order and boundaries are correct; weak ayah event is durable; reload/re-entry preserves progress; tests pass on exact SHA.

### Phase 2 — Offline audio repository, downloads, and PWA readiness
**Status: IN PROGRESS (prior work exists; completion not established)**

#### 2A. Source and rights validation
- [ ] Verify official Al Quran Cloud documentation and applicable terms for the precise reciter/audio endpoint, permitted caching and offline storage, attribution, and redistribution restrictions.
- [ ] Maintain an explicit allowlist of reciter IDs and source metadata; reject unknown/unverified reciters.
- [ ] Confirm EveryAyah is used only for live online streaming and is never persisted for offline playback.
- [ ] Document license/source evidence and a review date. No source is downloadable until this gate passes.

#### 2B. Unified audio repository
- [ ] Consolidate on one IndexedDB repository with `jobs`, `files`, and `jobItems`; do not merge competing legacy audio stores.
- [ ] Enforce unique canonical file identity `reciterId:globalAyahNumber`.
- [ ] Store audio bytes in isolated Cache Storage cache `wird-offline-quran-audio-v1`; metadata records actual availability and `cacheGenerationId`.
- [ ] Add cross-tab locking/coordination and a maximum of two simultaneous downloads.
- [ ] Implement pause, resume, cancel, retry, progress, quota preflight, and safe cleanup with AbortController.
- [ ] Reference-count shared ayah files across jobs/plans/manual pins; deleting one plan/job must not delete a still-referenced file.
- [ ] Verify cache bytes on reads; handle cache eviction, stale generation, partial writes, orphan records, and interrupted transactions.
- [ ] Keep the entire audio repository local to the device and outside Firestore/remote sync.

#### 2C. Offline readiness center and PWA
- [ ] Build a clear readiness center for text/app shell preparation and per-surah/per-plan audio downloads.
- [ ] Show estimated required space vs `navigator.storage.estimate()`, safety headroom, persistence status, actual used space, and recoverable storage.
- [ ] Provide selective deletion and clear distinction between downloaded audio and transient browser cache.
- [ ] Verify PWA install behavior and hide the install CTA when already installed; include a concise Safari/iOS manual-install guide.
- [ ] Enumerate features as fully offline, partially offline, or online-only; do not label the whole app “100% offline” while any core feature still requires a service.
- [ ] Verify shell and local Quran/tafsir routes after cold restart in airplane mode; keep live-only features graceful and explicit.

**Acceptance:** approved reciter files download, pause/resume/cancel, deduplicate, and play after restart without network; shared references survive selective deletion; account changes cannot expose or delete another account's data; quota/cache failures recover safely; PWA shell and verified local text remain usable offline; all limitations are accurately disclosed.

### Phase 3 — Missed-day recovery and review tests
**Status: NOT STARTED — implementation not yet audited against this plan**

- [ ] Detect overdue incomplete tasks in active plans without mutating completed-day history.
- [ ] Calculate and display the actual backlog (ayah count, overdue days, estimated workload, target-date impact).
- [ ] Offer the three approved recovery choices: gradual carry-forward, light consolidation day, or pace rebalance to target date.
- [ ] Preview the resulting schedule before confirmation; require an explicit user choice.
- [ ] Persist the accepted schedule and audit event atomically using the established journal/plan transaction.
- [ ] Add test scope filters: all, selected surah, weak ayat.
- [ ] Add missing-word completion questions generated only from the verified local Quran text; no AI-generated scripture.
- [ ] Allow mistakes to be added to the weak-ayah review queue with user-visible confirmation.
- [ ] Test timezone/day-boundary handling, paused plans, future-dated work, duplicate recovery prompts, undo/reload, and preservation of completed history.

**Acceptance:** recovery options show accurate impact; no silent changes; prior completion history is byte-for-byte/semantically preserved; one confirmed choice creates one durable schedule revision; test questions match the canonical local text exactly.

### Phase 4 — Durable IndexedDB plan archive migration
**Status: IN PROGRESS (prior codec/archive groundwork exists; integrated migration not established)**

- [ ] Inspect current DB version and migration chain before selecting the next version; do not blindly assume v10 is still the correct next version.
- [ ] Add isolated stores equivalent to `enginePlanArchiveHeads`, `enginePlanArchiveManifests`, and `enginePlanArchiveRecords`.
- [ ] Define deterministic ordering, immutable manifests, per-scope heads, revision identity, record counts, and SHA-256 integrity.
- [ ] Scope all records by `guest` or `user:<uid>`; test sign-out, sign-in, account switch, guest migration, and deletion isolation.
- [ ] Migrate in bounded/chunked transactions: copy → schema validation → count/order validation → SHA-256 verification → atomic activation.
- [ ] Keep legacy localStorage archive read-only during a documented rollback window; do not delete it during initial migration.
- [ ] Ensure the application startup gate awaits archive recovery before plan UI reads state; no empty/partial plan flash.
- [ ] Bind archive revision/hash references to journal events and outbox records in the same IndexedDB transaction where supported.
- [ ] Add crash/restart recovery, idempotent rerun, corruption detection, export/import equivalence, and rollback tests.

**Acceptance:** old plans are preserved and readable after migration; repeated migration is idempotent; corrupted/incomplete copies never become active; scope isolation is proven; export matches source records; rollback path is tested; sync journal/outbox remains consistent.

### Phase 5 — Release gates and operational verification
**Status: NOT STARTED**

- [ ] `tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `compile_applet` (where required by the project workflow)
- [ ] `npm run mushaf:validate-coverage` (604-page / 6,236-ayah mapping gate)
- [ ] API import and production server smoke tests.
- [ ] Firestore Rules emulator tests in CI with Java; distinguish emulator success from deployed Rules verification.
- [ ] Playwright desktop + mobile for all affected flows, including offline restart, audio lifecycle, recovery, archive migration, and account isolation.
- [ ] Run storage/audio concurrency and migration stress tests; preserve diagnostics as artifacts.
- [ ] Verify all gates on the exact final PR head SHA; re-run after any code or documentation commit that changes the head.
- [ ] Verify Preview deployment source SHA matches the tested PR head. Production deployment verification is a separate step and must not be inferred from Preview.
- [ ] Physical Android/iOS/Safari airplane-mode and audio restart checks remain an owner/device acceptance item if no reliable automated equivalent exists.

**Release acceptance:** all required gates pass on exact SHA; no unresolved P0/P1 data-loss, Quran correctness, audio licensing, offline, or account-isolation defect; preview/live smoke evidence recorded; no production settings changed without explicit authorization.

---

## 4. Cross-cutting invariants and non-negotiable safeguards

- Canonical Quran text and ayah boundaries must come from the verified local mushaf dataset. External audio APIs may supply coordinates/URLs, never replacement Quran text.
- No AI-generated Quran text, hadith, tafsir, or fiqh content is accepted as a canonical religious source.
- No unverified audio source is downloadable or stored offline.
- No audio bytes are uploaded to Firestore.
- Guest and authenticated-user data remain isolated; switching accounts aborts stale in-flight work.
- Never delete shared audio while any valid reference remains.
- Never silently reschedule overdue work or alter completed history.
- Never activate an unverified plan archive migration; preserve rollback data until the rollback window is explicitly closed.
- Do not expose misleading “offline ready” claims; show feature-by-feature readiness.
- No production secrets, environment variables, Firebase Rules/data, sync flags, or production deployment actions without specific owner authorization.
- Every implementation PR must be narrowly scoped, reviewable, and based on the current main SHA. Avoid merging overlapping/legacy branches wholesale.

## 5. Evidence log and change history

Append a dated entry for every meaningful implementation/checkpoint. Include exact branch, PR, head SHA, checks/run IDs, changed areas, remaining failures, deployment source SHA, and whether production was touched.

| Date | Phase / PR | Branch + exact SHA | Evidence | Status / next action |
|---|---|---|---|---|
| 2026-11-17 | Baseline + plan creation | Baseline observed: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` | GitHub commit/status inspected; AI Studio workspace checkpoint read from `docs/CONTINUE_HERE.md`; Vercel team deployment inventory blocked by 403 authorization | Phase 0 IN PROGRESS; refresh PR inventory and reconcile workspace changes |

### Update protocol
1. Update the phase status and checkboxes in the same PR that implements the work.
2. Add a new evidence-log row; do not overwrite historical evidence.
3. Record blockers precisely (missing permission, environment limitation, failing assertion) rather than marking the task complete.
4. If a commit changes the PR head after CI, all prior exact-SHA evidence is stale for that new head.
5. Before context limits, update this file and `docs/CONTINUE_HERE.md`, then provide a continuation prompt naming the next exact action and latest verified SHA.
