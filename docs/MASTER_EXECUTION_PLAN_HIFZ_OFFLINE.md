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


---

## 6. Phase 0 — verified PR reconciliation audit (2026-11-17)

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
