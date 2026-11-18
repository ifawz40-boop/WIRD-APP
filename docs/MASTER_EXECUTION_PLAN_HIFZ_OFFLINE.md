# WIRD — Master Execution Plan
## Advanced Hifz, Full Offline Readiness, Missed-Day Recovery & Durable Plan Archive

**Created:** 2026-11-17  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Production:** https://wird-app.vercel.app/  
**Plan status:** APPROVED — implementation must proceed through evidence-gated phases  
**Baseline source:** `main` at `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` (documentation/workspace status commit; verify live HEAD before every implementation or merge action)

> This is the persistent, editable execution tracker. Update this file in every implementation PR/checkpoint. A task is not complete because code exists: mark it complete only when its acceptance criteria pass on the exact tested SHA. Keep historical evidence and never rewrite prior user-progress records.

---

## Current execution checkpoint — 2026-11-18

**Active integration candidate:** PR #390, branch `feat/offline-mushaf-package-20261117`.
- Last completed full application gate: Quality Gate #4599 / run `44235296378`, exact SHA `eb7394e5f86c5d9b2d3a155df04861bb8e634bea`. Application job PASS: 776 unit assertions, 31 Firestore Rules Emulator tests, 604 Mushaf coordinate maps, API import/audio CDN smoke, TypeScript, production build, production server startup, and 184 Playwright passed / 0 failed / 2 intentional viewport skips. Printed Mushaf partial-download/resume/offline-open passed on Desktop and Mobile.
- Security audit job FAIL: `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366. No fixed upstream release found. No override, suppression, threshold reduction, or risk acceptance.
- Quality Gate #4604 completed on exact SHA `c69f6dc15b7067bcd7d40f266d5ab7dbe35e36fe`: 776 unit assertions, 31 Firestore Rules, 604 Mushaf maps, 186 Playwright passed / 0 failed / 2 intentional skips. Three-plan dashboard UI regression passed Desktop and Mobile, and selected plan ID was preserved in session route. A subsequent Service Worker cache v4 change and documentation update are on the current PR head `c36d982e4b29385b56fecbbdd0fa82c0289a3e65`; a fresh exact-head gate is required.
- Offline Mushaf hardening: MJS/WASM included in public and emitted-asset manifests and Service Worker MIME allowlist; downloaded SVG pages are sanitized before Cache Storage persistence, with regression coverage.
- Offline audio hardening: exact ordered ayah-sequence job fingerprints; IndexedDB v3→v4 migration preserves legacy queued/paused jobs and avoids disjoint-range fingerprint collisions. Explicit downloads support Surah/Juz/plan with curated Al Quran Cloud reciters; EveryAyah remains stream-only.
- Official Al Quran Cloud Terms rechecked 2026-11-18 (page last updated 2026-11-13): recitations remain copyright of reciters/estates; streaming, embedding and downloading permitted for personal/educational use; terms warn reciters may request removal in a commercial product. Do not assume this permits future commercial monetization or rehosting.
- Main remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; PR #390 is Draft/HOLD, 204 commits ahead at the last comparison. No merge or production deployment. Production deployment source SHA and real-device cold-restart/airplane-mode acceptance remain unverified.

**Phase 0 status:** PARTIAL — source baseline and current PR/CI inventory are recorded; live Production deployment verification remains unavailable.

**Phase 2 status:** IMPLEMENTED IN PR #390 CANDIDATE / RELEASE HOLD — offline audio repository/download manager, local-first playback, app-shell preparation, and 604-page Mushaf package exist and automated tests pass on #4599. Exact-head #4604 pending. Real-device restart/airplane-mode, storage eviction, and install/update lifecycle acceptance still required.

**Phase 5 status:** BLOCKED — high-severity dependency audit finding unresolved; latest exact-head CI still running; Preview/Production promotion prohibited.

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
**Status: PARTIAL — main baseline and current PR inventory verified; live Production source SHA remains unverified**

- [ ] Re-fetch live `main` HEAD, open PR inventory, branch heads, exact CI checks, and changed paths.
- [ ] Reconcile the uncommitted Google AI Studio workspace changes into a dedicated feature branch/PR; inspect the complete diff before push.
- [ ] Map current implementation against all four workstreams: cumulative memorization, audio/PWA, missed-day recovery/testing, plan archive.
- [ ] Inspect existing IndexedDB schema/version, localStorage plan history, sync journal/outbox transactions, Service Worker routes/cache policy, audio providers, and existing E2E coverage.
- [ ] Record current production deployment/source SHA and live smoke status when Vercel team access is authorized; do not infer deployment from a generic status check.
- [ ] Produce a gap matrix linking each requirement to existing source files, tests, and the next smallest safe PR.

**Exit criteria:** one verified baseline SHA; inventory of open PRs and conflicts; no duplicate competing implementations; explicit list of gaps and safe PR sequence.

### Phase 1 — Cumulative memorization studio
**Status: PARTIAL — cumulative mode, masking, range playback and weak-ayah capture exist; durable guided-session recovery is not established**

- [ ] Preserve existing Free mode behavior and regression coverage.
- [ ] Add a guided `cumulative_linking` session mode with explicit phases: `listen_repeat`, `masking_recall`, `cumulative_link`.
- [ ] Support per-ayah repetition target, progressive masking, completion state, and a bounded cumulative window (default up to five preceding ayat or current session start).
- [ ] Play the current ayah and cumulative range through the shared local-first audio resolver.
- [ ] Add immediate “record struggling ayah” action through the durable activity/review transaction; session progress must survive navigation/reload.
- [ ] Keep session state recoverable after interruption; avoid requiring microphone access or AI pronunciation scoring.
- [ ] Add unit, integration, and desktop/mobile Playwright coverage for mode switching, phase progression, audio boundaries, failure recovery, and weak-ayah recording.

**Acceptance:** Free mode unchanged; cumulative mode completes an end-to-end session; ayah order and boundaries are correct; weak ayah event is durable; reload/re-entry preserves progress; tests pass on exact SHA.

### Phase 2 — Offline audio repository, downloads, and PWA readiness
**Status: IMPLEMENTED IN PR #390 CANDIDATE / RELEASE HOLD — automated gates pass on prior exact SHA; real-device and latest-head acceptance remain incomplete**

#### 2A. Source and rights validation
- [x] Verify official Al Quran Cloud documentation and applicable terms for the precise reciter/audio endpoint, permitted caching and offline storage, attribution, and redistribution restrictions. Rechecked 2026-11-18: personal/educational download and local caching allowed; reciters retain copyright; commercial use may trigger removal request; no rehosting/redistribution.
- [x] Maintain an explicit allowlist of reciter IDs and source metadata; reject unknown/unverified reciters.
- [x] Confirm EveryAyah is used only for live online streaming and is never persisted for offline playback.
- [x] Document license/source evidence and a review date. Recheck at release and before any commercial use.

#### 2B. Unified audio repository
- [x] Consolidate on one IndexedDB repository with `jobs`, `files`, and `jobItems`; do not merge competing legacy audio stores.
- [x] Enforce unique canonical file identity `reciterId:globalAyahNumber`.
- [x] Store audio bytes in isolated Cache Storage cache `wird-offline-quran-audio-v1`; metadata records actual availability and `cacheGenerationId`.
- [x] Add cross-tab locking/coordination and a maximum of two simultaneous downloads.
- [x] Implement pause, resume, cancel, retry, progress, quota preflight, and safe cleanup with AbortController.
- [x] Reference-count shared ayah files across jobs/plans/manual pins; deleting one plan/job must not delete a still-referenced file.
- [x] Verify cache bytes on reads; handle cache eviction, stale generation, partial writes, orphan records, and interrupted transactions.
- [x] Keep the entire audio repository local to the device and outside Firestore/remote sync.

#### 2C. Offline readiness center and PWA
- [x] Build a clear readiness center for text/app shell preparation and per-surah/per-plan audio downloads.
- [x] Show estimated required space vs `navigator.storage.estimate()`, safety headroom, persistence status, actual used space, and recoverable storage.
- [x] Provide selective deletion and clear distinction between downloaded audio and transient browser cache.
- [x] Verify PWA install behavior and hide the install CTA when already installed; include a concise Safari/iOS manual-install guide.
- [x] Enumerate features as fully offline, partially offline, or online-only; do not label the whole app “100% offline” while any core feature still requires a service.
- [ ] Verify shell and local Quran/tafsir routes after cold restart in airplane mode; keep live-only features graceful and explicit.

**Acceptance:** approved reciter files download, pause/resume/cancel, deduplicate, and play after restart without network; shared references survive selective deletion; account changes cannot expose or delete another account's data; quota/cache failures recover safely; PWA shell and verified local text remain usable offline; all limitations are accurately disclosed.

### Phase 3 — Missed-day recovery and review tests
**Status: PARTIAL — missed-day detection, three recovery actions and local-text test modes exist; preview/edge-case acceptance remains incomplete**

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
**Status: PARTIAL — IndexedDB v10 archive stores, scoped hydration/migration and journal/outbox transaction exist; aggregate bounds and remote chunk protocol remain open**

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
**Status: BLOCKED — dependency audit fails on picomatch@4.0.7; exact-head #4604 and real-device acceptance remain outstanding**

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

## 4A. Immediate owner-requested local/offline tasks — 2026-11-17

This is the owner's immediate execution queue. It is deliberately limited to the four existing-app tasks below and takes priority over unrelated product work. These tasks complement (but do not replace) Phases 1–5 above.

| Order | Requirement | Implementation PR | Current status | Acceptance still required |
|---:|---|---:|---|---|
| 1 | Dashboard must surface due/overdue memorization from every active, non-paused engine plan, not only the first plan | #383 | Implemented in Draft; NOT VERIFIED | Exact-head CI, three-plan dashboard E2E, correct plan completion, offline persistence/restart |
| 2 | Previous/next ayah controls immediately beneath Quran ayahs in reading surfaces | #384 | Implemented in Draft; NOT VERIFIED | Exact-head CI, desktop/mobile keyboard and touch E2E, cross-Surah boundaries, no Quran text changes |
| 3 | Printed Mushaf one-page and facing two-page view | #385 | Implemented in Draft; NOT VERIFIED | Exact-head CI, 604-page coordinate coverage, RTL/right-page-first layout, responsive mobile, saved preference, audio boundaries |
| 4 | In facing Mushaf mode, either page can display the full Tafsir al-Muyassar for the Quran ayahs on the opposite page; both Quran by default | #386 | Implemented in Draft; NOT VERIFIED | Exact-head CI, full 114-surah source validation, resumable IndexedDB download, reload/offline reading, both directions, navigation and audio behavior |

### Current PR chain and release blocker

- Main baseline last observed: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. Re-fetch before merge.
- PR #382 (`fix/main-bun-lockfile-alignment-20261117`, head `e8ca61cf86b0d49d94783670f76db1c250c7c146`) reconciles `bun.lock`. Quality Gate run #4461 installs with frozen lockfile but fails at `bun audit --audit-level=high` on picomatch@4.0.7 through Vite → tinyglobby → fdir → picomatch. Advisory GHSA-fc5q-39xc-vjpf / CVE-2026-112366 is High (CVSS 8.7); as of 2026-11-17 the advisory states affected through 4.0.7 and no patched release. Upstream PRs #237/#238 remain open/unmerged; PR #238 has a reported remaining exponential case. **Do not suppress the audit, reduce its severity threshold, or pin an incomplete unmerged patch.**
- PR #383 head `45acc719a90049f1f71606995cb02943ac5e337d`; Quality Gate run #4460 fails at frozen install because the original main lockfile is inconsistent. Its unit/test/build/browser steps did not run.
- PR #384 head `3f59506204e21f702749159333162e80ab2f324d`; Vercel Preview READY, but no GitHub Actions workflow run.
- PR #385 head `10529d88e358b35a63c7b41060ffe966141d54e2`; Vercel Preview READY, but no GitHub Actions workflow run.
- PR #386 latest observed head `1f566ed6073b9848be3660a2b8a0790100a9c62f`; Vercel Preview blocked by Free-plan `build-rate-limit`; no GitHub Actions workflow run. The CI workflow's `pull_request.branches: [main]` filter means stacked PRs targeting feature branches do not trigger the Quality Gate. Preview success is not test evidence.
- All four feature PRs remain Draft/HOLD. No task is complete, merged, or production-published until exact-head tests pass. No Production deployment, Firebase Rules/data, Vercel settings/secrets, sync flags, or user data changed.

### Task 4 source and storage constraints

- Official digital source: QuranEnc Arabic Tafsir al-Muyassar, key `arabic_moyassar`, publisher King Fahd Complex, catalogue version `1.0.1` dated `2026-11-09`.
- Use the official catalogue endpoint to confirm the version before download. The API requires no authentication and documents open CORS.
- Store the complete original source payload unchanged, including footnotes and embedded edition metadata. Validate exact local Quran verse counts and sequential `sura`/`aya` coordinates for all 114 surahs before declaring offline-ready.
- Download only after explicit user action; one surah at a time; resume verified surahs; reading uses IndexedDB only. Device-local only, never Firestore. The Quran text shown beside Tafsir always comes from WIRD's verified local Quran corpus.
- Follow QuranEnc reuse terms: no edits/additions/deletions; identify source and publisher; show version; preserve embedded edition information; report corrections; update to newer source versions; no unsuitable ads.
- Full source/reuse record: `docs/TAFSIR_OFFLINE_SOURCE.md`.

### Next actions for this immediate queue

1. Keep PRs #382–#386 intact; do not merge while the dependency security gate is failing.
2. Re-check the official picomatch advisory and upstream candidate fixes; adopt only a complete reviewed remediation and retain the blocking audit.
3. Once the dependency gate is safe, create a main-target integration validation path so all stacked changes receive the actual Quality Gate. Fix only reproduced failures, then rerun exact final SHAs.
4. Verify a Preview built from the exact tested head when the Vercel quota permits. Production remains a separate owner-authorized release step.
5. After the four tasks are released, reconcile offline app-shell PR #366 and unified audio PR #368 as the next local/offline work; do not merge legacy competing audio stores #358/#359.

---

## 5. Evidence log and change history

Append a dated entry for every meaningful implementation/checkpoint. Include exact branch, PR, head SHA, checks/run IDs, changed areas, remaining failures, deployment source SHA, and whether production was touched.

| Date | Phase / PR | Branch + exact SHA | Evidence | Status / next action |
|---|---|---|---|---|
| 2026-11-17 | Source-level implementation audit | `main` `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` | Inspected session, plan lifecycle/UI, test generator, archive DB v10/AuthGate, audio library/manager, PWA prep and tests; exact file SHAs in Section 7 | All four tracks PARTIAL, not greenfield; close durable-session, schedule-preview, archive bounds/remote chunk, cross-tab/orphan/device gates |
| 2026-11-17 | Baseline + plan creation | Baseline observed: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` | GitHub commit/status inspected; AI Studio workspace checkpoint read from `docs/CONTINUE_HERE.md`; Vercel team deployment inventory blocked by 403 authorization | Phase 0 IN PROGRESS; refresh PR inventory and reconcile workspace changes |

### Update protocol
1. Update the phase status and checkboxes in the same PR that implements the work.
2. Add a new evidence-log row; do not overwrite historical evidence.
3. Record blockers precisely (missing permission, environment limitation, failing assertion) rather than marking the task complete.
4. If a commit changes the PR head after CI, all prior exact-SHA evidence is stale for that new head.
5. Before context limits, update this file and `docs/CONTINUE_HERE.md`, then provide a continuation prompt naming the next exact action and latest verified SHA.


---



## 7. Source-level implementation audit — current main snapshot (2026-11-17)

**Audit base:** `main` = `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. All file SHAs below were fetched from this exact ref. This is source inspection, not a fresh full test run or Production verification.

### 7.1 Cumulative memorization — PARTIAL, not greenfield
- `src/components/session/MemorizationSessionView.tsx` (`ed24b21b...`) already has `free` and `cumulative_linking` modes; progressive masking levels; last-five/from-start cumulative windows; queue playback of the selected range; a local `masteredIndices` counter; and weak-ayah capture through the supplied revision callback with a mutation ID.
- Current implementation state (`studyMethod`, `cumulativeWindow`, `masteredIndices`, repeat/mask state) is React component state. No durable per-step/session checkpoint or resume protocol was identified in this source path. The workflow is not yet proven to enforce an explicit per-ayah phase machine with a durable transition from listen/repeat → recall → cumulative link. `masteredIndices` is session-local and resets when range changes.
- Existing E2E files cover audio repetition/display/plan UX; no dedicated exact-head test proving the full cumulative guided workflow + reload/resume was found in this audit.
- **Next:** inspect parent/session lifecycle and the weak-review callback transaction; define a small durable session state model before adding UI or changing Free mode.

### 7.2 Missed-day recovery and test generation — PARTIAL, substantial existing implementation
- `src/services/planLifecycle.ts` (`17ddf80f...`) implements detection of overdue non-rest incomplete days and three deterministic transformations: shift pending work forward, schedule a light recovery day, and rebalance remaining work. The split logic preserves completed task records.
- `src/components/plans/PlanningEngineWizard.tsx` (`d0970347...`) displays backlog counts, missed memorization ayahs/revision tasks and first pending range; it presents all three choices and requires explicit confirmation. It does **not** render a computed before/after schedule preview; current confirmation text describes the selected action only.
- `src/services/planMissedDayRecovery.test.ts` (`eed6a904...`) covers missed-day detection, paused/rest/completed exclusions, preservation of completed history, forward shifting, light recovery and rebalancing. Additional timezone/DST, repeated confirmation/idempotency, rollback/undo and schedule preview tests were not established in this review.
- `src/services/testQuestionGenerator.ts` (`4d75cccf...`) supports scopes `all`, `surah`, `weak_priority` and `fill_blank_words`; question text is loaded through the local Quran data loader. The UI resolves the displayed missing-word verse from local data. Add exact canonical-text equality and boundary tests before marking complete.

### 7.3 Long plan archive — PARTIAL, core local migration already integrated
- `src/services/indexedDbSyncJournal.ts` (`9f43a774...`) opens `wird-sync-journal` at **IndexedDB database version 10** and creates `enginePlanArchiveHeads`, `enginePlanArchiveManifests`, and `enginePlanArchiveRecords` alongside journal/outbox stores.
- `src/services/enginePlanArchive.ts` (`eedd84a7...`) validates guest/user scope keys, canonicalizes JSON, computes SHA-256, stages legacy data, independently reads back and verifies it, then commits the manifest/head. It retains the legacy localStorage source bytes. `src/components/auth/AuthGate.tsx` (`23a0860d...`) awaits `initializeEnginePlansArchiveForScope` during initial scope hydration and scope changes. `enginePlanArchive.test.ts` (`232726d8...`) covers lossless legacy migration, retained rollback bytes, archive export and atomic journal/outbox persistence.
- `commitEnginePlansArchiveRevision` can commit the archive revision with the journal/outbox transaction. However, no explicit aggregate cap for archive bytes, plan count, manifest size, record count, or peak serialization memory was found in `enginePlanArchive.ts`. The journal currently defines a 450,000-byte Engine Plan mutation payload ceiling; this is not a chunked remote archive protocol. Do not describe remote long-plan sync as solved.
- **Next:** define explicit aggregate/resource bounds, test very large plans and peak memory, inspect the exact AuthGate failure/recovery UI, then design remote chunk transport separately while keeping production sync flags untouched.

### 7.4 Offline audio + PWA — PARTIAL, user-facing manager already exists
- `src/services/offlineQuranAudioLibrary.ts` (`3467a096...`) uses separate DB `wird-offline-audio` v1, stores `jobs`/`files`/`jobItems`, cache `wird-offline-quran-audio-v1`, canonical `reciterId:globalAyahNumber` keys, generation-scoped cache keys, max concurrency 2, quota preflight with a 25 MB reserve, Cache Storage read-back validation, pause/resume/cancel/retry, reference-aware job deletion and reconciliation. The reader's `resolvePlaybackSource` uses verified local Cache Storage bytes first and falls back to network.
- Cross-tab coordination uses Web Locks only when `navigator.locks` exists; fallback is an uncoordinated in-process task. No durable IndexedDB lease/BroadcastChannel fallback was identified. `reconcileLibrary` reconciles known metadata against cache and finalizes `deletionPending` rows, but a complete sweep for cache objects orphaned before their IndexedDB metadata commit was not established.
- `src/components/settings/SettingsView.tsx` (`8945709d...`) already exposes the audio manager: approved reciter selection, surah/juz/plan ranges, quota preview, job list and pause/resume/cancel/delete actions; it also exposes app asset preparation, storage persistence/usage and package status. `offlinePreparationService.ts` (`21223214`) and `public/sw.js` (`c6849fbf...`) implement app-shell/lazy-asset preparation. Safari/iOS install instructions are present in `OfflineStatusControls.tsx`.
- `offlineQuranAudioLibrary.test.ts` (`bb7b4823...`) includes shared-file reference deletion, orphan finalization, quota preflight, pause/resume and cancellation tests. These are service/fake-cache tests, not physical-device cold-restart/airplane-mode proof.
- Rights boundary: `docs/engineering/AUDIO_SOURCE_ATTRIBUTION.md` (`53ec7a8b...`) keeps EveryAyah stream-only. The offline storage contract records a separate Al Quran Cloud/Islamic Network reciter terms review; re-check the exact current official terms and per-reciter restrictions before release. Do not broaden the allowlist or imply blanket redistribution rights.
- `docs/offline/OFFLINE_CAPABILITY_MATRIX_AR.md` (`b426ce99...`) and parts of `docs/offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md` (`b27d49f7...`) still describe some now-present services/UI as not implemented. Reconcile these documents after completing the source audit; preserve their valid remaining release gates.

### 7.5 Source map / exact fetched file SHAs
| Area | File | SHA prefix |
|---|---|---|
| Session | `src/components/session/MemorizationSessionView.tsx` | `ed24b21b` |
| Recovery | `src/services/planLifecycle.ts` | `17ddf80f` |
| Recovery UI | `src/components/plans/PlanningEngineWizard.tsx` | `d0970347` |
| Test generation | `src/services/testQuestionGenerator.ts` | `4d75cccf` |
| Archive | `src/services/enginePlanArchive.ts` | `eedd84a7` |
| IDB schema/journal | `src/services/indexedDbSyncJournal.ts` | `9f43a774` |
| Archive startup gate | `src/components/auth/AuthGate.tsx` | `23a0860d` |
| Audio library | `src/services/offlineQuranAudioLibrary.ts` | `3467a096` |
| Audio manager UI | `src/components/settings/SettingsView.tsx` | `8945709d` |
| Audio tests | `src/services/offlineQuranAudioLibrary.test.ts` | `bb7b4823` |
| App shell | `public/sw.js` | `c6849fbf` |
| Offline capability docs | `docs/offline/OFFLINE_CAPABILITY_MATRIX_AR.md` | `b426ce99` |

**Source audit conclusion:** all four roadmap tracks have meaningful existing implementation on main. None should be treated as green/complete yet. Prioritize closing the specific integration/recovery/acceptance gaps above instead of rebuilding parallel systems.

## 8. Phase 0 — verified PR reconciliation audit (2026-11-17)

### Live repository snapshot
- Default branch: `main`.
- Latest commit observed on `main`: `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- Open PR inventory was refreshed. Relevant work remains open and Draft; do not merge feature branches as a bundle.
- PR #381 (this tracker) has a Vercel Preview reported Ready by the Vercel GitHub bot for deployment `826wv9M7jQwj5NxY7jfHGgeJjDoc`, URL: https://wird-app-git-docs-advanced-hifz-830fc1-xm8eslam-9174s-projects.vercel.app . This is a documentation preview, not production verification.
- Vercel team API deployment listing still returned 403 / authorization failure in this audit. Do not infer the Production source SHA from the PR preview.
- Branches and old PR heads are not interchangeable with current `main`; re-fetch base/head and checks before every merge.

### Relevant PR findings — exact observed heads

| PR | Observed head SHA | Verified scope | Current decision |
|---|---|---|---|
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/app-shell and explicit offline public asset preparation; network navigation fallback; storage estimate/persistence reporting. Does not implement the persistent download library; EveryAyah remains stream-only. | HOLD — run 43258830250 failed with no recorded steps and logs unavailable (BlobNotFound); Vercel status blocked by Free-plan deployment limit. No browser/device airplane-mode proof. |
| #368 | `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8` | Unified IndexedDB jobs/files/jobItems metadata, Cache Storage adapter and downloader with concurrency limit, pause/cancel/resume/retry, validation and recovery tests. Still missing cross-tab ownership/locking, complete orphan-deletion orchestration, quota error UX, finished UI, reader playback integration, physical-device restart/offline evidence. | HOLD — run 43571432459 failed with no recorded steps and logs unavailable (BlobNotFound). Preview READY for this exact SHA; preview readiness is not CI or device acceptance. |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Pure deterministic chunk codec with SHA-256 and corruption checks; not connected to IndexedDB archive migration or real Outbox/Inbox/Firestore transport. Aggregate archive/manifest/resource bounds and memory peak limits remain unresolved. | HOLD — run 43278752980 failed with no recorded steps and logs unavailable (BlobNotFound). |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | Interim 800 KB Engine Plan single-document budget; not a chunked archive transport. Shared-file overlap with #369/#371 and related wizard/test aggregator files was documented. | Do not merge as the archive solution. Reconcile only after the versioned archive protocol is designed and tested. |
| #380 | `4e3aa0067f71bfecd94feb45f1b9de035e4aeb9b` | Repository/lockfile and Playwright test-maintenance changes; no product runtime code. | HOLD — exact-head run 43684513683 passed automated tests (731), 604 Mushaf maps, native TypeScript API imports, approved audio CDN/range checks, Firestore Rules Emulator (31), TypeScript, production build, and server smoke. Desktop/mobile browser smoke failed in two plan-wizard assertions because the expected “معاينة الجدول الزمني المقترح” button was not found. Re-run after correcting the actual UI/test mismatch; no merge yet. |

### Critical reconciliation decisions

1. **Do not merge #358 or #359 separately.** They are superseded by #368's consolidated store contract and would recreate competing audio stores.
2. **Do not treat #366 as the offline audio downloader.** It is the PWA/app-shell and optional cache readiness layer. #368 owns durable audio downloads and file references. A later integration PR must reconcile cache namespaces and cleanup without deleting private/user data or shared files.
3. **Do not treat #371 as a complete archive.** It is a codec only. Phase 4 still requires the actual IndexedDB v10 (or correctly incremented current DB version) migration, scoped archive stores, startup gate, bounded manifest/chunk protocol, atomic activation, rollback and outbox/journal consistency.
4. **Do not increase the single Firestore document limit to simulate unlimited plan storage.** #367's 800 KB is an interim envelope. Larger plan history requires a bounded multi-document protocol and an authoritative quota policy; no fictional plan tiers.
5. **#380 is a separate repository hygiene/test gate**, not a feature implementation. Resolve the two browser failures and exact-head rerun before considering its merge. Its non-browser gates are strong evidence for that SHA only.
6. **Cumulative memorization and missed-day recovery are not evidenced by these PRs.** They remain unimplemented/unverified until source and tests are mapped.
7. The Google AI Studio workspace-only results recorded in Section 2 remain separate from these GitHub branch/CI results; do not copy those counts into GitHub evidence.

### Updated gap matrix

| Workstream | Existing evidence | Remaining work before acceptance |
|---|---|---|
| Cumulative Hifz studio | No relevant implementation PR confirmed in this audit. | Inspect session/studio source and current review-event transaction; design a small additive mode and tests without changing Free mode. |
| PWA/app shell | #366 provides offline asset enumeration, app-shell resilience, adaptive optional-cache bounds and storage capability reporting. | Exact-head CI must be inspectable and green; integrate with #368 cache ownership; readiness UI, Safari/iOS install guidance, feature-by-feature offline map, browser/device cold-restart tests. |
| Downloadable audio | #368 provides repository/downloader foundation and isolated tests (29/29 reported in branch notes). | Cross-tab lock/ownership; end-to-end orphan cleanup; quota recovery/UX; license/reciter allowlist evidence; download manager UI; local-first reader playback; restart/airplane-mode and account-isolation tests. |
| Missed-day recovery + test modes | No relevant implementation PR confirmed in this audit. | Inspect plan scheduling engine and immutable completion events; define preview/confirm transaction and three approved recovery options; canonical missing-word test generator and weak-ayah integration. |
| Long plan archive | #371 codec only; #367 interim payload budget. | Define strict aggregate/resource limits; implement real IndexedDB archive stores and version migration; bounded chunk IO; atomic manifest activation; startup gate; compatibility, rollback, corruption, guest/user isolation and sync consistency. |
| Release/quality gates | #380 has strong non-browser gate evidence but 2 browser failures. #366/#368/#371 have non-inspectable failing jobs. | Fix #380 E2E mismatch; recover inspectable CI for each feature head; ensure required checks run on exact head; distinguish Preview from Production. |

### Recommended implementation order after Phase 0
1. Resolve #380's two Playwright failures and obtain a fully green exact-head run. Keep its scope separate; merge only after reviewing its complete final diff and exact SHA.
2. Rebase/port #366 and #368 onto the verified new `main` serially. First settle PWA cache ownership contract, then integrate the durable downloader, then add the user-facing download manager and reader playback. Do not merge overlapping cache work independently.
3. Design Phase 4 archive protocol before integrating #367/#371. Specify hard bounds (total bytes, record count, chunks, fragments, manifest bytes and peak memory) before coding. Then implement local archive migration and separately evaluate remote chunk transport; production sync remains off.
4. Implement cumulative Hifz and missed-day recovery as separate, additive feature PRs after mapping the existing session and plan event models.
5. Run full cross-workstream regression only after integration; exact SHA and test artifacts are mandatory.

**Phase 0 status:** PARTIALLY COMPLETE — live main and open PR inventory inspected; four core PRs and one supporting PR reviewed; exact-head workflow evidence inspected. Source-level mapping of session engine, scheduler, IndexedDB schema/migration chain, sync journal/outbox and service-worker/audio integration remains to be completed before Phase 0 can be marked PASS.


### Follow-up exact-head CI and test correction — 2026-11-17

- PR #380 test correction committed: `99408208b8bd4027b05ee544b908211911949c96`. It adds the missing transition from wizard step 2 to step 3 before asserting the preview button and uses the actual UI label `معاينة الجدول المقترح`. This is a test-only change; no application runtime source changed.
- The prior exact-head #380 run `43684513683` on `4e3aa0067f71bfecd94feb45f1b9de035e4aeb9b` is still the only fully inspectable run: 731 unit/integration assertions, 604 Mushaf maps, native API imports, Quran audio CDN/range checks, 31 Firestore Rules emulator assertions, TypeScript, build and server smoke passed; two desktop/mobile Playwright assertions failed because the preview-button locator was queried before advancing from step 2 to step 3. The correction above addresses that exact sequence/label mismatch. A new exact-head run for `9940820...` has not yet appeared in the fetched workflow-run list; no pass is claimed.
- PR #381 tracker head: `598ca064d3c6570f2869871ce2432a1e826e2043`. Its Vercel Preview status is SUCCESS, while its GitHub Quality Gate run `44102941634` failed at `bun install --frozen-lockfile`: “lockfile had changes, but lockfile is frozen”. All later gates were skipped. This exposes a baseline package/lockfile mismatch on `main`; the documentation PR is not mergeable as a validated code-quality gate until #380's manifest/lockfile repair is integrated or the CI baseline is otherwise repaired.
- Main currently has `package.json` name `react-example` while the #380 branch aligns the package and Bun workspace name to `wird-app`; main's lock workspace also differs from its package manifest (e.g. dependency/devDependency placement and esbuild version). This is the likely reason frozen install fails on main, but the fix must be proven by a successful exact-head install, not assumed.
- Current #380 Vercel Preview for the corrected head is pending/building at deployment `4BvJ8d9tiAo6DjRDbU7eNuT8TQSn`; no successful Preview status for `9940820...` was available at this update.
- Do not merge #380 until the corrected exact-head run passes every required gate, including desktop/mobile Playwright and the 604-map Mushaf gate. Do not merge #381 ahead of the lockfile baseline repair; keep it Draft until the doc-only PR can pass its applicable validation or the quality gate is rerun against a repaired base.

**Next exact action:** obtain a new inspectable GitHub Quality Gate for #380 head `99408208b8bd4027b05ee544b908211911949c96`; if it does not trigger, diagnose the workflow trigger rather than assuming success. Then review the full #380 diff and merge only if all exact-head gates pass. Re-fetch main and PR bases immediately before any merge.


### Live follow-up checkpoint — 2026-11-17 (after PR #381 Quality Gate run 4446)

**Live state refreshed from GitHub; this supersedes older head/status statements above where they conflict.**

- `main` remains observed at `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. Current `main/package.json` declares workspace name `react-example` and override `@grpc/grpc-js: 1.14.6`, while `main/bun.lock` has no root `overrides` block and its root workspace dependency/devDependency layout and `esbuild` version (`^0.25.0`) differ from the manifest (`^0.28.2`). This is directly confirmed by fetching both files from `main`.
- **PR #381** current head `d02a38154eaf6c2c48d5e6b05f1ba2b0decf03c2`, base `f70bf5e...`, Draft. Quality Gate run `44103216018` / run number 4446 checked merge ref `502d3cea36884b2f3f4cf975c18eba466e81b77d` and failed at `bun install --frozen-lockfile`: `overrides in package.json changed since bun.lock was saved`. All tests, Mushaf maps, API/audio checks, Firestore Rules, TypeScript, build, server smoke, and Playwright were SKIPPED. The job log was retrieved and confirms the exact error. Keep #381 Draft/HOLD; do not interpret this as a test assertion failure.
- **PR #380** actual current head is `99408208b8bd4027b05ee544b908211911949c96` (13 commits, 9 files, 88 additions / 107 deletions), but its base SHA remains `68dc6ea684c5bf8ef541163860ebd05e8377b468` while current main is `f70bf5e...`; GitHub reports `mergeable=false`. The PR description has stale head/run details and needs reconciliation. No GitHub Actions workflow run was returned for the actual `99408208...` head. Combined status reports a Vercel success context, but source-SHA deployment confirmation and browser smoke are not established.
- #380 diff review confirms no application runtime source paths changed. It restores one tracked gold Arabic HUKM artwork file, updates `package.json`/`bun.lock` (including workspace name, `@grpc/grpc-js` override, dependency placement, `esbuild` resolution from 0.25 to 0.28.2, and dev dependencies), and adjusts seven Playwright specs to current accessible UI/flow semantics. These changes are not yet approved for merge: rebase/port onto current main, review why lockfile dependency graph changes, run `bun install --frozen-lockfile` on the resulting merge ref, then rerun the complete exact-head Quality Gate including desktop/mobile Playwright and all 604 Mushaf maps.
- **No PR merged.** No runtime source, Quran content, Firebase Rules/data, Vercel settings/secrets, production sync flags, or Production deployment was changed.

**Next exact actions:** (1) reconcile #380 with current `main` rather than its stale base; preserve artwork and inspect all lockfile resolution changes; (2) obtain an inspectable full Quality Gate on the new exact merge/head SHA; (3) only after successful gates and final diff review, consider squash merge with `expected_head_sha`; (4) rebase #381 onto the repaired main and rerun its validation. Do not merge either PR before these steps.


### PR graph refresh — 2026-11-17 (after documentation checkpoint commits)

- PR #380 branch comparison against current `main` is now confirmed `diverged`: 13 commits ahead, 2 behind; merge base is `68dc6ea684c5bf8ef541163860ebd05e8377b468`, current main is `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. GitHub reports `mergeable=false`. This is a real rebase/reconciliation requirement, not merely stale PR text. Preserve artwork and inspect all 9 changed paths after rebase.
- PR #381 tracker head advanced to `eb0c71ea09987e61c7a8b944866265e8ded4e5b3` after the two documentation updates. GitHub reports PR merge ref `3f0430a4fd951de8fdbaa6223d3fb5f1c3f4c914`; no workflow run or combined status was returned for that merge ref at the latest check. The earlier run #4446 remains the latest inspectable failure and is on the previous merge ref `502d3cea...`. Re-fetch after the latest head update; do not assume a new run will pass.
- PR #380 head `99408208...` still has no GitHub Actions workflow run returned. Its Vercel status moved from pending/building in successive refreshes; this is not a substitute for the GitHub Quality Gate.



## Dependency baseline correction — 2026-11-17 (PR #382)

- Current main package.json blob 2dac5867... retains workspace name react-example, @grpc/grpc-js: 1.14.6 override, and dependencies/devDependencies/trustedDependencies as inspected.
- PR #380's bun.lock was ported onto a clean branch from current main, with only the lockfile workspace name normalized back to react-example. New PR #382: https://github.com/xm8eslam-stack/WIRD-APP/pull/382, branch fix/main-bun-lockfile-alignment-20261117, head c98a31f7a1a9ee41f1489b15609d3c2ccce18e69, merge ref cf378fb15af4e9423154c34dbaaf79b13139312d.
- Exact pre-PR structural validation passed: workspace name, root dependencies, devDependencies, overrides and trustedDependencies all match main/package.json; branch comparison is exactly one file (bun.lock) changed, 1 ahead / 0 behind.
- Quality Gate run 44105033897 (#4452) is active. At latest check, Node runtime verification, Bun setup, frozen install and dependency graph audit all passed; automated test suites were in progress. Remaining gates (604 Mushaf maps, API/audio checks, Firestore Rules, TypeScript, build, server smoke, desktop/mobile Playwright) pending. No merge until final exact-head gate green.
- Correction to earlier #380 interpretation: its current diff contains one binary file under .aistudio/.../.tempmediaStorage/, not a verified HUKM logo path. Do not merge that temporary artifact. #380's test edits are stale relative to current main in several files; e2e/ruqyah-ux.spec.ts is already identical on main. PR #382 intentionally excludes all #380 test edits and the temporary binary.
- No production changes or merges.


### PR #382 CI live checkpoint — 2026-11-17

- Quality Gate run #4452 (`44105033897`) for PR #382 exact head `c98a31f7a1a9ee41f1489b15609d3c2ccce18e69` / merge ref `cf378fb15af4e9423154c34dbaaf79b13139312d` remains `in_progress`.
- Completed successfully: Node/Vercel runtime verification, Bun setup, frozen lockfile install, committed dependency graph audit, automated test suites, native TS API imports, approved Quran audio CDN/range checks, Java setup, Firestore Rules Emulator, TypeScript, production build, and server startup smoke.
- 604 printed Mushaf coordinate map step was skipped by workflow for this lockfile-only change (no Quran map/source path changed); do not describe it as a fresh 604-map pass on this PR.
- Chromium installed and Node 26 restored successfully; desktop/mobile Playwright smoke is the only remaining active step at this checkpoint. Final run conclusion not yet available. Keep PR #382 Draft/HOLD until it completes successfully.
- Workflow job-log download returned BlobNotFound, so rely on the visible step conclusions and final job/run status; do not invent test counts.


## Latest evidence update — 2026-11-17 (PR #382 Playwright pending)

- PR #382 exact head `c98a31f7a1a9ee41f1489b15609d3c2ccce18e69`, merge ref `cf378fb15af4e9423154c34dbaaf79b13139312d`; one-file diff remains `bun.lock`.
- Quality Gate run `44105033897` / #4452: frozen install, dependency audit, automated suites, API imports, audio CDN/range, Firestore Rules Emulator, TypeScript, production build, server smoke all SUCCESS. Desktop/mobile Playwright remains IN PROGRESS. Upload diagnostics and cleanup pending.
- Mushaf coordinate-map step was SKIPPED due to lockfile-only scope; do not count as PASS.
- Job log retrieval returned BlobNotFound/404; no Playwright outcome can be inferred.
- No merge or Production/config/secret/sync-flag changes made. Phase 0 remains IN PROGRESS; all four product tracks remain PARTIAL pending their documented gaps.


## PR #382 exact-head Quality Gate result — 2026-11-17

- Re-fetched PR #382: OPEN / Draft / mergeable=true / not merged. Head `c98a31f7a1a9ee41f1489b15609d3c2ccce18e69`; base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`; merge ref `cf378fb15af4e9423154c34dbaaf79b13139312d`; changed files: exactly `bun.lock`.
- Quality Gate run #4452 (`44105033897`), job `134114950644`, completed with **FAILURE**. Frozen install, Bun audit, automated test suites, native TS API imports, audio CDN/range, Firestore Rules Emulator, TypeScript, production build and server startup smoke all succeeded.
- Mushaf coordinate-map step was **SKIPPED**, not passed. Desktop/mobile Playwright reported **160 passed, 2 skipped, 4 failed** (two failing tests reproduced in both desktop and mobile projects):
  1. `e2e/app-shell.spec.ts:205` — physical KeyB shortcut / mobile drawer test. The failure occurs at line 164: expected the Header button labelled `فتح الشريط الجانبي` with `aria-expanded=false`, but no matching button was found after synthetic Ctrl+KeyB dispatch.
  2. `e2e/memorization-audio-repeat.spec.ts:137` — media load error should return audio control to idle. At line 115 the loading status `جارٍ تحميل التلاوة` remained present after the test manually invoked the mock audio `onerror` callback.
- Source inspection: App.tsx listens for Ctrl/Cmd + physical `KeyB`; Header exposes the sidebar toggle state. MemorizationSessionView's `audio.onerror` handler does clear both `isPlaying` and `isAudioLoading` when the failed audio is still current. The E2E audio test currently does not wait for the asynchronous local/offline source resolution and mock Audio creation before invoking `onerror`; a test timing race is plausible but must be reproduced before changing assertions or production code. The sidebar failure is not yet explained; do not weaken its accessibility/behavior assertion without a root-cause test.
- Artifact `playwright-smoke-results` uploaded successfully (artifact ID `14338856662`, SHA-256 `978ba2e18968257d614fe2451cfe919fd9eb3ec1c0c4dda0675f1daf3b491c11`). Its contents have not yet been extracted in this session; error-context files are available in that artifact.
- **Decision:** do not merge #382. Do not attribute these failures to the lockfile without evidence; do not modify the one-file lockfile PR to hide unrelated test failures. Next: extract artifact error contexts; reproduce the two failures against unchanged `main` and the PR merge ref; fix only proven test/runtime causes on a separate narrow PR, then rerun full Quality Gate on exact SHAs. Recheck whether a clean lockfile-only run can pass after the suite is stabilized.
- No runtime, Quran, Firebase, Vercel, production, secret, environment-variable, or sync-flag change was made.


## Continuation checkpoint — 2026-11-17 22:40 +02:00

- Re-fetched GitHub state. Repository default branch remains `main`; latest verified historical baseline in this workstream is `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`. Do not assume that baseline is still the live HEAD without re-fetching it.
- PR #382 exact head `4332ea4cc4b2fa75e99d3e7a5dee22e2391b6f34`: frozen install PASS; full dependency audit FAIL on high-severity `picomatch@4.0.7` ReDoS advisory GHSA-fc5q-39xc-vjpf. Keep the audit blocking; do not suppress, downgrade, or pin an incomplete upstream patch.
- Quality Gate run #4467 (`44168185637`): unit suites PASS (756 passed), Firestore Rules Emulator PASS (31), native API import PASS, approved audio CDN/range check PASS, but Playwright failed one mobile audio idle-state assertion in `e2e/memorization-audio-repeat.spec.ts` (expected no audio status node after stopping; timed out). This is a real E2E failure, separate from the security audit.
- PR #383 initial exact-head run #4468 (`44168397712`): unit suites PASS (754 passed), Firestore Rules Emulator PASS (31); TypeScript failed in `src/App.tsx` because optional `day.memorizationTask` was spread into required `ScheduledTaskUnit`, and in `DashboardView.tsx` because the blocked daily-task union has no `enginePlanId`. Build/browser stages were skipped.
- Applied narrowly scoped source fixes on PR #383 branch `fix/dashboard-multiple-due-plan-tasks-20261117`: App.tsx now captures the already-filtered task as a non-null `task` on the match record and spreads that value; DashboardView forwards `enginePlanId` only for the non-blocked branch. Commits: `a2773fdc55e29975d16bfc0d0dbb4445cfffae4e`, `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`.
- Latest PR #383 head is `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`. At checkpoint time, no GitHub Actions run was associated with this new head; Vercel Preview was blocked by Free-plan `build-rate-limit`. Therefore the TS fixes are committed but NOT VERIFIED. Re-fetch workflow runs/status before proceeding.
- PR #384 head `022c1dd1cd5435f9c54a152e918e815dd601bbf5`, PR #385 head `10529d88e358b35a63c7b41060ffe966141d54e2`, PR #386 head `e3e26f26ac684fb97c0b1cffc636e1e5d5aa12db`; all remain Draft/unverified. PR #385 had a Vercel success context for its exact head; #384/#386 previews were blocked by build-rate-limit. PR #386 has no Actions run because it targets a feature branch and workflow evidence must be rechecked after trigger changes.
- PR #380 remains stale Draft/HOLD; do not merge. PR #381 remains documentation-only Draft in this checkpoint; keep this tracker updated in subsequent implementation commits.
- No merge to main, Production deployment, Firebase mutation, Vercel settings/secrets changes, or sync-flag changes were made. No production readiness is claimed.

### Next exact actions
1. Re-fetch PR #383 and workflow runs for head `8c7c5cd...`; if no run exists, inspect the PR workflow trigger and create a safe main-targeted validation path without merging unverified runtime changes.
2. Validate the TypeScript fixes, then resolve the mobile audio E2E failure with a behavior-correct assertion/fix (do not weaken the test to hide a real state issue).
3. Resolve the picomatch advisory only through a complete, reviewed upstream fix or safe dependency graph update; keep `bun audit --audit-level=high` blocking.
4. Only after parent gates pass, validate #383 on exact head, then #384, #385, #386 in dependency order with full desktop/mobile/offline coverage.
5. Update this file and `docs/CONTINUE_HERE.md` with exact SHAs, run IDs, failures, and verification results. Merge/publish only after all required gates and user-requested acceptance criteria pass.


## CI follow-up — 2026-11-17 22:55 +02:00

- PR #383 exact head `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`, Quality Gate run #4474 (`44171290167`) completed.
- Main validation job PASS: 756 unit assertions, 31 Firestore Rules Emulator tests, API import smoke, Quran audio CDN smoke 8/8, production and development server JSON smoke, TypeScript/lint, production build, and Playwright 164 passed / 0 failed (desktop + mobile Chromium).
- The two earlier TypeScript failures in #383 are resolved and verified on this exact head. The prior mobile audio idle-state Playwright failure did not reproduce in this full exact-head run; 164 E2E tests passed. Do not claim that this proves a dedicated audio fix unless separately verified.
- Overall Quality Gate remains FAIL solely because the complete dependency audit reports `picomatch@4.0.7` via `vite > tinyglobby > fdir > picomatch`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366, High severity ReDoS. The official GitHub advisory currently lists no patched version. Upstream picomatch PR #194 is an extglob parsing correctness change and explicitly says it does NOT fix the remaining repeated-extglob ReDoS shape `+(*a)`; it is not an acceptable security remediation for this advisory. Do not force an override to an unverified/nonexistent release, suppress the audit, downgrade the gate, or merge while this gate is required.
- Exact-head PR #383 is functionally green for unit/TS/build/Playwright/Firestore but remains Draft/HOLD pending a vendor-supported security fix or a reviewed architecture change that removes the vulnerable dependency without bypassing audit coverage.
- No merge, production deploy, Firebase data/rules change, Vercel settings/secrets change, or sync-flag change occurred.

### Next actions
1. Keep #383 Draft. Monitor the official picomatch advisory/release for a verifiably patched version and inspect its upstream regression tests before updating the lockfile.
2. If no patch is available, evaluate a supported Vite/toolchain version that removes picomatch from the resolved graph; prove compatibility with build, preview, test and dev server before changing dependencies.
3. Once security gate is genuinely clean, rerun the full exact-head Quality Gate and review #383's dashboard behavior with three active plans, duplicate ayah ranges across plans, overdue tasks, pause/inactive/future/completed cases, and reload persistence.
4. Continue #384–#386 only with the same exact-SHA gates and keep the offline-readiness plan as the release criterion.


## Integration / CI recheck — 2026-11-17 23:05 +02:00
- PR #383 exact head `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341` Quality Gate run #4474: functional validation job PASS (756 unit assertions; 31 Firestore Rules tests; API/audio/server smoke; TypeScript; production build; 164 Playwright tests passed). Overall gate remains FAIL only at `bun audit` for `picomatch@4.0.7`, GHSA-fc5q-39xc-vjpf / CVE-2026-112366. The official advisory has no patched version listed. Keep all dependent PRs Draft/HOLD.
- PRs #384, #385, #386 have no workflow runs associated with their current exact heads. Their current CI status is NOT VERIFIED, regardless of older Preview statuses.
- Branch ancestry is not a clean linear stack: #384 head vs #385 head compares as diverged (14 commits ahead / 4 behind; merge base `3f59506204e21f702749159333162e80ab2f324d`). #386 is ahead of #385 by 92 commits with no divergence. #384 head vs #383 head is also diverged (19 ahead / 13 behind; merge base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`). Therefore do not assume #384/#385/#386 are safely sequential or merge them by number; first reconcile branch ancestry and overlapping Mushaf/AyahNavigationControls files, then run integration tests.
- #385 and #386 both touch Mushaf reading/navigation code; #386 is based on #385. #385 has copied/shared navigation changes but is not a descendant of #384, so a later merge of #384 may conflict or overwrite behavior. Resolve this deliberately before integration.
- No PR merge, production deploy, Firebase/Vercel configuration change, secret change, or sync-flag change.

## Live GitHub reconciliation — 2026-11-17 (continued session)

This addendum supersedes older status snapshots above where they conflict. It is a repository/CI checkpoint, not a Production verification.

### Live repository and PR state
- Live `main` remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`.
- PR #382 is OPEN/DRAFT, head `4332ea4cc4b2fa75e99d3e7a5dee22e2391b6f34`, based on main. Its actual diff is **four paths**, not lockfile-only: `.github/workflows/ci.yml`, `bun.lock`, `e2e/app-shell.spec.ts`, and `e2e/memorization-audio-repeat.spec.ts`. It adds all-branch PR CI triggering and separates the security audit from application tests. Exact run #4461: frozen install PASS; complete dependency audit FAIL on picomatch.
- PR #383 is OPEN/DRAFT, base `fix/main-bun-lockfile-alignment-20261117`, head `8c7c5cd47cf186c8da23a2cf5fe3360afb7cd341`. Exact Quality Gate #4474 / run `44171290167`: application validation job PASS (756 unit assertions, 31 Firestore Rules Emulator tests, API/audio/server smoke, TypeScript, production build, Playwright 164 passed / 0 failed); separate complete dependency audit FAILs on the high-severity picomatch advisory. No merge or deploy.
- PR #384 head `022c1dd1cd5435f9c54a152e918e815dd601bbf5`, #385 head `10529d88e358b35a63c7b41060ffe966141d54e2`, #386 head `e3e26f26ac684fb97c0b1cffc636e1e5d5aa12db`: no GitHub Actions workflow runs associated with these exact heads at this recheck. They remain NOT VERIFIED.
- PR #381 tracker branch head `70721397ea30c055cb443e8d9e85a2f6262237bf`; its merge-ref Quality Gate #4477 failed before tests at `bun install --frozen-lockfile`, because the main-based documentation branch does not include the manifest/lockfile override alignment from #382. This is a stale-base lockfile failure, not evidence of runtime-code failure. Keep #381 Draft; rebase/retarget only after deliberate integration planning.
- Branch graph remains unsafe to merge by PR number: #384 vs #385 diverged 14 ahead / 4 behind (merge base `3f59506204e21f702749159333162e80ab2f324d`); #386 is 92 commits ahead of #385 and descends from it; #384 vs #383 diverged 19 ahead / 13 behind (merge base `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`). Reconcile the shared Mushaf/navigation files before integration.

### Security finding confirmed from the resolved lock graph
- The actual locked chain is `vite@8.3.5 > tinyglobby@0.2.17 > fdir@6.5.0 > picomatch@4.0.7`. Vite itself also declares `picomatch: ^4.0.7`; tinyglobby declares `picomatch: ^4.0.4`.
- GitHub Advisory `GHSA-fc5q-39xc-vjpf` / `CVE-2026-112366` still lists versions through 4.0.7 as affected and patched version as unknown. The latest audit log reports exactly one high finding on this package.
- Do not force an older picomatch version outside upstream dependency ranges, pin an unmerged PR, suppress the advisory, or downgrade the audit threshold. No safe released fix was verified in this session.
- Official references: https://github.com/advisories/GHSA-fc5q-39xc-vjpf and https://github.com/micromatch/picomatch/issues/247 .

### Next actions
1. Keep #382/#383 and #384–#386 Draft/HOLD; no Production changes.
2. Re-check the upstream picomatch advisory/releases and evaluate a supported toolchain change only if its complete lock graph removes the vulnerable package without invalid overrides.
3. Once the dependency gate is clean, rerun the full exact-head Quality Gate on #383 and its integration head.
4. Reconcile #384 navigation with #385/#386 Mushaf/Tafsir changes in a single deliberate integration branch; then run all desktop/mobile and offline E2E on the exact final SHA.
5. Continue the broader offline audit: cold restart/airplane mode, downloaded audio lifecycle, IndexedDB quota/resume/corruption, local Quran/tafsir reads, PWA cache updates, and plan archive/recovery.
6. No merge, deployment, Firebase/Vercel settings/secrets, or sync-flag change was made in this recheck.

## Offline Tafsir manifest recovery fix — 2026-11-17

- A second-pass source review of PR #386 found a recoverability defect in `getOfflineTafsirDownloadStatus()`: it trusted only `manifest.downloadedSurahs`. If the browser closed after a validated surah record was committed but before its manifest update, or if the manifest was missing/stale, the UI could report zero even though valid offline tafsir records were present. Resume logic already scanned the actual records, so the status panel and resume behavior could disagree.
- Fixed on PR #386 branch `feat/offline-tafsir-opposite-page-20261117`:
  - Service change commit: `41e4eefcf62af8b02fd2c02eac27b2fb166579d1`.
  - New unit-test file commit: `ed56c26bbb6aa1e262fb187db99dca7152c3aef5`.
  - Test-runner registration commit: `ca5b3d0a13453b9c208e0ba3fcafa02201284b8f`.
  - Current PR #386 head at this checkpoint: `ca5b3d0a13453b9c208e0ba3fcafa02201284b8f`.
- Status is now derived from individually validated IndexedDB records; a missing/stale manifest no longer hides saved surahs. A manifest's `complete` marker cannot make an incomplete record set appear complete.
- Added five pure regression cases: missing manifest recovery, stale manifest list recovery, invalid payload rejection, stale source-version rejection, incomplete records with a false complete marker, and empty-package behavior (the suite currently contains five grouped tests).
- Exact-head Quality Gate run #4481 / `44173595935` was observed queued then in progress. **No pass/fail result is claimed yet**; fetch the final run result and inspect both jobs after completion.
- This fix does not change Quran text, tafsir source/payload, Firebase, Vercel settings/secrets, sync flags, or Production. PR #386 remains Draft/HOLD until exact-head CI and integration checks pass.

## Tafsir reader CI regression correction — 2026-11-17

- Quality Gate #4481 on the earlier #386 head `ca5b3d0a13453b9c208e0ba3fcafa02201284b8f` confirmed all five new offline-tafsir recovery tests PASS.
- The application job failed one existing static source assertion in `src/tests/quranMushafReader.test.ts`: it expected `setPage(page + 1)`, while the facing-page implementation correctly uses `setPage(page + pageStep)` with a one-page/two-page step. This was a stale test expectation, not a runtime failure.
- Updated the assertion to require the page-step contract and expanded the Mushaf 604-page coverage condition to run for Tafsir PRs/branches, since the opposite-page feature changes `QuranMushafReader.tsx`.
- Commits: assertion correction `7362bd813bc55b70efe28e2f4e2ec4b32d05e39a`; CI coverage condition `d3cc59dc15160e8a367ad3189742b3d962ca9c14`.
- New exact-head Quality Gate #4484 / `44173785987` is queued on #386 head `d3cc59dc15160e8a367ad3189742b3d962ca9c14`. Its result is pending; do not claim the regression is cleared until the new run completes.
- #386 remains Draft/HOLD. No merge, Production deployment, Firebase/Vercel settings/secrets, or sync-flag changes.

## Latest PR #386 exact-head run — 2026-11-17

- Fixed the TypeScript fixture error in `src/services/tafsirOfflineLibrary.test.ts`: explicitly typed the source-version fixture parameter as `string` so the stale-version test value `0.9.0` is accepted. Commit `e6efc84febe2ca63319f857c567db110183d01ff`.
- Current PR #386 head: `e6efc84febe2ca63319f857c567db110183d01ff`.
- Quality Gate #4486 / `44173952341`: application checks observed PASS so far — frozen install, full unit suite (**759 passed / 0 failed**), 604 Mushaf page/ayah coverage, API import smoke, Quran audio CDN/range smoke, Firestore Rules Emulator, TypeScript, production build, and production server startup smoke.
- Desktop/mobile Playwright browser installation was still in progress at the last check; browser tests and overall application job are therefore **PENDING**, not yet passed.
- Separate dependency security audit completed FAIL on `picomatch@4.0.7` / `GHSA-fc5q-39xc-vjpf`. This remains the only observed audit finding and continues to block merge/release.
- No merge or Production deploy. Firebase/Vercel settings/secrets and sync flags remain unchanged.

## Latest #386 exact-head run #4486 — 2026-11-17

- Latest #386 head: `e6efc84febe2ca63319f857c567db110183d01ff`.
- Run #4486 / `44173952341`: automated suites PASS with **759 passed / 0 failed**; all 604 printed Mushaf page coordinate maps verified; API imports and approved Quran audio CDN/range smoke PASS; Firestore Rules Emulator PASS; TypeScript PASS; production build PASS; production server startup smoke PASS.
- At last inspection, browser smoke (desktop/mobile Playwright) was still in progress; do not claim the entire application job has passed until that job concludes.
- Dependency security audit has conclusively failed again on `picomatch@4.0.7`. Current official GitHub Advisory still reports no known affected/patched version boundary and links the upstream tracking issue; no safe released remediation is verified. See https://github.com/advisories/GHSA-fc5q-39xc-vjpf and upstream https://github.com/micromatch/picomatch/issues/247.
- The TypeScript issue from run #4484 was fixed by widening the stale-version test fixture parameter from the literal source-version type to `string`; run #4486 confirms TypeScript now passes.
- PR #386 remains Draft/HOLD due the audit gate and pending browser result. No merge/deploy or production configuration changes.


## Follow-up inspection — run #4486 audit evidence / main unchanged — 2026-11-17

- Re-polled Quality Gate #4486 (`44173952341`) on PR #386 exact head `e6efc84febe2ca63319f857c567db110183d01ff`.
- Application job `134360175934` remains in progress specifically at **Desktop and mobile browser smoke tests**. Its prior steps remain successful; do not report Playwright or the complete application job as passed yet. GitHub's job-log endpoint currently returns BlobNotFound while the job is running, so no browser result is inferred.
- Audit job `134360175493` is conclusively failed. Its log confirms the exact chain `vite > tinyglobby > fdir > picomatch`, resolved `picomatch@4.0.7`, and one High finding: `GHSA-fc5q-39xc-vjpf` (single-branch repeated-extglob ReDoS). Frozen install succeeds; this is not a lockfile install failure.
- Rechecked `main` against the last known baseline `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a`: compare status **identical**, 0 ahead / 0 behind. Production branch has not moved in this work.
- PRs #383–#386 remain open Draft/HOLD; no PR merge, Production deploy, Vercel/Firebase settings or secrets change, or sync-flag activation.
- Next: poll #4486 until Playwright and the application job terminate; then record the final exact-head outcome. Security gate remains a separate hard blocker regardless of browser outcome.


## Integration follow-up — 2026-11-17 (latest head e0c7d9d)

- PR #386 current exact head: `e0c7d9d63c00c86ed3010ef340bcc7ce34536b1e`. Browser selector fixes and correct two-page navigation label are committed; the remaining weak-verse navigation portion from #384 has been ported into #386 with E2E coverage.
- #4486 final Playwright result: 170 passed, 2 skipped, 8 failed. Seven mobile failures were outdated selectors using the desktop sidebar label; one desktop spread test expected a label not used by the actual next-page button. Fixes: `e92f86d1f4e9c9e5b8472b5dab689a6545cf2944`, `db1c5468ba43e5d3c16dce17f724c8a235e14849`.
- #4491 (`44178530734`) was cancelled by later branch commits. #4494 (`44179010898`) is the current exact-head Quality Gate; at last poll application validation was still running and the security audit failed again on picomatch. Re-poll before claiming browser success.
- Offline audio audit: #366 app-shell/storage improvements and #368 IndexedDB/cache/downloader foundation are still stale Draft branches based on old main. #368 lacks worker protocol, UI, local-first playback, cross-tab lock and real-device offline playback proof. See `docs/checkpoints/2026-11-17-offline-audio-integration-audit.md`.
- Vite 8.3.8 and supported Vite 7.3/6.4 branches still declare picomatch 4.x in the vulnerable range. Vite 5 is unsupported and incompatible with the current plugin-react v6 peer requirement; do not downgrade as a production workaround.
- No merge, deployment, Firebase/Vercel settings/secrets change, or sync-flag activation. `main` remains `f70bf5e0617b558dfba4663da2667fb5d6c3ce8a` at last verification.


## 2026-11-18 — Printed Mushaf full-offline package candidate

PR #390 adds an explicit optional full-604-page Hafs/KFGQPC facsimile download to the local/offline readiness track. It uses the pinned Quran.ws commit, samples pages 1/300/604 for a quota estimate, preserves a 32MB/15% storage reserve, validates and sanitizes each SVG before Cache Storage commit, resumes missing/corrupt pages, and supports pause/status/delete. The printed reader resolves cached artwork before network; all Quran text and ayah data continue to come from WIRD's verified local corpus. Settings no longer claims blanket “100% offline” readiness and clearly states that external content must be downloaded. PR #390 remains Draft/HOLD pending exact-head tests, the full dependency audit, and real-device cold-start/airplane-mode checks.

### Follow-up verification — 2026-11-18
- The first cumulative browser run confirmed the QuranEnc version-fixture race was fixed, but found the previously recorded weak-verse E2E locator failure on both viewport sizes. The selector correction from PR #387 was ported into PR #390.
- Added a dedicated Playwright test for a partial 604-page facsimile download, interrupted/retried page, verified resume without redownloading page 1, and printed-page rendering after switching the browser offline.
- Latest PR #390 exact SHA `5b953e3a47bf75ea33607abe5a62af8ca4aa6e65`; Quality Gate #4560 (`44187977275`) pending. Previous run #4558 was cancelled after the E2E follow-up. No deployment or merge.


## Dependency remediation watch — 2026-11-18
- Upstream picomatch PR #254 is a focused candidate from a fork, author reports tests/parity, but it is unmerged, has no GitHub status checks or maintainer approval visible, and changes capture semantics in some cases. PR #260 is explicitly partial with known limitations; #258 Draft and #261 unmerged. None is a release. Do not integrate any patch; retain security hold until official maintainer-reviewed release and advisory update.


## Exact-head Quality Gate #4616 — 2026-11-18
- Candidate PR #390 SHA `c36d982e4b29385b56fecbbdd0fa82c0289a3e65`; run `44237566210`.
- Application job PASS: Playwright 186 passed / 0 failed / 2 intentional viewport skips; 604 Mushaf coordinate maps; API import and approved Quran audio CDN/range smoke; Firestore Rules Emulator; TypeScript; production build; production server startup smoke. Dashboard multi-plan regression and offline Mushaf sanitized-cache/download/resume/offline-open checks passed on desktop and mobile. Offline Muyassar download/resume/corruption checks passed.
- Dependency security audit FAIL remains solely `picomatch@4.0.7` through Vite toolchain (GHSA-fc5q-39xc-vjpf, High ReDoS). No override/suppression. No merge/deploy.
- PR #390 remains Draft/HOLD. Physical Android/iOS/Safari cold restart + airplane mode and storage quota/eviction acceptance are outstanding. Exact-head app gate is green but overall release gate is not.
