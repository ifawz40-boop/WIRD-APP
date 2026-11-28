# WIRD — Engineering Work Log

## 2026-11-06 — Repository resumption and engineering checkpoint

### Repository state verified
- Repository: `xm8eslam-stack/WIRD-APP`.
- Canonical branch: `main`.
- Latest observed main commit: `d9737e0e16ea1f87b9811621dce42d8f6d4e8450` (documentation checkpoint).
- Latest code commit referenced by the audit: `f342b4bc7e02a48f88b90646098eea178901c8ea`.
- PR #1 was previously merged; do not repeat.
- Branch inventory: main, phase4 feature branch, divergent phase5 UI branch, divergent audit remediation branch.
- Divergence: phase5 branch 115 ahead / 104 behind; work audit branch 92 ahead / 228 behind. No wholesale merges recommended.

### Prior CI evidence
- Run `42180258989` documented successful for `f342b4b`: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, server smoke test.
- Vercel status lookup for `d9737e0` reported rate-limit failure. This is not a confirmed code build failure; production deployment is not confirmed.
- No code tests were executed during this documentation-only resumption.

### Engineering findings
- Local archive hardening now protects multiple corrupt archives and permits validated legacy portion recovery.
- UID-scoped outbox primitive exists but is not integrated into domain mutation paths.
- Daily activity and weak-verse state remain aggregate projections and are unsafe for concurrent cross-device increments.
- Multi-key localStorage writes are rollback-aware for ordinary failures but not crash-atomic.
- Firestore rules are a tested generic-envelope foundation, not production-ready collection-specific authorization.
- Potential outbox issue to verify: after acknowledgement, only mutation IDs remain; a reused ID with different content may be silently treated as already acknowledged.
- No Firestore client/sync coordinator or real two-device sync exists.

### External technical research (review only; no code copied)
1. Dexie.js — https://github.com/dexie/Dexie.js — Apache-2.0; current inspected package metadata 4.4.7. Its documented read/write transactions abort and roll back on errors; transaction lifetime restrictions require avoiding unrelated awaited async APIs inside a transaction.
2. idb — https://github.com/jakearchibald/idb — ISC; current inspected package metadata 8.0.4. Small promise wrapper around native IndexedDB; preserves native transaction semantics and requires more application-level schema/transaction design.
3. RxDB — https://github.com/pubkey/rxdb — package metadata declares Apache-2.0; current inspected package metadata 17.6.0. Rich local-first replication, batching, checkpoints, and conflict handlers, but broader database/replication abstraction than needed for the first WIRD milestone.
4. Design decision: do not add any dependency or copy implementation yet. Evaluate Dexie as the leading transactional IndexedDB candidate, compare against native IndexedDB/idb, and retain RxDB as an architectural reference rather than adopting its full replication stack.

### Files inspected
- `docs/DEVELOPMENT_CHECKPOINT.md`
- `docs/engineering/WORK_SESSION_CHECKPOINT.md`
- `docs/engineering/IMPLEMENTATION_ROADMAP.md`
- `docs/engineering/OPEN_SOURCE_RESEARCH.md`
- `docs/engineering/FIRESTORE_SYNC_DESIGN.md`
- `docs/engineering/SECURITY_AUDIT.md`
- `package.json`
- `src/services/storageService.ts`
- `src/services/localSyncOutbox.ts`
- `src/services/sessionPersistence.ts`
- `src/services/retentionService.ts`
- `src/services/secureId.ts`
- `src/tests/runAllTests.ts`
- `src/tests/storageReliability.test.ts`
- `firestore.rules`
- `.github/workflows/ci.yml`

### Files changed
- Added the engineering progress checkpoint documents in this directory on a dedicated documentation branch.
- No application source code, dependencies, Firebase configuration, or production settings changed.

### Review results
- First review: confirmed canonical branch, latest commit history, CI evidence, branch divergence, and known architecture boundaries.
- Independent review: confirmed no evidence that cloud sync is live; Vercel status is rate-limit-related; branch divergence prohibits wholesale merges; no new code verification claimed.
- Code test status: NOT RUN for this documentation-only change.
- Documentation review: pending final readback and integration CI.

### Next step
Finish targeted outbox audit and design M4 event ledger/transaction boundary before implementing Firestore.


## 2026-11-06 — Targeted M4 outbox audit

- Inspected `src/services/localSyncOutbox.ts` and `src/services/localSyncOutbox.test.ts` on `main`.
- Confirmed: while a mutation is pending, reusing the ID with changed collection/document/operation/payload throws as intended.
- Confirmed defect: after acknowledgement, the state stores only the mutation ID in `acknowledgedIds`; `enqueue()` returns `already_acknowledged` solely by ID, without checking whether the new mutation content matches. Reusing an acknowledged ID with different content can therefore silently suppress a distinct update.
- Coverage gap: the current acknowledged-ID test verifies only replay with identical content. It does not test changed payload, changed document ID, changed collection, or changed operation after acknowledgement.
- Additional validation review: `readState()` checks basic shape but does not explicitly reject duplicate pending mutation IDs, duplicate acknowledged IDs, or overlap between pending and acknowledged sets. Review whether these should be rejected as corrupt state before event-ledger integration.
- Session completion currently updates a mutable per-day aggregate via `StorageService.recordSessionCompletion`; revision rating updates portion state, optional weak-verse aggregate, then activity aggregate with rollback. These are the concrete mutation boundaries M4 must wrap with a recoverable event journal.
- No source code changed and no tests were run for this static audit. The defect is logically established from the current implementation and test coverage; a regression test must reproduce it before the fix is accepted.
- PR #3 remains documentation-only and open; no CI success has been verified for its head SHA.

### Next exact action
Add an async-safe/transaction-safe idempotency design that preserves enough acknowledged mutation identity to reject changed-content reuse, handles old v1 acknowledgements without data loss, validates pending/acknowledged uniqueness, and has regression tests for each case. Then continue the event-journal transaction design.


## 2026-11-06 — Phase 1 record-level validation audit correction

- Inspected `storageService.ts` and backup validation flow.
- `readJsonArrayArchive<T>()` validates JSON parse and array root only; it does not validate every element against the domain schema.
- `savePlans()`, `saveEnginePlans()`, and `saveRevisionItems()` check only array shape and archive-root writability, not each record's fields/ranges.
- `saveTest()` checks archive root but does not validate the incoming test result object before inserting it.
- `validateBackupPayload()` checks that several collection fields are arrays; the inspected validator performs deep per-record validation for canonical unified portions and profile, but the same complete record-level validation is not present for all plan/revision/test/log/weak-verse records. This leaves malformed nested backup records able to pass the initial array checks and be written.
- Correction to milestone status: Phase 1 is **IN PROGRESS**, not complete. Phase 2 remains **IN PROGRESS** pending full mutation-path validation. The roadmap and resume instructions were updated accordingly.
- Required next work: define shared strict validators for every persisted record type; apply them to read/write/import/export boundaries; preserve invalid original archives; add malformed-record, boundary, legacy-compatibility, and backup no-partial-write tests.
- No application code changed and no code tests were run during this static audit.


## 2026-11-06 — Domain mutation call-site map

Inspected App.tsx, MemorizationSessionView.tsx, RevisionCenterView.tsx, MemorizationTestsView.tsx, SettingsView.tsx, weakVerseRecording.ts, retentionService.ts, and storageService.ts.

- Session completion: UI delegates to App.handleCompleteSession -> persistSessionCompletion; after the canonical portion + daily activity operation, an engine-plan task update is saved separately. No outbox enqueue exists.
- Direct review activity: App.handleRecordRevisionComplete calls StorageService.recordSessionCompletion directly; this is a second aggregate activity path.
- Revision rating: RevisionCenterView calls RetentionService.recordRevisionPerformance; it updates portion history, optionally weak-verse aggregate, then daily activity aggregate with rollback on ordinary write failure. No immutable event or outbox record is written.
- Weak verse failure: RevisionCenterView/App call recordWeakVerseFailure; it writes a one-ayah weak portion and then increments the weak-verse archive, restoring the previous portion list if the weak archive write fails. No outbox record is written.
- Manual portion changes and weak-verse resolution: RetentionService.addPortion / resolveWeakVerse write canonical portions or weak-verse aggregate directly; no outbox.
- Tests: MemorizationTestsView delegates to App.handleSaveTestResult -> StorageService.saveTest. The save boundary does not validate the full TestResult record at runtime.
- Plans: App handlers call savePlans/saveEnginePlans. These validate only the top-level array/archive shape, not each nested plan/task.
- Profile/settings: theme/profile writes use saveProfile; the profile validator exists. Backup import writes multiple archives after a validator that does not yet validate every record in every array.
- Demo seed/reset are multi-key operations and need explicit scope/guard review; they must not be treated as ordinary event-producing user progress.

### Validation library research

Reviewed Zod 4.6.7 (MIT), Valibot (MIT; official docs specify TypeScript 5.0.2+), and Ajv 8.20.0 (MIT). No package was added. Prototype Zod and Valibot on the same record schemas before selecting a dependency; use strict unknown-key rejection and preserve legacy formats deliberately.

### Next exact action
Complete Phase 1 record-level validators and backup import/export consistency first. Then continue Phase 2 mutation/range validation and outbox idempotency before event-ledger integration.


## 2026-11-06 — Engineering checkpoint integrated into main

- PR #3 (documentation-only) was squash-merged successfully into main.
- Merge commit: `82efeacd9118406d850336fa3c862fd5016bed14`.
- PR head CI run `42184381262` completed successfully: automated tests, dependency audit, Firestore Emulator tests, TypeScript validation, production build, and production server smoke test all passed.
- The combined status for the merge commit still reports Vercel `failure` with a build-rate-limit target. This is a deployment quota issue; it does not negate the passing GitHub Actions quality gate. Production deployment for this merge commit remains unconfirmed.
- The six progress files now exist on main under `docs/engineering/progress/`.
- No application source, dependencies, Firestore rules, secrets, production data, or deployment configuration changed.
- Next priority remains Phase 1 record-level validation; do not start cloud sync. Static audit found array-root-only validation in plans, engine plans, revision items, and test results, and incomplete deep backup validation. M4 outbox integration follows after Phase 1/2 gates.


## 2026-11-06 — Phase 1 record-validation milestone (PR #4)

- PR #4 merged into main as squash commit `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- Changed application files: `src/services/storageService.ts`, `src/services/retentionService.ts`; regression coverage updated in `src/tests/backupValidation.test.ts` and `src/tests/firebaseAuth.test.ts`.
- Added runtime per-record validation for memorization plans, engine-generated plans and nested schedule tasks, revision items, test results, weak-verse records, daily logs, legacy/canonical portion records, and profile data at backup boundaries.
- Safe array reads now reject malformed elements without changing the original archive; write paths refuse to overwrite malformed archives.
- Backup import validates nested records before writes and rejects inconsistent v4 legacy/canonical projections. Export refuses malformed archives, incomplete legacy migrations, divergent projections, duplicate daily log dates, and incomplete canonical archives rather than producing a partial backup.
- Legacy v1–v3 portions/revision records retain only the documented fields normalized by the existing migration; raw legacy arrays are validated before migration/recovery. Invalid source archives remain untouched.
- Shared the strict weak-verse validator between storage and retention services.
- External library review: Zod 4 (MIT), Valibot (MIT), Ajv 8 (MIT). No dependency added; custom domain validators were selected for this milestone to avoid new runtime dependency and preserve explicit legacy behavior.
- CI run `42186678874` on PR head `2e04d7a` passed: automated tests, dependency audit, Firestore Security Rules Emulator, TypeScript validation, production build (including Quran chunk validation), and production server smoke test.
- The combined status on merge commit `647eff6` reports Vercel failure at the free build/deployment rate limit. This is not a GitHub Actions code-test failure; production deployment remains unconfirmed.
- This is a verified record-validation substage, not completion of all Phase 1. Remaining audit includes `sessionPersistence.ts`, `sessionCompletion.ts`, the local outbox boundary, and every remaining domain mutation call site.
- Next confirmed findings: `getSessionCompletionMetrics()` still clamps negative/fractional counters to zero; reject invalid input before any write. The outbox still accepts an acknowledged mutation ID with changed content as `already_acknowledged`; fix after the remaining local data audit.


## 2026-11-06 — Session and Quran-range validation milestone (PR #5)

- PR #5 merged into main as `fd480526dd3eac728f60b3554e83309354903ad8`.
- Replaced silent `Math.floor` / `Math.max(0, ...)` coercion in `getSessionCompletionMetrics()` with strict safe-integer validation and explicit Quran-domain bounds: memorized ayahs 0–6236 and reviewed pages 0–604.
- `persistSessionCompletion()` now validates mode, counters, duration (0–1440 minutes), task name, and the full surah/ayah range before any portion mutation. Invalid input returns a failure result without changing portions or activity logs.
- `RetentionService.addPortion()` and `recordMemorizationCompletion()` now enforce canonical surah/ayah bounds at the service boundary.
- `recordRevisionPerformance()` now validates rating, duration, notes length, and weak-ayah details/range before changing portion status, review history, or weak-verse records.
- Added regression tests for negative/fractional/unsafe/out-of-range counters, invalid session duration/task names/mode/ranges, invalid revision ratings, weak ayahs outside the reviewed portion, and no-mutation guarantees.
- CI run `42187380137` passed all steps: automated suites, dependency audit, Firestore Security Rules Emulator, TypeScript, production build, and server startup smoke test.
- Vercel check on application-code merge commit `fd48052` later completed successfully. The subsequent documentation-only checkpoint commit `e1f244c` hit the known free build-rate limit; the code merge's deployment check itself is successful.
- Phase 2 is partially advanced, not complete. Phase 1 remains open because `localSyncOutbox.ts` and the remaining storage/session boundaries still require audit.
- Next priority: audit outbox state integrity and fix the confirmed acknowledged-ID/content mismatch, pending/acknowledged uniqueness and disjointness, and retry overflow. Then continue the remaining revision/mutation-path audit.


## 2026-11-06 — Local outbox integrity milestone (PR #6)

- PR #6 merged into main as `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`.
- Changed files: `src/services/localSyncOutbox.ts` and `src/services/localSyncOutbox.test.ts`.
- Added compact deterministic content fingerprints for acknowledged mutation IDs. Same logical content (including object-key order changes) remains idempotent; changed payload, collection, or document reuse is rejected.
- Existing v1 acknowledged IDs without fingerprints remain reserved but are not assumed to match a new payload; this avoids silently accepting a changed operation after upgrade.
- State validation now enforces unique pending IDs, unique acknowledged IDs, disjoint pending/acknowledged sets, pending-device identity consistency, and valid fingerprint references.
- Retry attempt overflow, retry timestamp overflow, invalid batch sizes, empty IDs, and invalid UTF-8 ID bounds are rejected before mutation.
- Outbox writes now restore the previous raw value if read-back verification fails.
- CI run `42187959928` passed: **277 automated tests**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and server startup smoke test.
- Vercel status on merge commit `aacc7ae` reports the known free build-rate-limit failure; this is separate from the passing GitHub Actions quality gate. Production deployment for this merge is not confirmed.
- Research reviewed Dexie transaction semantics and RxDB replication/conflict patterns. No new dependency or external code was copied; the existing storage adapter remains in place. The outbox is still localStorage-backed and is not cross-tab transactional; do not activate remote sync until the planned transactional IndexedDB event/outbox design is implemented and tested.
- Phase 1 remains open for the final `unifiedPortionService.ts` merge/deduplication audit and complete persistence-boundary review. Phase 3 remains unstarted; no cloud sync writes are enabled.


## 2026-11-06 — Duplicate session/outbox branch reconciled (PR #7)

- A continuation branch, `fix/phase2-session-counter-validation`, was created from an earlier main revision while PR #5 (session/range validation) and PR #6 (outbox integrity) were being integrated into the canonical branch.
- The branch diverged from current main (17 commits ahead / 14 behind at comparison time). Its changes overlapped the already merged session and outbox fixes.
- Reviewed current main implementation and verified it contains the stronger final versions: PR #5 validates session counters, duration, task names, Quran coordinates, revision ratings, weak-ayah range, and pre-write failure paths; PR #6 uses deterministic acknowledged fingerprints, preserves legacy acknowledged IDs safely, validates pending/acknowledged uniqueness and device identity, rejects retry/batch overflow, and restores prior raw outbox state on read-back failure.
- PR #7 was closed without merge as superseded. No code from the stale branch was merged or written to main.
- Its branch-specific CI run on earlier commit `3d6e7ed` passed the full quality gate; the later extra tests were not required for main because the canonical PR #6 implementation already covers these invariants with its own verified test suite (CI run `42187959928`: 277 automated tests, 10 Firestore emulator tests, audit, TypeScript, build, smoke test).
- Updated CURRENT_STATUS, MASTER_ROADMAP, and RESUME_HERE to remove stale outbox defect statements and return the next task to the remaining `unifiedPortionService.ts` merge/dedup/conflict audit.
- No production sync activation, Firestore rule deployment, destructive migration, or data change occurred.

### Next exact action
Audit `src/services/unifiedPortionService.ts` and its tests on current `main`: range validation, canonical IDs, overlapping portion handling, merge metadata, duplicate history IDs, conflict-audit growth, aggregate counters, and rollback behavior. Compare at least three relevant external designs before implementation; preserve all legacy data and test malformed/overlapping inputs.


## 2026-11-06 — Phase 1 completed: portion merge and review-history integrity (PR #9)

- PR #9 merged to `main` as `f8e0cef696b6b74f2f9872cf69a9d3ad6bcc731c`.
- Changed files: `src/services/unifiedPortionService.ts`, `src/tests/phase3CoreRemediation.test.ts`.
- Fixed a confirmed history-loss bug: two distinct review attempts with different stable IDs are preserved even when date, rating, before/after intervals, and notes are identical. Deduplication now uses stable event IDs only.
- Same-ID/same-content retries deduplicate; same-ID/different-content conflicts receive deterministic alternate IDs with collision handling.
- Existing conflict-audit entries from duplicate legacy portion records are merged rather than discarded. New audit entries are deduplicated and capped; history and audit overflow fails closed without mutating source arrays.
- Portion status and memorization strength now merge conservatively; a weaker status cannot retain a contradictory stronger label.
- Added strict source-record validation for legacy portions/revisions, Quran integer ranges, nested review history, dates, scheduling metrics, timestamps, conflict audit, and bounded archive sizes.
- Hardened range/statistics helpers against invalid coordinates including Infinity (which could otherwise create unbounded loops); validated local calendar dates, SM-2 grade inputs, plan scopes, revision queue limits, and daily memorization targets.
- Preserved established behavior confirmed by tests: valid Surah targets are deduplicated, invalid target values are filtered without widening the explicit scope, and an in-progress passage is clipped only to its Surah's real verse boundary.
- Regression tests cover identical-content distinct review attempts, stable IDs, same-ID deduplication, audit preservation, strength consistency, fractional Quran coordinates, malformed dates, malformed migration roots, invalid SM-2 grade, invalid queue limits, and infinite range rejection.
- External research reviewed Automerge (MIT), RxDB (Apache-2.0), and Yjs (MIT) conflict/CRDT designs. No third-party code or dependency was copied. Decision: retain explicit Quran-aware merge semantics rather than generic LWW/CRDT behavior.
- CI run `42190653101` passed: automated tests, 10 Firestore Security Rules Emulator tests, TypeScript, production build, and server startup smoke test.
- PR #7 was closed without merge because its session/outbox changes were already present more completely on main through PR #5 and PR #6; its stale branch was not merged.
- Vercel deployment for PR #9 failed only due the free daily deployment limit (`api-deployments-free-per-day`). Production deployment of merge commit `f8e0cef` is not confirmed.
- No production data migration, Firestore rules deployment, or cloud sync activation occurred.

### Phase 1 decision

Phase 1 local archive/backup/portion merge integrity is now **COMPLETED** on main. Phase 2 remains in progress for review scheduling, duplicate operation behavior, and dashboard statistics. The localStorage outbox remains disconnected from cloud writes because cross-tab atomicity requires a transactional IndexedDB event+outbox journal.

### Next exact action

Audit the remaining Phase 2 mutation paths in `RetentionService`: `updatePortionStatus`, `recordMemorizationCompletion`, `recordRevisionPerformance`, weak-verse recording/resolution, daily revision queue selection, and dashboard statistics. Test duplicate operations, review-history append semantics, aggregate correctness, and rollback across multi-key writes.


## 2026-11-06 — Phase 2 continuation checkpoint (branch not yet merged)

- Resumed from `fix/phase2-retention-mutation-audit`; comparison against canonical `main` showed the branch was 16 commits ahead and 0 behind at the start of this continuation. Later commits in this session advanced the branch; re-run compare to obtain the current count and SHA.
- Audited the active Phase 2 changes in `RetentionService`, the revision center UI, and their regression tests.
- Hardened manual portion status updates: reject unknown IDs/invalid status values and keep status/strength labels consistent.
- Re-adding an existing canonical Quran range now merges with the existing record rather than resetting review history, repetition counters, or weaker progress. Surah labels are sourced from canonical metadata.
- Weak-verse arrays now reject duplicate IDs and duplicate Surah/Ayah coordinates; direct writes validate coordinates and inputs; resolving a missing/already-resolved ID is idempotent.
- Backup validation rejects duplicate weak-verse IDs/coordinates.
- Revision modal blocks rapid duplicate submissions while a save is in flight and clears stale notes/weak-ayah input when switching or closing.
- Added tests for duplicate portion adds, unknown status IDs, weak-verse duplicate archives, direct invalid coordinates, idempotent resolution, and backup duplicate rejection.
- Review correction: memorization completion must not append a `RevisionLogEntry`, because that ledger and `totalReviewsCompleted` represent reviews. Removed that misclassification and changed the regression test to assert that memorization leaves review history and review totals unchanged while retaining memorization counters/status.
- Corrected two test fixtures whose ayah ranges exceeded Surah Al-Mulk's 30 verses (now use valid ranges).
- External research reviewed Microsoft Event Sourcing guidance (idempotent handlers under at-least-once delivery), a TypeScript event-sourcing reference implementation (idempotency keys), and Ummah Library's Quran-reader architecture. Ummah Library is AGPL-3.0; no code or dependency copied. Research is architecture-only.
- No local test command or CI run has yet been confirmed for this branch. The only observed combined status on the current main/known earlier branch commit is Vercel's free build-rate-limit failure; GitHub Actions status for the current branch head is still pending a PR run.
- No Phase 2 code has been merged to `main`; no production migration, Firestore rules deployment, or cloud sync activation occurred.

### Next exact action

Create a draft PR to `main`, inspect the full diff, wait for GitHub Actions, fix any failures, then conduct a separate review before merging. Continue the daily queue/statistics/rollback audit; do not mark Phase 2 complete prematurely.


## 2026-11-06 — Phase 2 mutation-integrity slice merged (PR #10)

- PR #10, `Phase 2 — Retention mutation integrity and duplicate-operation safeguards`, was squash-merged to canonical `main`.
- Merge commit: `e69871897c2561e7aa75c6e31f9005169ed08c23`. PR head before merge: `958067b1b1e3c64513b1732c947e81c18a830a52`.
- GitHub Actions Quality Gate #681, run `42194241711`, passed: **304 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and server startup smoke test.
- Independent second-pass review found and fixed: a duplicate JSX disabled prop; noncanonical placeholder text fallbacks for weak-verse records; an invalid duplicate-range test fixture; and a TypeScript widened inference in the status mapper.
- The first CI run exposed an existing retention test that added the exact same seeded demo range and expected its previous mistakes counter to be overwritten. The fixture was changed to a non-seeded canonical range; the intended data-preserving duplicate behavior remains enforced by the new dedicated regression test.
- A further semantic correction removed both first-time and repeat memorization completions from the revision-history ledger. Memorization counters and daily activity still update; review history and totalReviewsCompleted now count review events rather than memorization sessions.
- Vercel reports the known Free-plan daily deployment limit (`api-deployments-free-per-day`). This is separate from the passing GitHub Actions quality gate; production deployment of the merge commit is **not confirmed**.
- No destructive migration, production Firestore rules deployment, live cloud sync activation, or production data mutation occurred.
- Phase 2 remains IN PROGRESS: continue daily queue, weekly overview, dashboard aggregate, and multi-key rollback audits. The localStorage outbox remains disconnected from cloud writes pending a transactional IndexedDB event+outbox journal.


## 2026-11-06 — Phase 2 queue and dashboard audit (in progress)

- Started branch `fix/phase2-queue-metrics-audit` from the verified main documentation checkpoint `0de185af757cfecead14beb98a465cf088200fff`.
- External research: `ts-fsrs` is an actively maintained MIT TypeScript scheduler; current v6 requires Node >=24 and introduces breaking API changes / FSRS-7. WIRD already targets Node >=24.12, but no algorithm migration or dependency addition was made because replacing SM-2 would require a deliberate history/schedule migration. `fsrs.js` itself recommends transition to `ts-fsrs` because it is less actively maintained. Anki's manual recommends not rescheduling existing due dates by default when switching algorithms because it can create a large immediate review backlog. FSRS Helper's load-balancing, flattening, and postponement features were reviewed as queue UX references only. No external code copied.
- Refactored the queue comparator into shared deterministic ordering for daily and weekly revision surfaces (status severity, oldest due date, ease factor, canonical ID tie-break).
- Removed an unused `gracePeriodDays` property from queue options; it had been validated but never affected queue selection. The SM-2 grace period used by the scheduling calculation remains unchanged.
- Legacy initial-memorization history entries are identified by their historical `init-` ID prefix and excluded from the review-history view/count while remaining untouched in stored portion history.
- Review history now counts each stable event ID once across portion records, preventing duplicated projections from inflating totals.
- Average ease factor now excludes `not_memorized` portions, which are not yet in the reviewable population.
- Failed review writes now require actual weak-ayah text at the service boundary; placeholder text such as “Ayah N” can no longer be persisted.
- Added regression tests for legacy history preservation, duplicate review IDs, average-ease denominator, weekly priority ordering, daily queue cap/backlog counts, impossible calendar dates, and missing weak-ayah text.
- Current branch head before docs checkpoint: `c2d5ab906bc66443f63bdc049595d0504e303937`. Tests/CI are pending; no PR opened yet and no changes merged to main.


## 2026-11-06 — Phase 2 queue and dashboard metrics slice merged (PR #11)

- PR #11, `Phase 2 — Revision queue ordering and dashboard metric integrity`, was squash-merged to canonical `main`.
- Merge commit: `84aac72c9d3489f93d200e331c35760eb754462e`. PR head before merge: `1c7e57e6beeed1327900acc38c5642298ba37aad`.
- GitHub Actions WIRD Quality Gate #708 / run `42195579600` passed: **312 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and server startup smoke test.
- Independent review confirmed the full-collection queue validation remains in place before due filtering; a dedicated regression test verifies invalid future-due and not-memorized ease values are rejected.
- Shared deterministic priority ordering now drives daily and weekly revision surfaces. The unused queue-only gracePeriodDays option was removed; SM-2's scheduling grace period remains unchanged.
- Legacy initial-memorization records with historical `init-` IDs are excluded from review presentation/counts without modifying the original portion history. Duplicate event IDs are counted once. Average ease excludes portions that are not yet memorized.
- Failed-review weak-ayah details now require a non-empty text value before any write; placeholder verse text is not persisted.
- No algorithm migration, schedule rescheduling, production migration, Firestore rules deployment, or cloud sync activation occurred.
- Vercel's status still reports the Free-plan daily deployment limit; production deployment is not confirmed. GitHub Actions code quality gates passed.
- Phase 2 remains IN PROGRESS. Next work is failure-injection for multi-key review/weak-verse/activity rollback and recovery-state correctness.


## 2026-11-06 — Phase 2 multi-key rollback failure injection merged (PR #12)

- PR #12 `test(storage): inject multi-key rollback failures` was squash-merged to `main`.
- Merge SHA: `1ffd6c23363d636a6b395620e7f9c7cd15828827`; tested PR head: `522bbc549074217af8e3d434538078cc5a8204bc`.
- GitHub Actions WIRD Quality Gate #741 / run `42216315142` passed: **315 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and production server startup smoke test.
- New tests prove: (1) a weak-verse archive quota failure restores the changed review portion and prevents activity recording; (2) a subsequent rollback write failure produces an explicit recovery-required/backup warning; (3) profile quota failure after successful portion, weak-verse, and activity writes restores all four archives to their original raw values.
- Independent review strengthened the third test to assert that weak-verse and activity writes actually succeeded before injecting the later profile failure.
- PR #12 was test-only; no application runtime code, schema, user data, algorithm, or migration changed.
- External references reviewed: MDN IndexedDB transaction guide, W3C IndexedDB 3.0 atomic commit/abort semantics, Dexie transaction documentation, and OWASP browser-storage testing guidance. No source code or dependencies copied.
- Vercel passed for the PR head before merge; post-merge deployment status on the merge SHA was pending at the last check. Do not claim production deployment.
- Phase 2 remains IN PROGRESS. Next: inject silent-write/read-back mismatch and audit each multi-key mutation path for complete rollback/recovery behavior.


## 2026-11-06 — Phase 2 durable write/readback verification merged (PR #13)

- PR #13 `fix(storage): verify durable writes and readback` was squash-merged to `main`.
- Merge SHA: `346b725ae76a177372375f5045e7816eb09a0d1c`; tested PR head: `d6753835d70a71b7f3a5f15a7f3512d9f92bf843`.
- GitHub Actions WIRD Quality Gate #759 / run `42217300654` passed: **317 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and production server startup smoke test.
- The storage adapter now snapshots the previous durable value, verifies exact `getItem()` readback after `setItem()`, attempts and verifies restoration after a mismatch or thrown write, and updates the memory fallback only after durable verification.
- Durable removal now checks readback; the public `removeRawItem()` returns a boolean so callers can observe removal failure.
- Tests cover silent no-op writes, corrupted/mismatched writes, silent no-op removal, and weak-verse failure rollback when the counter write silently does not persist.
- Independent review checked UID-scoped key handling, rollback of previous raw bytes, memory fallback behavior, and existing quota-error semantics. Initial CI failure was isolated to the test fixture's key comparison; fixture now matches UID-scoped keys, and the complete quality gate passed.
- External research reviewed MDN Web Storage API / `Storage.setItem()`, WHATWG HTML Web Storage semantics, and OWASP browser-storage testing guidance. No source code or dependencies copied.
- Vercel failed with `build-rate-limit` on the PR head; production deployment is not confirmed.
- No data migration, destructive operation, Quran text change, SM-2 schedule change, Firestore rules deployment, or cloud sync activation occurred.
- Phase 2 remains IN PROGRESS. Next: audit the remaining multi-key mutation paths for missing durable verification, rollback gaps, and recovery-state reporting.


## 2026-11-06 — Quran reader and Tafsir repair (PR #49)

- Created isolated branch `fix/quran-reader-tafsir-navigation-20261106` from main SHA `4fa6a1acffb0723c89bb963b237e67e6f4b7173f`; main was not modified.
- Mounted the existing `api/tafsir.ts` handler in Express before Vite middleware, fixing the missing development-server route that allowed Vite to return JavaScript module source to a JSON client.
- Added development and production smoke coverage for the Tafsir route's JSON response.
- Added direct Surah-to-Mushaf entry actions, initial-page support, and a generated-index resolver for exact first-ayah page navigation.
- Added a 114-Surah page-start regression test.
- Exact code-head SHA `8f213b3a912657b0d1e36f7c851085b742629e2c`: PR Quality Gate run `42267248254` and push Quality Gate run `42267243769` both passed. Automated tests, Firestore emulator, TypeScript, build, and both server-mode smoke checks passed.
- Vercel failed due to its Free-plan daily deployment cap (`api-deployments-free-per-day`); production deployment is unconfirmed. PR #49 remains draft/open and unmerged.
- Next: re-check final branch head and checks after this checkpoint update; wait for deployment quota recovery and verify the actual deployed route before merging.


## 2026-11-06 — PRs #49–#52: reader repair and local mutation recovery

- PR #49 merged as `15979e4a009ef0aa5b4981cbcbb4f2124f25dfc3`: fixed Tafsir API routing in the custom Express server and direct Surah-to-Mushaf navigation. Exact-head Quality Gate run `42267849373` passed. Vercel rate limiting was explicitly accepted as a non-blocker for merging; production deployment remains unverified.
- PR #50 merged as `dacba8298db954392f7fbcbbf10af9f18ecc31dc`: active session completion now uses journal-first grouped persistence for canonical portion progress, activity, and profile streak. Exact-head Quality Gate run `42276148126` passed.
- PR #51 merged as `99c466b9de6ae977979f8989443fba5b94017a30`: the matching smart-plan task status is included in the same session transaction. Exact-head Quality Gate run `42276561011` passed; post-merge main run `42276748346` passed.
- PR #52 merged as `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`: backup import and factory reset now use ordered journal transactions; older pending events are replayed before import/reset, and async tests cover recovery ordering and invalid imports. Exact-head Quality Gate run `42277464313` passed. Post-merge main run `42277666291` completed successfully on exact SHA `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`.
- Vercel status continues to fail with `build-rate-limit`; owner explicitly instructed that this must not block adding tested changes to `main`. This is not evidence of a live deployment.
- The Revision Center active rating path was audited and already uses grouped journal persistence. Two unused App-level direct-write handlers were found and removed in the current checkpoint branch.
- Cloud sync remains unimplemented: no Firestore client, sync worker, remote acknowledgements, tombstones, or two-device/offline sync tests.


## 2026-11-06 — PR #53 and typed domain-event envelope

- PR #53 merged as `87c4ec4456c69e35e1d62a368c97a5992d0309ac`: removed unused App-level direct local-write handlers and refreshed current status, roadmap, release checklist, and continuation files. Exact-head Quality Gate `42278253060` and post-merge main run `42278457062` passed.
- Main then advanced to `dee0e7a926700092e3d4b3e5fd63e74565428de0` with a direct Tafsir multi-source/book-ID commit. No Actions run was found for that exact commit at the time of this checkpoint; PR #54 is based on this latest main SHA and its Quality Gate will test the combined tree.
- PR #54 branch `feat/domain-event-envelope-phase3-20261106-fresh` introduces a typed domain-event envelope for session completion, revision ratings, test completion, and weak-verse failure/resolution. Event identity is tied to mutation identity; semantic payloads are validated before enqueue; retry timestamps are stable.
- This envelope remains local IndexedDB journal metadata only. No Firestore client, remote event collection, sync worker, or cloud sync activation is included.
- Exact-head CI and second review for PR #54 are pending.


## 2026-11-06 — PR #54 merged; local mutation audit PR #55

- PR #54 merged to `main` as `6cc1d20e63257387044334da45e38bc204961c09`. It adds versioned typed domain-event envelopes for session completion, revision ratings, test completion, and weak-verse failure/resolution; validates identity and semantic payload before journal enqueue; and preserves retry identity/timestamps.
- Exact-head Quality Gate run `42280361752` and post-merge main run `42280564932` both passed. The run included 386 automated assertions, 10 Firestore emulator rule tests, TypeScript, production build, and production server smoke test.
- Main advanced to `033b8abda6bbf4f5c58d9b20d835f3268230abb6` with Quran Library tabs/Juz navigation; the next branch was recreated from this exact SHA to preserve the owner's direct change.
- PR #55 branch `fix/local-mutation-audit-demo-journal-fresh-20261106`: removes the development demo loader's direct multi-archive writes and routes profile/plans/engine-plan/canonical portions/weak verses/activity through one journaled grouped transaction for authenticated users and one rollback-safe local transaction for guests.
- PR #55 adds tests for authenticated journal persistence, guest local-only behavior, and a simulated `QuotaExceededError` during a multi-archive projection. Existing coverage also verifies IndexedDB enqueue failure does not fall back to local-only writes, durable read failures block enqueue, and failed child projections roll back without advancing the cursor.
- The first PR #55 CI run exposed old tests that called the removed demo methods; the test fixtures were migrated to test-only seeding. Latest exact head: `25a04513b26aff04f0cfffa93c0d36d5b170d1b9`; Quality Gate run `42281736462` pending.
- Quran text and canonical Mushaf data were not modified by PR #54 or PR #55.

- Follow-up coverage added: simulate an application interruption after the journal/outbox commit but before local projection, reopen the same IndexedDB database with a fresh journal instance, and verify startup replay applies the event once without acknowledging remote delivery.


## 2026-11-06 — PR #55 merged and post-merge verified

- PR #55 merged to `main` as `c4de1ea12549a9c8a51f818e3b855d1da1d45f96`.
- Exact-head Quality Gate runs `42281993489` and `42281999065` passed; post-merge main run `42282206155` passed.
- The development-only demo loader now writes profile, plans, engine plan, canonical portions, weak verses, and activity as one grouped journal transaction for authenticated users; guest mode uses one rollback-safe local transaction. The old direct-write methods were removed.
- Added QuotaExceededError injection coverage proving all earlier projections roll back and the journal cursor does not advance. Added simulated restart coverage proving a pending journal event is replayed after reopening IndexedDB exactly once without acknowledging remote delivery.
- Updated test-only demo fixture seeding; no production direct demo writer remains. The PR did not modify Quran text or canonical Mushaf metadata.
- Remaining local audit targets: legacy outbox migration/reset, device-local reading/audio preferences, and any remaining unreviewed multi-key mutation callers.


## 2026-11-06 — PR #57 merged; PR #58 account-scope guard

- PR #57 merged as `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`. Exact-head runs `42283803166` and `42283813448` passed; post-merge main run `42284039747` passed.
- Profile reads now calculate a display streak without writing the profile archive. Canonical portion reads now prepare a recovery view without writing either canonical or legacy bytes.
- AuthGate now replays older committed events first, then commits legacy portions/revision migration through one journaled transaction before mounting the app. Guest migration remains local-only and rollback-safe.
- Validated recovery from corrupt schema-v2 data is represented by an explicit journal projection flag; corrupt canonical bytes are not replaced until the validated legacy snapshot is journal-committed.
- PR #58 adds account-scope guards to journaled persistence and AuthGate migration to prevent a stale startup task from projecting one account's migration into another account after an auth/scope change.


## 2026-11-07 — Remote projection recovery and initial multi-device verification

- PR #73 merged: `cc887a6bfa07aec880f495221e64dd36edb14ca8`; durable projection intent and recovery finalization.
- Post-merge main CI run `42350476806` passed.
- PR #77 merged: `716cf301bff9a8c7777ee3931dba6366a01afe3b`; independent Firestore Emulator clients + separate IndexedDB/localStorage prove bidirectional profile projection. Exact-head CI: 450/450 automated assertions, 26/26 rules, TypeScript, production build, startup smoke, dependency audit passed.
- PR #78 merged: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; two offline devices mutate same profile from base revision 0; accepted write wins, stale write returns `REMOTE_REVISION_CONFLICT`, losing local mutation and remote inbox are preserved, projection returns `blocked_pending_local` and cursor stays at 0. Exact-head CI: 450/450 automated assertions, 27/27 rules, TypeScript, production build, startup smoke, dependency audit passed.
- An initial PR #78 test attempt failed because the test called a nonexistent `listPending` API; corrected to use `listReady` and re-ran the full exact-head CI successfully. The earlier failed SHA was not merged.
- Current main at checkpoint: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; post-merge main workflow was queued; recheck it before considering main verification complete.
- Known blockers: tombstones remain intentionally blocked; no durable conflict record/user resolution UX; profile-only two-device coverage; no Playwright browser contexts/long-offline stress; production rules deployment and Vercel deployment not verified (`build-rate-limit`).
- No production data, secrets, Firebase rules deployment, environment variables, or Vercel settings changed.


## 2026-11-07 — Durable conflict archive

- Ported the useful conflict archive changes from stale PR #76 onto latest main in PR #81 rather than merging a diverged branch.
- Added IndexedDB schema v8 `projectionConflicts` store, UID-scoped indexes, a 100-record cap, resolved-only pruning, original-snapshot preservation, and remote-event retention.
- Added projector archival for blocked decisions/finalization failures, coordinator summaries, Settings diagnostics, and regression tests.
- Initial exact-head CI failed because the Firestore integration helper lacked the new snapshot/archive dependencies. Updated the helper and asserted the offline conflict is archived. Final exact-head SHA `415cbe33389a6108d08f9d5785818e8e12458fee` passed: 459 automated assertions, 27/27 rules, TypeScript, build, dependency audit, startup smoke.
- PR #81 merged as `059e902194811be71ab4dea9da8609a96967214e`; post-merge main run `42351965332` passed.
- Closed stale PR #76 and superseded PR #59; neither was merged. PR #59's old `domain-mutation.v2` serverTimestamp envelope did not match the current revisioned schema and was intentionally not ported.
- Vercel still reports `build-rate-limit`; no live deployment verification.


## 2026-11-07 — Atomic conflict reconciliation (PR #85)

- Reviewed PR #82's improved conflict archive implementation and ported it onto the current main via PR #85 rather than merging a stale-base branch.
- Added inbox/event fingerprint and identity checks to conflict archive writes, orphan prevention, 500 KB snapshot cap, and atomic conflict resolution within `finalizeRemoteProjection` / `markRemoteProjected` cursor transactions.
- Added recovery coverage for first-snapshot preservation, already-applied event reconciliation, late archive attempts, and oversized snapshot rejection. Exact PR head `b6af08b2d9461a1d3d7cc019404692d779500248`: 462 assertions passed, Rules 27/27, TypeScript/build/dependency audit/startup smoke passed.
- PR #85 merged as `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`; post-merge main run `42352594819` passed.
- Closed PR #82 and duplicate port PR #86 as superseded. PR #85 is authoritative.
- Vercel still reports `build-rate-limit`; no live production deployment.

## 2026-11-07 — Continued repository verification and safe merges

### Repository state
- Re-fetched current main after the PR #85 checkpoint. Current main at the end of this session segment: e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- Main Quality Gate after PR #62: run 42354256341, success on 8535802d3609c854b1c91742135c84894e5e074f.
- Main Quality Gate after PR #89: run 42354517460, in progress at checkpoint time; exact-SHA result still required.

### Merged work
- PR #62: plan lifecycle preservation; exact-head run 42342109962 passed; merge SHA 8535802d3609c854b1c91742135c84894e5e074f; post-merge main run 42354256341 passed.
- PR #89: reapplied reviewed Quran audio repeat fix on current main; exact-head runs 42354410219 and 42354399498 passed; merge SHA e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- PR #63 was closed as superseded after PR #89 merged. Its stale/diverged branch was not merged.

### Ruqyah sync audit
- PR #88 is merged; progress persistence is UID-scoped local storage, not cloud sync.
- Inspected feat/ruqyah-cloud-sync-20261107. At observed head ec15084e9a1f20013476af5df83144f45456a595, exact-head run 42354431882 failed: 491 tests passed and 3 failed because the branch calls a nonexistent StorageService.saveRuqyahProgressSnapshot.
- The branch's observed changes add a Ruqyah allowlist entry and shared schema, but do not establish complete end-to-end mutation enqueue, storage projection, revisioned mutation validation, or a safe concurrent counter merge. Do not merge until these are implemented and tested.
- Ruqyah progress is a mutable aggregate counter. A safe sync design must preserve increments made independently on different devices; consider per-device monotonic counters or immutable increment events and deterministic aggregation. Snapshot last-write-wins is not acceptable.

### Remaining critical work
- User-facing conflict resolution is absent. RemoteProjectionConflict is an evidence archive, not a user decision. reconciled only means projection/cursor finalization succeeded.
- Tombstones remain blocked in remoteInboxProjector; no collection-specific delete projection or safe retention/compaction.
- Two-device tests are limited to profile round-trip and one offline same-document conflict.
- Cross-tab/browser, account lifecycle, all-collection coverage, production Firestore rules deployment, and production deployment/live smoke remain unverified.
- Vercel failure is the daily deployment rate limit, not a successful deployment. No production settings or secrets were changed.

## 2026-11-07 — Ruqyah sync, storage integrity, and accessibility follow-up

### Merged
- PR #91 merged at a618036b995ff45749748e90e2a4d3ec1037c838. Exact-head run 42355023151 passed. Adds journal-first UID-scoped Ruqyah progress sync, revisioned remote writes, sequential two-device projection, and backup v5 support.
- PR #92 merged at bd6fc3a79267ee7136746fed17c58a6ceac8b58c. Exact-head run 42355486226 passed. Protects unversioned canonical portions, blocks direct writes while migration is pending, validates duplicate IDs/ranges, and normalizes legacy history IDs.
- PR #93 merged at f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Exact-head run 42355488786 passed 500 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build, and server startup smoke.
- Current main run 42355600523 passed on f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3.

### Active follow-up
- PR #94 adds ruqyahProgress to the coordinator legacy remote-state scan and tests a concurrent-offline stale revision. It asserts local Outbox, remote Inbox, local snapshot, remote event, conflict archive, and projection cursor are preserved. Exact-head CI must pass before merge.
- The current Ruqyah counter snapshot model does not calculate an additive merge of two concurrent increments. The test documents safe blocking/preservation only; manual merge remains unimplemented.

### Remaining critical blockers
- Manual conflict-resolution UI and idempotent keep-local/use-remote/merge state machine.
- Deterministic additive merge for Ruqyah counts or an explicit user-driven resolution that has sufficient base/delta evidence.
- Collection-specific tombstone projection and deletion retention.
- Cross-tab browser concurrency, comprehensive two-device multi-collection coverage, and account lifecycle isolation.
- Production Firestore rules deployment, production environment verification, exact-SHA deployment, and live post-deploy smoke.
- Vercel build-rate-limit is not a successful production deployment. No production secrets, rules, or flags changed.

### Subsequent checkpoint update — PR #95 merged

- PR #95 merged at 52e62d6b21057cf0d796cc3b137f4087cbe2e983. Its exact-head Quality Gate passed on c2e9478f6053ddc95aaa5058d7a5ab074255d58b; the merge adds post-success Ruqyah progress notifications for direct backup import and full reset, with rollback-safe notification timing.
- Main Quality Gate run 42355938085 was in progress on 52e62d6b21057cf0d796cc3b137f4087cbe2e983 when this note was added; verify its final conclusion before the next release decision.
- PR #94 was created against the previous main SHA f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Its changes are disjoint from PR #95, but re-check mergeability and exact-head CI after main advanced.
- PR #96 documents the global stop condition: do not set remote-sync flags until manual conflict resolution, additive counter merge, tombstones, cross-tab coordination, account isolation, and live verification all pass.

## 2026-11-07 — API proxy and guarded rules deployment workflow

- PR #97 merged at 217f7136244d4d7afd02a9c52be86f520c1baefa. Exact-head runs 42356248195 and 42356243586 passed. Added server-only IslamicAPI proxy, topic block allowlist, disabled-by-default topic endpoints, and bounded streaming response reads.
- PR #98 merged at 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. Exact-head run 42356412901 passed 509 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke. Added a manual-only rules deployment workflow; it has not been dispatched.
- PR #100 is open to add a pre-deploy Firestore Emulator test to that workflow. Do not dispatch before the preflight is merged and explicit approval is given.
- Main run 42356505550 passed on 8089579d020a6a4831cdc9ba4f25f8672f30cc3d.
- Vercel status on current main is build-rate-limit failure; a previous SHA had Vercel success but the latest main deployment is not verified. No production alias/live smoke is claimed.
- Outstanding: user-facing conflict resolution, additive Ruqyah counter merge, tombstone projection, cross-tab concurrency, account lifecycle isolation, full collection coverage, Playwright E2E, production rules deployment, exact-SHA production deploy/live smoke.

## 2026-11-07 — Follow-up merges and current release blockers

- PR #104 merged at `46ed9e5976b2f22f2495a270edf8c2255e27962b`: Settings displays the archived local and remote conflict snapshots in a read-only, exact-UID-scoped inspector. Exact PR Quality Gate passed on `7c730c0e57830c90a820467669d755babb441ec3`.
- PR #106 merged at `14390679530f5a523a77997d882f12160c3ad1c9`: reverse B → A pass for all eight collection routes, revision 2 assertions, and contiguous ordered projection. Exact-head CI runs `42357426174` and `42357436438` passed (510 unit assertions, 31 Firestore rules tests).
- PR #105 merged at `d71908b3e411bcd7d1db2b09318eb3c95564198e`: IslamicAPI Quran locator only, canonical WIRD Quran text, source allowlist, topic gate, and disabled unverified audio. Main run `42357565644` passed 509 unit assertions and 31 Firestore rules tests.
- PR #108 source-registry hardening remains under review. The initial global Set permits a content item to swap to another item's approved reference; require exact item-ID-to-source mapping. `g-4` has a generic non-authoritative source label and must be resolved before merge.
- Vercel deployment is still blocked by provider quota; no live production SHA is verified.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.


## 2026-11-07 — PR #111 and populated eight-collection sync verification
- Subsequent main work: PR #117 removed dormant unverified audio playback code (merge SHA `673ddfcb5af046f785e2da18abc73c4a1bba2339`; exact-head run `42359507976`, 518 assertions and 31 rules tests passed). PR #120 hardened signed Quran coordinates and provider IDs (merge SHA `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`; exact-head run `42359703038`, 520 assertions and 31 rules tests passed).
- PR #115's browser test branch failed only during Playwright browser installation because Ubuntu 26.04 is unsupported by Playwright 1.56.1; its test/config files were reapplied on current main in PR #122 using Ubuntu 24.04. PR #122 remains under exact-head CI; browser smoke is not yet claimed passed.
- PR #118 was closed as a duplicate of already-merged PR #117 after confirming the 360-line playback removal is already on main. PR #113's older Ruqyah checkpoint is being superseded by PR #121; its release checklist changes are being preserved there.


- PR #111 merged as `48cf9b236072cd3db2603a57cda5f67b30a778cd`. It restricts IslamicAPI to validated Quran locator coordinates; displayed Quran text and metadata resolve from WIRD's canonical corpus. Duplicate PR #112 was closed after all code/test files were confirmed identical to main and its only remaining difference was stale checklist wording.
- PR #114 merged as `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`; exact PR head `9ff200bc731ac99db0d662f76dad97b370d00c9b` passed both push and pull-request Quality Gate runs `42359408488` and `42359412200`.
- Exact-head evidence: 513 automated assertions passed, 31 Firestore Rules Emulator tests passed, dependency audit passed, TypeScript passed, production build passed, and production/development server startup smoke passed.
- PR #114 replaces empty fixtures for plans, enginePlans, portions, weakVerses, tests, and activityEvents with valid non-empty domain records. All eight collections now have populated fixtures. The Emulator test performs sequential A → B → A projection with distinct B-side edits and compares complete local projection records and remote payload fields, plus revision 1/2.
- This does not prove simultaneous concurrent merge for every collection, long-offline replay, real-browser cross-tab behavior, or Playwright/device E2E. It closes the empty-record serialization/round-trip gap documented under PR #101/#106.
- Current main SHA: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`. Post-merge Main Quality Gate run `42359547235` completed successfully on `8ac5d87d84077f209eaf49881dd1354ce10d3565`.
- Vercel status remains `build-rate-limit`; this is a provider deployment quota failure, not a successful deployment. No production Firebase rules deployment, live deployed SHA, live two-device verification, environment-variable change, secret change, or production sync activation is claimed.
- PR #2 remains a draft and is 115 commits ahead / 266 behind current main; do not merge it wholesale. Review and selectively reapply any still-useful changes only.
- Next priority: design and implement an idempotent user-directed conflict-resolution state machine with durable preservation and latest-revision revalidation; then tombstone semantics, additive Ruqyah counters, cross-tab/Playwright, and account lifecycle stress tests. Keep production sync gates disabled.


## 2026-11-07 — populated multi-record sync, Playwright, and conflict-evidence checkpoint

- Current main at checkpoint: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`.
- PR #122 merged as `beec50a623febdfa79f286f7c2b87d8234b2b150`; exact head `945c0f73e965d0111d46c53179465ee4c98fb83a` passed six Playwright app-shell checks (three desktop, three mobile Chromium/iPhone 13 viewport emulation). Post-merge main run `42360161749` passed.
- PR #125 merged as `ceebd11995bece572d40230ab084858be5a40cf2`; exact head `b24e0eb8221c23498878ee0a58727990ad9f2dfd` passed 521 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright checks. Post-merge main run `42360526021` passed.
- PR #126 merged as `802811d45a6d7e977d3b4082fd08ebf5e95151fa`; exact head `9886ca8a090cf07f04b51943fbc254a4b98ce221` passed 521 automated assertions and 31 Firestore Rules Emulator tests plus the remaining Quality Gate steps, including Playwright. Post-merge main run `42360725981` passed.
- PR #129 merged as `ab1a2cd04a1456a6430985ce6f6e72a1b137907d`; exact head `334a73a05bddc4d574cdf8c25a0299f329b22c49` passed 525 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright app-shell checks. Its post-merge main run was cancelled when the subsequent documentation-only PR #130 updated main; current main Quality Gate run `42361224358` is the relevant post-merge validation and was in progress at this checkpoint.
- PR #129 makes normal remote projection and the final IndexedDB cursor/revision transaction document-scoped. Same-document pending writes still block; unrelated test-result documents can progress independently. Grouped `syncMeta` transactions retain collection-wide guards.
- PR #126 adds durable pending local mutation evidence to Conflict Archive, including mutation IDs, fingerprints, base revisions, sequence numbers, and payloads. Repeated observations append by mutation ID; a fingerprint mismatch or combined snapshot size above 500 KB aborts without deleting inbox/outbox entries or advancing the cursor. Settings displays at most ten archived mutation payloads while retaining the full archive.
- This is not yet a user-directed conflict-resolution state machine: keep-local, use-remote, safe merge, and revision revalidation actions remain unimplemented. Tombstones, additive multi-device Ruqyah counters, full auth/sync browser journeys, real two-device verification, and production deployment remain release blockers.
- PR #127 added 10 Ruqyah locator-library browser checks (five desktop and five mobile); combined with six app-shell checks, the full Playwright suite has 16 tests; PR #130 refreshed the Ruqyah checkpoint and release checklist after CORS hardening and locator-library E2E. These browser checks do not replace live Firebase/device tests.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit` on reviewed main updates. No live deployed SHA, live two-device verification, Firebase production-rules deployment, secret/environment-variable change, or production sync activation is claimed.
- PR #2 remains a draft, 115 commits ahead / 276 behind current main. Do not merge it wholesale.
- Next: implement the conflict decision state machine with atomic archival/revalidation and crash recovery; then tombstones, additive Ruqyah counters, broader Playwright workflows, backup/restore stress, and account lifecycle tests.


### Follow-up verification after the checkpoint

- Documentation merge PR #132 produced main SHA `3eeb1eb2da419536a1e2fc9db6911961d3bfafcc`.
- Post-merge main Quality Gate run `42361756445` completed successfully.
- The full Playwright suite in that run executed 16 tests total: 6 app-shell checks (3 desktop + 3 mobile) and 10 Ruqyah locator-library checks (5 desktop + 5 mobile). The earlier phrase “16 Ruqyah locator-library checks” was inaccurate and has been corrected.

## 2026-11-08 — tafsir sessions, reading khatma, mushaf navigation, and hadith references

- Implemented current-ayah tafsir in the shared memorization/revision session view, with edition choice, loading/error/retry states, stale-request cancellation, and source attribution. Added optional Quran Foundation hadith references in sessions and reading tafsir; display is restricted to Arabic entries with an explicit Sahih grade and the source mapping is labeled as a reference, not exclusive tafsir.
- Added a local reading-khatma tracker with page-based manual completion, progress and prior completed-cycle counts. It uses its own storage key and does not mutate memorization/revision records. Added page-turn/swipe treatment to the existing Mushaf reader and an explicit read-page action, respecting reduced motion.
- Added a server-side Quran Foundation Hadith References proxy. It validates Quran coordinates and page bounds, holds credentials server-side, filters results, rate-limits, times out, and fails closed when QF credentials are absent. Live upstream integration remains unverified because no QF credentials were configured; no new API source was introduced for Quran text.
- Added `docs/UX_PRODUCT_ROADMAP_AR.md` with a full interface roadmap and staged integrity/accessibility work. Reviewed OSS patterns from Ummah Library and StPageFlip; no third-party code or dependency was copied/added.
- Quran corpus audit compared all 6,236 ayat and metadata across 114 surahs with the checked-in Tanzil Uthmani/Hafs reference: 6,236 exact matches, zero text/metadata mismatches. Fussilat 41:7 matches the reference exactly. Report and reference checksum are in `src/data/quranValidationReport.json`.
- Automated gates: `npm test` PASS (584 passed, 0 failed); `npm run lint` PASS; `npm run build` PASS (existing large-chunk warning remains). `git diff --check` PASS. Firestore Rules Emulator BLOCKED because Java is unavailable. Server smoke/local browser access BLOCKED by the environment's localhost connectivity; mobile visual accessibility was therefore NOT TESTED. Hadith upstream is NOT TESTED without credentials.
- No GitHub push/PR, merge to main, deployment, production secret/config change, or cloud sync activation was performed. Work remains on `feat/session-tafsir-khatma-reader` pending review and any future release authorization.

## 2026-11-08 — production API runtime hotfix follow-up

- PR #167 merged as `b857ad33321e0cc5a8f7071074f3566c3dc863a5` after exact-head Quality Gate run `42484878901` passed (automated suites, dependency audit, Firestore Rules Emulator, TypeScript, build, server smoke, and desktop/mobile Playwright). Preview `2197a4205d72b930593d9dbfcf52f77839455722` was READY and returned HTTP 200.
- Production deployment `dpl_GLAponkC83mDEerECAM6mGMEsYU6` is READY on alias `wird-app.vercel.app`, matches the merge SHA, and the home page returned HTTP 200.
- Read-only production probing found metadata-backed serverless endpoints returned `FUNCTION_INVOCATION_FAILED`. Native Node loading isolated extensionless TypeScript imports in the Quran metadata dependency. Corrected metadata/API imports to explicit `.ts` paths and made the metadata type-only import explicit. Added `smoke:api-imports` to verify native Node imports and invalid-input responses, and wired it into CI.
- Local after hotfix edits: `npm test` (584 passed), `npm run lint`, `npm run build`, and `npm run smoke:api-imports` passed. The API smoke exercises invalid inputs only and does not call external providers. The fix is not deployed yet; create a hotfix PR from current main, run exact-head CI, verify Vercel preview API responses, then merge only if green.
- No production credentials/settings or cloud sync configuration changed. Hadith live upstream still requires server-side Quran Foundation credentials and remains untested.

---

## 2026-11-13 — Documentation reconciliation commit

- Appended targeted Engine Plans direct-consumer and sync-boundary audit to RFC section 16, and reconciled current main/Production/PR/CI state in the live continuation, change-control policy and checkpoint.
- PR #363 documentation branch advanced to `c0596ba24c7c00def8f67a77be1372b9dd67f839`; PR remains OPEN/DRAFT. No main change, merge or deploy.
- The live continuation now records its own latest docs head and keeps archive migration on HOLD until the complete caller/fixture/E2E matrix is finished.


## 2026-11-13 — Engine Plans second-pass code-source audit

- Re-read exact main ref `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` and refreshed PR heads #363–#372. All remain OPEN/DRAFT; no merges or deployments.
- Scanned all 183 TS/TSX/JS files in the repository tree: 159 src, 18 e2e, 1 scripts, 5 api. Added the complete call-site-to-test matrix to RFC section 17.
- Expanded inventory to cover dailySessionSelection, cloudSyncCoordinator, demoDataPersistence, revisionedRemoteMutation, PlanningEngineWizard, Firestore Rules tests, and all direct StorageService projection/backup/scope methods.
- Identified missing dedicated tests for AuthGate archive hydration, archive migration/crash/quota, Engine Plans scope switching, demo transaction, session plan snapshot, remote Inbox archive materialization/cursor, and Engine Plans conflict resolution.
- Identified payload ceiling mismatch for future large-plan conflict handling: normal Engine Plans journal mutation ceiling 450,000 bytes; conflict intent/use-remote/keep-local generic payload checks and legacy localStorage Outbox parser remain 128,000 bytes.
- Rechecked PR #372 run `43391729769` / job `131773203535`: no steps/logs; log endpoint returned BlobNotFound. BLOCKED observability. No full-source tests, typecheck, build, emulator or Playwright executed.
- No source code or production settings changed. No test execution in this documentation/audit pass. Engine Plans migration remains HOLD.


- Additional corruption-safety finding: `StorageService.getEnginePlans()` delegates to `readJsonArrayArchive` (`storageService.ts:378-395`), which filters malformed records or returns an empty array while preserving the original bytes. Migration must use a strict raw-byte read/validator and fail closed rather than hydrate from a filtered/empty fallback.



## 2026-11-13 — Remote Inbox, cursor, and conflict transaction review

- Reviewed main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` in `indexedDbSyncJournal.ts`, `remoteInboxProjector.ts`, `syncConflictResolutionService.ts`, `cloudSyncCoordinator.ts`, and `journalProjectionReplayer.ts`.
- Confirmed `remoteCursor` is the durable ingestion cursor: remote Inbox rows and cursor advance in one IndexedDB transaction after contiguous page validation. `remoteProjectionCursor` is separate and advances only after projection/finalization; coordinator requires equality before reporting reconciliation complete.
- Confirmed normal remote finalization atomically updates revision/baseline metadata, projection cursor, Inbox deletion, and conflict closure in IndexedDB. However its synchronous apply callback writes localStorage inside that transaction; this is not cross-database atomicity. Existing durable intent/replay is a recovery protocol. IndexedDB archive must become canonical; localStorage remains a rebuildable projection.
- Confirmed conflict preparation and both use-remote/keep-local commit APIs enforce 128 KB, while Engine Plans Inbox validation permits 450 KB. Large Engine Plans conflicts can be received but cannot be explicitly resolved. Require archive revision references in conflict intents/Outbox, not blanket cap increases.
- Added detailed transaction contracts and 7 test groups to RFC section 18. No code changed and no tests executed. Stage B remains HOLD.



- Reviewed PR #371 chunk codec at exact head 260df95c620cd534337e39d6707b044eb404139a. Pure codec has SHA-256 chunk/record/archive integrity and 192 KB fragments, but no manifest paging, streaming, persistence, Firestore transport, journal/outbox/inbox integration, domain schema validation, conflict support or crash/quota recovery. Added RFC section 19; manifest descriptor list requires hierarchical paging before Firestore publication.
- Refreshed exact-head CI evidence: #371 run 43278752980/job 131394096177 and #372 run 43391729769/job 131773203535 both failed with null steps/logs. BLOCKED observability, not code-level FAIL/PASS. No tests executed locally; no source changes.


- Latest PR #363 docs head c08186440e28ec53a6e7434c5212c7bed61b81e2: run 43400615632/job 131802241149 completed failure with null steps/logs; log retrieval returned BlobNotFound. BLOCKED observability, not a docs or code-level diagnosis. Keep Draft; no CI PASS.


## 2026-11-13 — Engine Plans archive repository design and CI refresh

- Added RFC §20 defining the archive repository boundary: existing IndexedDB database extension (proposed v10), guest/user scope keys, immutable revisions, bounded manifest pages, asynchronous repository APIs, atomic publish transactions, copy→verify→publish migration, multi-tab fencing, rollback and reachability-based GC.
- Updated `docs/CONTINUE_HERE.md` with the current main/Production baseline, exact PR heads, CI observability outcomes and next gates.
- Refreshed exact-head CI: #363 run 43400687488/job 131802482654, #372 run 43391729769/job 131773203535 and #371 run 43278752980/job 131394096177 all completed failure without inspectable steps/logs; log retrieval returned BlobNotFound. All are BLOCKED — observability, not source-level FAIL and not PASS.
- Reviewed #367 changed paths and patch: 800 KB is a shared interim inline budget; 128 KB ordinary mutations; 1.7 MB conflict evidence. It does not implement chunked archive transport or adaptive entitlement.
- Reviewed #371 changed paths and codec: pure chunk codec only; no repository, manifest paging, streaming transport, or sync/conflict reference integration.
- Reviewed #372 changed paths: CI workflow, bun.lock, package.json, Playwright config; one Bun 1.4.4 lockfile path. Isolated dependency checks are PR-author-reported only; full repository Quality Gate remains blocked by missing job logs.
- No source code or runtime tests were executed in this continuation. No main, Production, Firebase Rules/data, secrets, sync flags, or user data changed. No merge or deployment.
- Engine Plans caller inventory and call-site→test matrix remain incomplete. Stage B remains HOLD.


## 2026-11-14 09:00 local — CI retry and Production re-check

- Re-fetched all 16 open PRs. All remain OPEN / DRAFT. Current exact heads are recorded in `MASTER_PROJECT_STATE.md`; #375 advanced to `495b9ccada1bb327abeee469af16faa52ddc9707` after the prior checkpoint. #363 remains `3f6f2bd53ad906af05a65ef7fa76adf31a49fd57`.
- Retried the failed job for PR #375 Quality Gate run `43570354110`. Latest attempt job `132373650377` again completed failure without any recorded steps or log URL. This supports a GitHub Actions runner/job initialization or telemetry problem, not a diagnosed application test failure.
- Rechecked exact-head runs: #373 `43568676649`, #363 `43570268180`, #372 `43391729769`; all show the same no-steps/no-logs failure.
- Re-fetched Vercel Production deployment: `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` READY on `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Re-listed Vercel env metadata without decrypting secrets. Production sync flags remain `true`, a release-policy discrepancy. No Vercel/Firebase settings were modified and no secret values were read.
- No PR merged. Ruqyah remains Preview-only; production post-fix smoke is NOT VERIFIED.


## 2026-11-14 09:05 local — GitHub Actions log endpoint verification

- Queried job steps and downloaded logs for PR #375 retry job `132373650377` and previous attempt `132368486361`.
- Both step endpoints returned empty arrays. Both log downloads returned Azure `BlobNotFound` HTTP 404.
- No shell command, checkout, install, test, lint, or build output is available. Root cause remains BLOCKED/unknown at GitHub Actions job initialization or log artifact storage. No workflow tests were disabled or weakened.


## 2026-11-14 09:10 local — PR changed-path conflict map

Re-fetched changed filenames for #367, #369, #371, #368, #358, #359, #366, #374, #372, #373, #364, and #363. Confirmed:
- #367/#369 overlap in `PlanningEngineWizard.tsx` and `runAllTests.ts`.
- #367/#369/#371/#368 share `runAllTests.ts`.
- #368/#358/#359 share `runAllTests.ts`; retain #368 as the unified store candidate and keep #358/#359 superseded.
- #372/#374 both modify `package.json` and `bun.lock`.
- #363/#374 both modify `docs/engineering/README.md`.
- #366/#368 have no changed-path overlap but still require semantic integration of service-worker versioning and Cache Storage ownership.
- #374 includes a temporary media artifact path under `.aistudio/artifacts/brain/.../.tempmediaStorage/`; verify generated/unreferenced before deletion.
The full matrix and safe integration order are in `MASTER_PROJECT_STATE.md`.


## 2026-11-14 09:15 local — #374 hygiene PR integration review

- Inspected #374 changed-path inventory and patches for its binary artifact, package.json, engineering README, and audit report.
- #374's engineering README still designates `progress/WORK_LOG.md` as active history, conflicting with #363's canonical `docs/engineering/WORK_LOG.md` and compatibility pointer. Marked this in the #374 PR description.
- #374's package name-only correction overlaps #372's package/lockfile dependency graph update. Marked both as a serialized integration conflict; do not merge one branch's stale lockfile over the other.
- The deleted binary was reported as the only tracked file in its temporary-media directory and unreferenced by code/blueprint. Its patch is binary and not text-inspectable; associated blueprint/implementation plan remain retained. No other artifacts or user data were deleted.
- #374 remains OPEN/DRAFT; no merge or deployment.


## 2026-11-14 09:20 local — Engine Plan archive codec resource review

Reviewed full PR #371 codec source and tests. Confirmed canonical JSON validation, SHA-256 integrity, per-record fragmentation, missing/extra/corrupt chunk rejection, and stable reconstruction. Identified release blockers: no maximum total archive bytes/record count/chunk count/fragment count; full in-memory chunk retention plus duplicate archive fingerprint allocation; no manifest byte-size ceiling; descriptor preflight is not bounded before materialization; no IndexedDB/Firestore persistence integration, atomic manifest/CAS, rollback, or orphan-GC protocol. The six codec tests do not cover these resource-exhaustion and migration/integration cases. Details and required gates recorded in `MASTER_PROJECT_STATE.md`. No code changed because no safe end-to-end integration can be validated while exact-head CI telemetry is unavailable.


## 2026-11-14 09:25 local — PR #369 exact-head re-review

- Re-fetched PR #369 after its head advanced to `3478ae22a200a817a240d8b28e532b01674427bf`.
- Inspected commit `fix(plans): include final ayah in Juz 30 range`. It explicitly uses canonical terminal coordinate `114:6` for Juz 30, addressing the previously observed terminal-boundary defect.
- Exact-head Quality Gate run `43570929405`, job `132374935104`, failed with no recorded steps/logs. Vercel combined status reports Free-plan `build-rate-limit`.
- The PR branch documentation reports seven isolated range tests PASS, but these were not independently executed in this session; the claim is therefore not independently verified here.
- Updated PR #369 description with the finding. Remaining gate: table-driven coverage for all 30 Juz boundaries and browser interaction tests.


## 2026-11-14 — Owner master handoff requirements integrated into canonical plan

- Source: owner-provided WIRD MASTER HANDOFF & AUTONOMOUS EXECUTION prompt. Incorporated as requirements only; no application code, production setting, secret, Firebase data/rule, sync flag, or deployment was changed.
- Updated the live continuation queue, unified development roadmap, and release checklist with the ordered recovery → CI → Ruqyah → Engine Plans/memorization → offline/PWA → security → Seerah → documentation → release workstreams.
- Added acceptance requirements for verified local Quran text/provenance, lazy Ruqyah route loading, flexible memorization ranges and lossless archive migration, unified offline-audio ownership/recovery, Advisor/API security, sourced/licensed Seerah, historical work-log preservation, exact-SHA evidence and separate local/CI/build/Preview/Production/live verification.
- Preserved existing change-control rules: serialize shared paths; no blind PR merges; no production secrets/settings, Firebase Rules/data or sync-flag changes; no destructive user-data operations or sync activation without required approval.
- PR inventory in the supplied prompt is treated as a historical review index only. Re-fetch exact PR states/heads/files/checks before action. PR #375 remains closed/superseded by #363 and no competing master handoff was recreated.
- No tests were run because this was a documentation-only planning update. Exact-head CI/Preview evidence must be re-fetched after these commits; no pass is claimed.


## 2026-11-14 — Knowledge-base readiness reconciliation

- Re-fetched GitHub state: main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; PR #363 OPEN/DRAFT, mergeable, based on current main, exact head `84452fcf45c1e73bbefabd850b7c218aa1d760b5` before this addendum.
- Re-fetched open PR inventory: 16 OPEN/DRAFT PRs (#374–#363, #359, #358, #2); #375 and #360 CLOSED/unmerged; #361/#362 MERGED. Re-fetch exact heads before action.
- PR #363 changes 44 paths (6,515 additions / 542 deletions). Exact-head Quality Gate run `43629972574` / job `132554211307` completed SUCCESS with inspectable steps. Automated suites, dependency audit, API import, approved audio checks, Rules Emulator, TypeScript, production build, server startup and desktop/mobile smoke passed. The 604 Mushaf coordinate-map step was SKIPPED.
- GitHub Vercel status context on the docs head is SUCCESS. Direct Vercel project/deployment API reads returned 403 Forbidden; current Production deployment metadata is NOT VERIFIED in this session. No Vercel settings or deployment changed.
- Confirmed canonical entrypoints are not yet on main: fetches for `docs/CONTINUE_HERE.md` and root `README.md` returned 404. Cross-chat/Google AI Studio continuity from main is not yet established until the docs PR is accepted and merged.
- Prepared a single current-state/continuation snapshot, explicitly demoted dated snapshots to historical evidence, and added new-request intake plus open-source-first/API research policies to engineering/agent guidance.
- No runtime source, Quran corpus, Firebase Rules/data, Vercel settings, secrets, sync flags or Production deployment changed. No local tests were run. Documentation-only; re-fetch exact-head CI after this commit.


## 2026-11-14 — Vercel/Firebase/API and changed-path verification

- Correct Vercel team scope was resolved through the linked WIRD team. Project `wird-app` is Vite / Node 26.x. The docs PR Preview deployment `dpl_9m6Buo1inV56b8vo4VXEQvCeppJp` is READY on exact head `06c4add35ed1a9870d20867b2cc276c54e536c91`. Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY on main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, alias `wird-app.vercel.app`.
- Vercel project protection: password protection OFF; SSO enabled for non-custom domains. No settings were changed.
- Read-only environment inventory: `ISLAMICAPI_API_KEY` and `GEMINI_API_KEY` sensitive entries exist for Preview and Production; values were not read and validity was not tested. Both Production sync flags remain `true`; no changes made.
- Main source `src/lib/firebase.ts` and `firebase-applet-config.json` identify canonical project `wird-quran-app` and default Firestore database. Vercel `VITE_FIREBASE_PROJECT_ID` remains encrypted/not decrypted; deployed Firestore Rules state remains NOT VERIFIED. The manual deploy workflow is guarded to the canonical project; no Firebase operation was performed.
- Exact path comparison found #374/#363 overlap at `docs/engineering/README.md`; #359/#363 overlap at `docs/offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md`; #2/#363 overlap at `docs/DEVELOPMENT_CHECKPOINT.md` and `docs/engineering/FIRESTORE_SYNC_DESIGN.md`. Other listed active PRs had no path overlap with #363 at this snapshot.
- Historical work-log preservation independently checked: the 537-line main `docs/engineering/progress/WORK_LOG.md` is an exact text prefix of the 663-line canonical `docs/engineering/WORK_LOG.md` on the docs branch. The old path is a compatibility pointer. No historical work-log content was lost.
- Link scan across the seven edited canonical/agent files found zero broken relative links. The broader PR's prior link audit reported zero broken links; no claim is made that every unchanged link was re-scanned in this pass.
- No secrets were read, no production settings or flags changed, no Firebase Rules/data changed, and no deployment was initiated manually.


## 2026-11-14 — Canonical entrypoint and instruction consistency

- Added a root `README.md` on PR #363 so repository visitors and new agents have a stable starting point to the canonical queue, state, architecture, roadmap, release checklist and work log. It remains on the docs branch until merge.
- Reconciled the leading current-state snapshots to avoid pinning a self-updating PR head; future sessions must re-fetch the exact head and checks.
- Corrected live instructions in `AGENTS.md` and `docs/CHANGE_CONTROL.md` to append only to `docs/engineering/WORK_LOG.md`; the former progress path is a compatibility pointer, not an append target.
- PR #363 now changes 45 files (6,753 additions / 542 deletions), still documentation/instruction-only. Use squash merge if accepted because GitHub compare reports 365 commits ahead of main; avoid importing the branch-only commit history as individual commits.
- Confirmed path overlaps with #374, #359 and legacy #2 are recorded in the current state/queue. No overlapping PR is to be merged concurrently.
- The current #363 head must pass its own final inspectable Quality Gate and Vercel Preview before merge. No merge or Production/Firebase changes occurred in this update.


## 2026-11-14 — Final snapshot wording correction

- Removed self-updating PR-head and preview claims from static current-state text where they could become stale immediately after a documentation commit. Future sessions must fetch live PR metadata, checks and deployment SHA.
- Changed the merge recommendation to describe the docs branch's large branch-only history without pinning a commit count; use squash only if the reviewed PR is accepted.
- Current #363 head at this note: `243d15092c61c6cc0a5cc8f18831267bf2db5114`. Its exact-head Quality Gate is pending; no pass is claimed for this head.


## 2026-11-14 — Historical document demotion and owner-action refresh

- Added explicit routing banners to `CHANGE_CONTROL.md`, `DEVELOPMENT_ROADMAP.md`, and `DEVELOPMENT_CHECKPOINT.md` so policy/product planning is not mistaken for live PR/deployment state and old dated checkpoints cannot override the canonical queue.
- Replaced the leading `OWNER_ACTIONS.md` section with current read-only observations: sync flags remain true; Vercel password protection is off and non-custom-domain SSO is on; branch-protection read is currently denied by the GitHub integration; Firebase project identity is canonical in source but encrypted Vercel project-ID env and deployed Rules remain unverified; API credentials exist as sensitive entries but were not read or validated; AI Studio sync and physical-device checks remain unverified.
- No owner-only setting was changed. Historical owner-action notes remain below the new current snapshot for traceability.


## 2026-11-14 — Deployment evidence freshness rule

- Removed pinned prior-preview identifiers from the live queue/state summary. Preview evidence must always be re-fetched and matched to the exact live PR head; a READY deployment for an earlier commit is not current-head evidence.


## 2026-11-14 — Mandatory automatic documentation and new-session bootstrap

- Added `docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md` as the single required contract for cross-chat bootstrap, source-of-truth ownership, automatic documentation closeout, out-of-roadmap request intake, current-snapshot replacement vs append-only history, API inventory, and open-source-first research.
- Updated root `AGENTS.md`, `GEMINI.md`, root `README.md`, `docs/CONTINUE_HERE.md`, and the leading `MASTER_PROJECT_STATE.md` section to require the standard. The owner must never need to remind an agent to document work.
- Documentation/instructions only. No runtime code, production settings, Firebase Rules/data, secrets, sync flags, or deployment configuration changed. Exact-head CI and Preview evidence must be refreshed for this commit.


## 2026-11-14 — Documentation operating standard indexed and verified

- Added `docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md` and wired it into root `AGENTS.md`, `GEMINI.md`, `README.md`, `docs/CONTINUE_HERE.md`, `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/CHANGE_CONTROL.md`, and `docs/DOCUMENTATION_CATALOG.md`.
- The standard makes new-session bootstrap, automatic documentation for every request (including out-of-roadmap requests), current-snapshot replacement, append-only history, API inventory, and open-source-first research mandatory without owner reminders.
- Exact docs PR head at this checkpoint: `086d92a522f2d795f4c96f6358342338a6de8e4c`; PR #363 remains OPEN/DRAFT, 46 changed paths, 373 commits ahead / 0 behind main. Preview deployment `dpl_9w8QarojoWq6pCuHoEsfFqGMuGPF` is READY on that exact SHA. No GitHub workflow run was returned for this SHA; exact-head CI is NOT VERIFIED. Earlier successful CI does not transfer.
- Link scan across the nine canonical/entrypoint files found zero broken relative links. No runtime code, Production settings, Firebase Rules/data, secrets, sync flags, or user data changed.


## 2026-11-14 21:40 +02:00 — PR #363 merged; mandatory documentation standard now on main

- Merged PR #363 using Squash with expected head SHA `26c9deb5872868f1f74e119391a0b6f9ad74af3d`.
- Merge commit / current main observed: `fb8e57640db78545fc93ce3f482b7ab3a9f59ded`.
- PR #363 exact-head GitHub Actions run `43632493503`, job `132562026967`: completed SUCCESS. Desktop/mobile browser smoke completed SUCCESS; automated suites, dependency audit, API imports, approved audio checks, Firestore Rules Emulator, TypeScript, production build and server startup all completed SUCCESS.
- The 604 printed Mushaf coordinate-map check was SKIPPED; it remains NOT VERIFIED and is not represented as a pass.
- Vercel Preview `dpl_xUZ388H5z3tqvUSqqeG6nVc3itcu` was READY on the exact pre-merge PR head. Existing Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` remains READY on the pre-merge main parent SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; no new Production deployment/live verification is claimed.
- Readback confirmed `docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md`, root `AGENTS.md`, `GEMINI.md`, and `README.md` are available from main.
- Open PR inventory was refreshed: #374, #373, #372, #371, #370, #369, #368, #367, #366, #365, #364, #359, #358 and #2 remain OPEN/DRAFT at the recorded heads. Re-fetch before any action.
- Documentation-only merge; no runtime code, Quran data, Firebase Rules/data, Vercel settings, secrets, sync flags or Production deployment changed.
- Next: continue exact-head Ruqyah review (#373), reconcile #372/#374, then audit coupled offline PRs (#366/#368) and remaining active work. Full repository stale-doc audit remains IN PROGRESS.


## 2026-11-14 21:42 +02:00 — Post-merge canonical snapshot refresh

- Updated the leading continuation queue, master state, release checklist, owner actions, and this append-only log after PR #363 merged.
- Follow-up docs-only commit: `d23f2d0cf4186f04bc4c7b7b0afa4c6b2b39b38e`. Main ref update was confirmed; this is the current recorded docs checkpoint SHA.
- No GitHub Actions run was returned for this follow-up SHA at verification time; combined Vercel status was PENDING. Do not claim CI or Preview success for this follow-up commit.
- Corrected the release checklist to distinguish the existing Production deployment (still on pre-merge runtime SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`) from the new documentation-only main commits. No Production deployment is claimed.


## 2026-11-14 21:58 +02:00 — PR #373 Ruqyah lazy-loading fix merged

- PR #373 merged by Squash with expected head `c42286fa6a5a85bba414a45383a56bd7a00f0cc2`.
- Merge commit / current main: `d265bdf37e9410ad6cd99273bb595526dce63b50`.
- Exact-head GitHub Actions run `43634212804`, job `132567343695`: SUCCESS; automated suites **711 passed / 0 failed**.
- Firestore Rules Emulator, TypeScript, production build, server startup smoke, API import checks, approved audio CDN/range checks passed.
- Desktop + mobile Playwright: **160 passed**. Ruqyah E2E covered section playback/pause/resume/stop, individual ayah controls, delayed play cancellation on category change, category-change stop, local-only Quran text, index error/cache/retry states and responsive controls.
- The dedicated 604 printed Mushaf coordinate-map verification step was SKIPPED; it remains NOT VERIFIED.
- Vercel Production deployment `dpl_6rDxKfTk19xmc94uqnY7toYKfm5Q` is READY on exact main SHA `d265bdf...`; alias `wird-app.vercel.app`.
- Connected browser readback showed the Production app loaded at `/#/session`. The Ruqyah route/audio was not directly opened or live-smoke-tested.
- Ruqyah now uses the existing per-Surah lazy loader and validates local Quran chunks. API records remain coordinate-only; UI displays WIRD-local verified Quran text. Full-program recordings remain disabled pending content/rights verification.
- No Quran corpus, Firebase Rules/data, secrets, Vercel settings, sync flags or manual deployment changed.
- Next: reconcile #372/#374 lockfile overlap; keep offline-audio duplicate-store PRs #358/#359 separate from #368.



## 2026-11-14 22:02 +02:00 — Post-merge documentation reconciliation and release evidence

- Refreshed the continuation queue, master state, release checklist, Google AI Studio handoff, architecture, performance audit, sync release gates, Ruqyah release checklist, and documentation catalog after PR #373.
- PR #373 code merge remains `d265bdf37e9410ad6cd99273bb595526dce63b50`; documentation-only checkpoint commits `1c025e0e476ebdaa1250fffce2e154848ca52eee` and `f8935344f16c35a4ab4739bc0484df220d8d267a` followed it.
- Production deployment `dpl_6KvNeEcmRV53ERHisLNwQgNTcojV` is READY on docs-only main commit `1c025e0...`, which includes the Ruqyah code merge. The current branch head before this work-log update was `f893534...`; re-fetch main after this commit for the exact latest HEAD.
- Documentation catalog count corrected from 45 to 55 Markdown files under `docs/`; canonical WORK_LOG path corrected to `docs/engineering/WORK_LOG.md`.
- Current-state documents now distinguish the application-code merge SHA from later docs-only commits and avoid claiming live Ruqyah audio verification.
- Google AI Studio synchronization remains NOT VERIFIED. The 604 Mushaf coordinate-map check remains SKIPPED/NOT VERIFIED.


## 2026-11-14 — Bun CI migration merged and Production verified

- PR #372 was marked Ready and squash-merged after exact-head GitHub Actions run `43391729769` completed successfully on `950640ea78d29e87d426a89d8887c15e4de2abac`.
- Merge commit / new `main` HEAD: `f264e4bdea7496090f60940e9e8db03e2fb15696` (parent `1a9f5370d10000bc45409a35c7801047d0e6700f`).
- Executed gates passed: Bun 1.4.4 frozen install, `bun audit --audit-level=high`, automated tests, API import smoke, Quran audio CDN/byte-range check, Firestore Rules Emulator, TypeScript, production build/Quran chunk validation, server startup smoke, Chromium install, and desktop/mobile Playwright. Optional 604 printed Mushaf coordinate-map validation was SKIPPED and remains open.
- Vercel Production deployment `dpl_7UMxgj7wPatYfKKXVhTCgijomcfe` reached READY on exact merge SHA; production alias `wird-app.vercel.app` was assigned. This does not prove live Ruqyah route/audio behavior.
- PR #374 remains Draft/HOLD at `6673bb149a2ffa58177c35b9f68c76423dfb2a0b`; compare against new main shows 8 commits behind and 7 ahead. Do not merge its stale lockfile or obsolete `docs/engineering/README.md`. Port only verified temporary-media deletion and workspace-name cleanup onto current main after regeneration and exact-head validation.
- No Firebase production Rules/data, secrets, Vercel settings, sync flags, or Google AI Studio settings were changed. Google AI Studio synchronization and live Ruqyah route/audio remain NOT VERIFIED.


## 2026-11-16 — Google AI Studio workspace hardening, PWA/build fix, and full E2E verification

- **Environment:** Google AI Studio workspace (`/app/applet`, no `.git` remote push configured; changes remain local to Studio and were **not** committed/pushed to GitHub and **not** deployed to Vercel Production per owner instruction).
- **Firebase configuration verified (`firebase-applet-config.json`):** `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`. No Production Rules, user data, secrets, or Vercel sync flags were modified.
- **Changes implemented in workspace:**
  - `api/advisor.ts`: fixed TypeScript object narrowing (`metrics = userData as Record<string, unknown>`) for strict `tsc --noEmit`.
  - `server.ts`: fixed Arabic rate-limit error copy typo (`يرجى الانتار قليلاً` -> `يرجى الانتظار قليلاً`).
  - `src/components/brand/BrandDesignShowcase.tsx`: added `copyTimerRef` cleanup on repeated clicks and unmount.
  - `package.json`: updated `"build"` script to `"NODE_ENV=production vite build"` because the Studio shell exports `NODE_ENV=development`, which previously emitted `jsxDEV` transforms and set `import.meta.env.PROD=false` (suppressing Service Worker registration).
  - `src/main.tsx`: switched `/sw.js` registration from `window.load` to immediate / `DOMContentLoaded` execution so slow/unreachable external font stylesheets cannot stall Service Worker registration, while keeping `pwaIntegration.test.ts` markers intact.
  - `public/sw.js`: moved `precacheQuranFont(cache)` after shell precache as non-blocking `void precacheQuranFont(cache)` so font CDN timeouts never block SW installation.
  - Updated E2E tests (`e2e/plans-ux.spec.ts`, `e2e/ruqyah-ux.spec.ts`, `e2e/memorization-audio-repeat.spec.ts`, `e2e/memorization-session-display-ux.spec.ts`, `e2e/progress-ux.spec.ts`, `e2e/wird-navigation-tafsir.spec.ts`) to match current UI/accessibility copy and added `__wirdPlayedUrls` + active-track (`onended !== null`) tracking on `MockAudio` because `QuranAudioQueueController.prepareNext()` preloads the next `Audio` track with `onended = null`.
  - Documentation reconciled: `docs/CONTINUE_HERE.md`, `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/engineering/RELEASE_CHECKLIST.md`, `docs/OWNER_ACTIONS.md`, `docs/agent-handoffs/LATEST-GOOGLE-STUDIO.md`, and this entry in `docs/engineering/WORK_LOG.md`.
- **Executed verification (observed on final state):**
  - `npx tsc --noEmit`: **PASS**
  - `npm test` (`src/tests/runAllTests.ts` + pre-scripts): **PASS** (`731 PASSED | 0 FAILED`)
  - `npm run build` (`NODE_ENV=production vite build`): **PASS** (`2.19s`; chunks under 500 kB; 9-asset shell precache manifest + 252 lazy assets; `/sw.js` present, no `jsxDEV`)
  - `npm run mushaf:validate-coverage`: **PASS** (all 604 Hafs/KFGQPC SVG pages; 6,236 unique local ayahs mapped once)
  - `npm run smoke:api-imports` & `npm run smoke:server`: **PASS**
  - Desktop + Mobile Playwright across all 18 `e2e/*.spec.ts` files (`--workers=2`): **PASS** (`162` passed, `2` intentionally skipped, `0` failed; includes offline app-shell reload and 252-asset full offline preparation)
  - `npm run test:firestore-rules`: **BLOCKED** in AI Studio container (`Error: Could not spawn java -version`)
- **Unresolved risks / next action:** push Studio workspace diff to a GitHub feature branch/PR and run the full GitHub Quality Gate workflow (which includes Java for Firestore Rules Emulator), add `ais-dev-*.run.app` preview origin to Firebase Console Authorized Domains if preview Google login is needed, and await owner decision on Vercel Production sync flags before any Production deployment.


## 2026-11-17 — Auth/Conflict/Advisor/Ruqyah/Plan UI & Service Hardening (AI Studio workspace)

- **Environment:** Google AI Studio (`/app/applet`); uncommitted local changes only (**not** pushed to GitHub and **not** deployed to Vercel per owner directive).
- **Changes implemented:**
  - `src/services/authService.ts`: fixed Persian typo (`لا يوجد کاربر` -> `لا يوجد مستخدم`) in `resendVerificationEmail` and `reloadUserStatus` null-user errors.
  - `src/services/advisorService.ts`: added `buildBoundedChatPayload()` to clamp chat messages to 500 chars and bound multi-turn `history` (max 6 recent entries, <= 3,600 wire bytes) so requests never hit the server's 4,096-byte `PAYLOAD_TOO_LARGE` rejection after long chats; wrapped all 3 `fetch` abort timers in `try/finally` `clearTimeout(timeoutId)`.
  - `src/components/settings/SettingsView.tsx`: wired `containsUnsafeFullSnapshotProjection()` into the sync conflict review UI so `weakVerses`, `activityEvents`, and unsafe `syncMeta` conflicts hide `use-remote` / `keep-local` replacement buttons and display explicit fail-closed status guidance instead of throwing after a Firestore read; also prevented unsafe `preparedIntent` retry buttons.
  - `src/components/assistant/QuranAdvisorView.tsx`: added unmount guard (`active` flag) around `AdvisorService.checkStatus()`, `maxLength={500}` on chat input, and replaced numeric `availableDailyMinutes` state with string-backed `dailyMinutesInput` + bounded derivation (`targetPages = 604` when `targetAjza === 30`) so clearing or editing the field never displays `NaN يوماً`.
  - `src/components/ruqyah/RuqyahView.tsx`: tracked the 300ms auto-advance scroll timer in `autoAdvanceTimerRef` and cleared it on re-trigger, category change, and unmount.
  - `src/components/plans/PlanningEngineWizard.tsx`: added `safePaceQuantity`, positive `paceQuantity` check in `generatePreviewSafely`, and `onBlur` normalization so temporarily cleared/zero number inputs do not yield `0`/`NaN` feasibility or crashes.
  - Added regression assertions in `src/tests/geminiSecurity.test.ts` (4KB payload bound), `src/tests/firebaseAuth.test.ts` (Arabic null-user errors), and `e2e/advisor-ux.spec.ts` (calculator empty-input `NaN` guard & `604`-page full Quran target).
  - Reconciled `docs/CONTINUE_HERE.md`, `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/engineering/RELEASE_CHECKLIST.md`, `docs/agent-handoffs/LATEST-GOOGLE-STUDIO.md`, and `docs/engineering/WORK_LOG.md`.
- **Executed verification (observed on final code state):**
  - `npx tsc --noEmit`: **PASS**
  - `npm test`: **PASS** (`733 PASSED | 0 FAILED`)
  - `npm run build` (`NODE_ENV=production vite build`): **PASS** (`2.07s`; chunks < 500 kB; 9-asset shell manifest + 252 lazy assets; `/sw.js` active without `jsxDEV`)
  - `npm run mushaf:validate-coverage`: **PASS** (`604` SVG pages / `6,236` unique local ayahs mapped once)
  - `npm run smoke:api-imports` & `npm run smoke:server`: **PASS** (production & dev Express servers)
  - Desktop + Mobile Playwright across all 18 `e2e/*.spec.ts` files (`--workers=2`, run in clean batches): **PASS** (`164` passed, `2` intentionally skipped, `0` failed; Batch 0 `advisor-ux` 6/6, Batch 1 `settings-ux`/`ruqyah-ux`/`plans-ux`/`app-shell` 38/38, Batch 2 50/50, Batch 3 70/70 + 2 intentionally skipped)
  - `npm run test:firestore-rules`: **BLOCKED** in AI Studio container (`Error: Could not spawn java -version`)
- **Next action:** Push Studio workspace changes to a dedicated GitHub feature branch/PR and execute GitHub Quality Gate CI (including Firestore Rules Emulator with Java); keep Vercel Production deployment and sync flags unchanged until explicit owner authorization.


## 2026-11-19 — Full Platform Transformation Stage A (Audit & Roadmap) + Phase 1 Stabilization (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace` (Node `v26.13.0`, npm `11.20.0`). Note: folder has no `.git` repository, and `bun`, `java`, `gh`, `vercel` CLIs are not installed locally. Production settings, secrets, Firebase Rules, and sync flags were NOT modified.
- **Stage A Audit & Research Completed:**
  - Audited entire workspace structure (41 React components, 80+ service/test modules, 5 API handlers, `firestore.rules`, `public/sw.js`, `vite.config.ts`, `vercel.json`, `.github/workflows/ci.yml`, `src/index.css`, `src/wird-identity.css`).
  - Researched external providers via live web search: Quran Foundation API v4 (OAuth2 client credentials + granular scopes `content.tafsirs.read`/`content.audio.read`), AlAdhan API (free, no key, ~12 req/s per IP, daily caching required), OpenDua / Seen-Arabic Morning-And-Evening-Adhkar-DB (MIT) / rn0x Adhkar-json (audio + Hisn Al-Muslim), Sunnah.com API (key required via GitHub request), and Ihsan Seerah API (`public.api.ihsandeen.com`) alongside previously audited SeerahBook / Islamic Network / Dorar.
  - Updated canonical docs (`docs/CONTINUE_HERE.md`, `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/engineering/ARCHITECTURE.md`, `docs/engineering/RELEASE_CHECKLIST.md`, `CHANGELOG.md`, and this append-only `WORK_LOG.md`).
- **Phase 1 Implementation Completed:**
  - `index.html`, `public/manifest.json`, `src/tests/pwaIntegration.test.ts`: aligned `theme-color` (`#1C4E46`) and body background/text colors with `wird-identity.css`, and strengthened `pwaIntegration.test.ts` to assert exact `index.html` ↔ `manifest.json` `theme_color` parity.
  - `src/components/dashboard/DashboardView.tsx`: removed duplicate Multi-Khatma section above Welcome Banner.
  - `src/components/library/QuranLibraryView.tsx` & `src/components/library/ReadingKhatmaPanel.tsx`: restored Hero Quran Header Banner + Search Bar above `ReadingKhatmaPanel`; added Juz-range (`QURAN_JUZ_STARTS`) and Surah (`QURAN_PAGE_INDEX`) scope selectors to multi-khatma creation; wired inline `onQuickStartReadingKhatma` into `QuranMushafReader`.
  - `src/components/library/QuranMushafReader.tsx`: derived `isTwoPageSpreadActive` reactively from `printedSpreadContext.isTwoPage`; filtered Undo (`تراجع`) on 2-page spread and batch mark to newly marked pages only; added inline `بدء ختمة قراءة الآن` button when no active khatma exists.
  - `src/components/library/PrintedMushafSpread.tsx`, `src/components/session/MemorizationSessionView.tsx`, `src/index.css`: decoupled `onTafsirAyahChange` from mutating `currentAyahIndex`; preserved active memorization ayah highlight when `autoOpenTafsirOnSelect=false`; added light/dark CSS contrast rules for `[data-session-ayah='true']`; persisted cumulative mastery confirmation synchronously via `saveCumulativeSessionProgress` before `finalizeSessionCompletion()`; scoped `awaitingFinalConfirm` reset cleanly to `currentAyahIndex`.
  - `server.ts` & `src/services/authService.ts`: switched `/api/advisor/chat` to `ai.models.generateContent` with bounded history context; stopped triggering `signInWithRedirect` on `auth/popup-closed-by-user` and `auth/cancelled-popup-request`.
  - `src/tests/sessionStudyUi.test.ts`: added Phase 1 stabilization regression test suite.
- **Verification Executed (after final Phase 1 edit):**
  - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split): **PASS** (`769 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.40s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
  - `npm.cmd run test:firestore-rules`: **BLOCKED** (Java runtime absent locally)
  - `npm.cmd run smoke:server`: **BLOCKED** in Windows sandbox (loopback/spawn boundary); requires unsandboxed or host run
  - Playwright Desktop/Mobile E2E, GitHub CI, Vercel Preview/Production: **NOT EXECUTED** in this Phase 1 local turn.
- **Next Action:** Await user go-ahead to execute **Phase 2 (Visual Identity Reinvention, Semantic Design System & Unified Navigation)**.



## 2026-11-19 — Full Platform Transformation Phase 2: Visual Identity, Vector Emblem, Semantic Design Tokens & Navigation (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace`. No `.git` repository, no production settings/secrets/rules/sync flags touched.
- **Phase 2 Implementation Completed:**
  - `public/favicon.svg`, `src/components/brand/WirdLogo.tsx`, `src/components/brand/WirdAvatar.tsx`: replaced embedded raster JPEG with a pure **Scalable Vector SVG Emblem (`WirdVectorEmblemSvg`)** featuring an 8-pointed Rub el Hizb geometric frame, Mihrab arch with crescent finial, and an illuminated open Mushaf on a traditional Rihal stand across 6 semantic variants (`primary`, `light`, `dark`, `gold`, `monochrome`, `simplified`), while retaining `OFFICIAL_BRAND_EMBLEM_URL` for optional `renderMode="raster"`.
  - `src/components/brand/WirdPattern.tsx`: added `WirdMihrabArch` architectural vector illustration for hero headers and empty states.
  - `src/wird-identity.css`: expanded semantic design tokens (`--wird-hero-gradient`, `--wird-accent-soft`, `--wird-ring`, `--wird-header-glass`), improved dark-mode muted text contrast (`#98adaa`), and added `.wird-hero-surface`, `.wird-section-badge`, `.wird-nav-indicator`, and `.wird-view-enter`.
  - `src/components/layout/Sidebar.tsx` & `src/components/layout/Header.tsx`: added `المستشار القرآني` (`id: 'advisor'`) inside `'المتابعة والمساندة'` before `'الإعدادات'` (preserving `'الإعدادات'` as the final focusable sidebar item for the mobile drawer `Shift+Tab` focus trap), applied `.wird-nav-indicator`, and added contextual section subtitles in `Header.tsx`.
  - `src/components/brand/BrandDesignShowcase.tsx` & `src/tests/pwaIntegration.test.ts`: added the Vector Emblem & Architectural Mihrab gallery to the design showcase and added Phase 2 automated assertions to `pwaIntegration.test.ts`.
- **Verification Executed (after final Phase 2 edit):**
  - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split): **PASS** (`770 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.39s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
  - `npm.cmd run test:firestore-rules`: **BLOCKED** (Java runtime absent locally)
  - Playwright Desktop/Mobile E2E, GitHub CI, Vercel Preview/Production: **NOT EXECUTED** in this Phase 2 local turn.
- **Next Action:** Proceed to **Phase 3 (Unified Data Architecture, Offline Quran Audio Playback in Mushaf/Library, UID-Scoped Khatma/Bookmarks & Revision/Tasmee' Enhancement)**.

## 2026-11-20 — Full Platform Transformation Phase 3: Offline Audio in Mushaf/Library, UID-Scoped Khatmas/Bookmarks & Canonical Weak-Verse Verification (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace`. No `.git` repository, no production settings/secrets/rules/sync flags touched.
- **Phase 3 Implementation Completed:**
  - `src/services/storageService.ts` & `src/services/readingKhatmaService.ts`: added `AUXILIARY_SCOPED_KEYS` (`wird.reading.khatma.v1`, `wird.reading.khatmas.v2`, `wird.quran.pageBookmarks.v1`, `wird.quran.lastPage.v1`, `wird.quran.lastReadingPosition.v1`) and `StorageService.resolveScopedKey(key)` so Reading Khatmas, Mushaf Bookmarks, and Last Reading Positions are isolated per authenticated UID (`user:<uid>`) and migrated on first-account `'import'`.
  - `src/components/library/QuranMushafReader.tsx` & `src/components/library/QuranLibraryView.tsx`: wired `offlineQuranAudioLibrary.resolvePlaybackSource(approvedReciterId, globalAyah, fallbackUrl)` into Mushaf page/segment playback and Library ayah/segment playback with automatic `ObjectURL` revocation and sequence race guards, and passed licensed `cdn.islamic.network` URLs (`getLicensedAyahAudioUrl`) to `requestOfflineAudioCache`.
  - `src/components/revision/RevisionCenterView.tsx`: prioritized verified local Quran corpus text (`loadAyahByCoordinate`) over manual user input when recording weak verses, and added live verified Quran text previews in both the Failed-Revision Rating modal and the Manual Weak-Verse modal.
  - `src/services/readingKhatmaService.test.ts` & `src/tests/pwaIntegration.test.ts`: added automated unit and integration tests for UID-scoped Reading Khatmas and Phase 3 offline audio/bookmark wiring.
- **Verification Executed (after final Phase 3 edit):**
  - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split): **PASS** (`772 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.75s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
  - `npm.cmd run test:firestore-rules`: **BLOCKED** (Java runtime absent locally)
  - Playwright Desktop/Mobile E2E, GitHub CI, Vercel Preview/Production: **NOT EXECUTED** in this Phase 3 local turn.
- **Next Action:** Proceed to **Phase 4 (Complete Daily Adhkar & Duas System with Verified Audio Playback, Counter, Categories & Ruqyah Integration)**.

## 2026-11-20 — Full Platform Transformation Phase 4: Daily Adhkar & Duas System with Verified Audio Playback, Counter & Free Tasbih (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace`. No `.git` repository, no production settings/secrets/rules/sync flags touched.
- **Phase 4 Implementation Completed:**
  - `src/data/adhkarData.ts`: created a verified, sourced, fully vocalized Daily Adhkar & Duas corpus across 8 categories (`morning`, `evening`, `after_prayer`, `sleeping`, `waking_up`, `quranic_duas`, `prophetic_duas`, `istighfar`) plus 5 Free Tasbih presets (`FREE_TASBIH_PRESETS`) and time-of-day category recommendation (`getRecommendedAdhkarCategoryForHour`).
  - `src/services/adhkarProgressService.ts` & `src/services/storageService.ts`: implemented UID-scoped persistence (`wird.adhkar.progress.v1`) for daily item repetition counts, category completion summaries, favorite Adhkar, and the cumulative Free Tasbih counter.
  - `src/components/adhkar/AdhkarView.tsx`: built the lazy-loaded Daily Adhkar & Duas workspace resolving verified local Quran chunks (`loadSurahVerses`) and local-first offline audio playback (`offlineQuranAudioLibrary.resolvePlaybackSource`) for all Quranic Adhkar/Duas, interactive tap-to-count cards with auto-advance, search/favorites/audio filters, Free Tasbih counter, and cross-navigation to Ruqyah (`#/ruqyah`).
  - `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`, `src/components/dashboard/DashboardView.tsx`: registered `'adhkar'` (`الأذكار والأدعية`) in navigation (before `'الإعدادات'`), routing, lazy-loaded chunks, and dashboard quick actions.
  - `src/tests/adhkarSystem.test.ts` & `src/tests/runAllTests.ts`: added automated test suite verifying all 8 categories, Quranic coordinate bounds, UID-scoped counters/favorites/Tasbih, and offline audio integration.
- **Verification Executed (after final Phase 4 edit):**
  - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split): **PASS** (`776 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.88s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
  - `npm.cmd run test:firestore-rules`: **BLOCKED** (Java runtime absent locally)
  - Playwright Desktop/Mobile E2E, GitHub CI, Vercel Preview/Production: **NOT EXECUTED** in this Phase 4 local turn.
- **Next Action:** Proceed to **Phase 5 (Complete Chronological Sourced Prophetic Seerah Experience)**.


## 2026-11-20 — Full Platform Transformation Phase 5: Complete Chronological Sourced Prophetic Seerah Experience (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace`. No `.git` repository, no production settings/secrets/rules/sync flags touched.
- **Phase 5 Implementation Completed:**
  - `src/data/seerahData.ts`: created a versioned (`SEERAH_BOOK_VERSION = '1.0.0'`), chronological Prophetic Seerah book spanning 5 chronological parts (`SEERAH_PARTS`) and 16 doubly-linked narrative chapters (`SEERAH_CHAPTERS`) from pre-birth Makkah through birth, youth, revelation in Hira, public call & Abyssinia, Year of Sorrow & Isra/Mi'raj, Aqabah pledges, Hijrah, Madinah foundation, Badr, Uhud & Khandaq, Hudaybiyyah & letters to kings, Fath Makkah, Farewell Pilgrimage, passing to Al-Rafiq Al-A'la, and Shamail/character — with 17 claim-level records (`SEERAH_CLAIMS`), 7 public-domain classical sources (`SEERAH_SOURCES`), evidence grades (`ثابت بالصحيح` / `مشهور في السير` / `محل خلاف تاريخي`), and explicit uncertainty notes.
  - `src/services/seerahProgressService.ts` & `src/services/storageService.ts`: implemented UID-scoped persistence (`wird.seerah.progress.v1`) for reading mode (`continuous` vs `study`), last reading position, completed chapters, and versioned scene bookmarks, completely isolated from Quran memorization/khatma statistics.
  - `src/components/seerah/SeerahView.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`, `src/components/dashboard/DashboardView.tsx`: built the lazy-loaded `#/seerah` continuous narrative book reader with pure-reading vs verification mode toggle, parts/timeline index, figures/places/sources directory, bookmarks tab, and optional end-of-chapter comprehension quiz.
  - `src/tests/seerahSystem.test.ts` & `src/tests/runAllTests.ts`: added automated test suite verifying the 5-part / 16-chapter chain, claim/source/figure/place integrity, uncertainty notes, and UID-scoped progress/bookmarks.
- **Verification Executed (after final Phase 5 edit):**
  - `npm.cmd run test`: **PASS** (`781 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.34s`, `SeerahView` code-split into `dist/assets/SeerahView-ClcVHDEl.js` at `116.19 kB` / `28.18 kB` gzip, 0 chunks > 500 kB)
- **Next Action:** Proceed to **Phase 6 (Offline-First Hardening & Prayer Times / Hijri Calendar / Qibla via AlAdhan Adapter)**.

## 2026-11-20 — Full Platform Transformation Phase 6: Offline-First Hardening & Prayer Times / Hijri Calendar / Qibla Adapter (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace`. No `.git` repository, no production settings/secrets/rules/sync flags touched.
- **Phase 6 Implementation Completed:**
  - `src/services/offlineQuranAudioLibrary.ts` & `src/services/offlineQuranAudioLibrary.test.ts`: added per-job cross-tab exclusive worker locks (`wird-offline-audio-job-worker:${jobId}`) around `executeJobWorker(jobId)` in `startOrResumeJob(jobId)`, displaced generation cleanup on re-verification in `markJobItemVerified`, and unindexed Cache Storage orphan key sweeping via `cache.keys()` during `reconcileLibrary()`.
  - `src/services/prayerTimesService.ts`, `src/services/prayerTimesService.test.ts`, `src/services/storageService.ts`, `src/components/dashboard/DashboardView.tsx`: built the AlAdhan API adapter (`fetchDailyPrayerSchedule`) with 4500ms timeout, `redirect: 'error'`, strict `HH:MM` sanitization, UID-scoped daily cache (`wird.prayer.cache.v1`), mathematical Great-Circle Qibla bearing calculation (`computeQiblaBearingDegrees`) to the Holy Kaaba (`21.422487° N, 39.826206° E`), offline Umm al-Qura Hijri date formatting (`formatLocalHijriDate`), next-prayer countdown (`getNextPrayerSummary`), and interactive Dashboard Prayer/Hijri/Qibla card across 8 city presets.
- **Verification Executed (after final Phase 6 edit):**
  - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split): **PASS** (`788 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.17s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
  - `npm.cmd run test:firestore-rules`: **BLOCKED** (Java runtime absent locally)
  - Playwright Desktop/Mobile E2E, GitHub CI, Vercel Preview/Production: **NOT EXECUTED** in this Phase 6 local turn.
- **Next Action:** Proceed to **Phase 7 (Bidirectional Multi-Device Synchronization with Tombstones, Anti-Resurrection & Event-Derived Projections)**.

## 2026-11-20 — Full Platform Transformation Phase 7 & Phase 8: Multi-Device Tombstones, Anti-Resurrection, Weak-Verse Delta Convergence & Final Quality Audit (Local Windows Workspace)

- **Environment:** Local Windows workspace `local WIRD-APP workspace`. No `.git` repository, no production settings/secrets/rules/sync flags touched.
- **Phase 7 Implementation Completed:**
  - `src/services/tombstoneReconciliationService.ts`, `src/services/syncConflictSafety.ts`, `src/services/tombstoneReconciliationService.test.ts`, `src/tests/runAllTests.ts`: implemented `CollectionTombstoneRecordV2`, `reconcileRecordsWithTombstones` (clock-independent revision comparison, anti-resurrection suppression when `revision <= deletedAtRevision`, explicit restore superseding tombstones at `revision > deletedAtRevision`, and fail-closed `concurrent_divergent_edit` conflict descriptors), `reconcileWeakVerseSnapshotsV2` (per-device mistake delta convergence + resolved-at-revision anti-resurrection), and `isSafeV2ReconcilablePayload` (while preserving fail-closed `containsUnsafeFullSnapshotProjection` for V1 full snapshots).
- **Phase 8 Final Quality Audit & Local Verification Executed:**
  - `npm.cmd run test` (incl. `pretest` Tanzil Simple validation + 114 Surah chunk split across all 72 suites): **PASS** (`794 PASSED | 0 FAILED`)
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - Production Vite build (`NODE_ENV=production` + `vite build`): **PASS** (`2.34s`, 0 chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
  - `npm.cmd run test:firestore-rules`: **BLOCKED** (Java runtime absent locally)
  - `npm.cmd run mushaf:validate-coverage`: **BLOCKED** in sandbox (script fetches remote SVG pages over network; local 604-page Mushaf index & 6,236 ayah coverage verified offline in `runQuranIntegrityTests`, `runQuranMushafReaderTests`, and `runMushafFacsimileServiceTests`)
  - Playwright Desktop/Mobile E2E, GitHub CI, Vercel Preview/Production: **NOT EXECUTED** in this local turn (no `.git` repo in folder; Production sync flags untouched).
- **Next Action:** Connect local workspace to `.git` feature branch when ready to push for GitHub Actions Quality Gate (Firestore Rules Emulator + Playwright E2E) and Vercel Preview inspection.

## 2026-11-20 — Draft PR #404 Release Readiness Fixes (Primary-Source Religious Accuracy, Backward-Compatible Adhkar ID, Cache-Only Storage UX)

- **Repository & PR:** `ifawz40-boop/WIRD-APP`, Draft PR `#404` (`feat/platform-transformation-20261120` → `main` `61554d60da5a5bbb644f6698d7b6193068a4d70a`), building on CI-passing head `bcbf26fecaa293da257473d780c9459b5b119ebf` (Run `44672654181`: 100% PASS).
- **Changes Applied (Single Release-Readiness Commit):**
  - `src/data/adhkarData.ts`: Fixed sleeping category typo (`عندوي` → `عند الإيواء`); restricted `adhkar-kalimat-tammat` to `['evening']` with exact source separation (Sahih Muslim 2708 & 2709, Sunan al-Tirmidhi 3604, Musnad Ahmad 7898); added `repeatTargetByCategory: { after_prayer: 1 }` and `getAdhkarRepeatTarget(item, category?)` for `adhkar-ikhlas`, `adhkar-falaq`, and `adhkar-nas` (`3×` in morning/evening/sleep per Abu Dawud 5082, Tirmidhi 3575, Bukhari 5017; `1×` after obligatory prayers per Abu Dawud 1523, Nasai 1336, Tirmidhi 2903, noting Fajr/Maghrib 3× overlap with morning/evening adhkar); renamed `adhkar-sleep-bismika-ربي-wadatu` → `adhkar-sleep-bismika-rabbi-wadatu` with `LEGACY_ADHKAR_ITEM_ID_ALIASES`.
  - `src/services/adhkarProgressService.ts` & `src/components/adhkar/AdhkarView.tsx`: Normalized legacy Adhkar item IDs losslessly on read and mutation (`normalizeAdhkarItemId`), wired category-aware `getAdhkarRepeatTarget` into daily counter, category summaries, auto-advance, and UI progress indicators without downgrading higher-target counts.
  - `src/data/seerahData.ts`: Fixed `كماخلّده` → `كما خلّده` (`blk-1-1-b`); added `src-musnad-ahmad` and `src-muwatta-malik` to `SEERAH_SOURCES`; distinguished Badr consultation speakers and primary sources in `blk-10-1-a` (Al-Miqdad in Bukhari 3952, Sa'd ibn Ubadah in Muslim 1779, Sa'd ibn Mu'adh in Ibn Hisham); separated Farewell Pilgrimage wordings in `blk-14-1-a` (Sahih Muslim 1218 verbatim «كتاب الله», Bukhari 67/1739, Muslim 1679) and `blk-14-1-c` (Muwatta Malik balagh «كتاب الله وسنة نبيه» and Musnad Ahmad 23489 Tashriq equality wording — zero misattribution to Sahihayn).
  - `src/services/storageService.ts`: Exported `CACHE_ONLY_AUXILIARY_KEYS` (`wird.prayer.cache.v1`) and shared `isLegacyUserDataKey(key)` across `hasLegacyStorageData()` and `setStorageScope()` so automatic Dashboard prayer cache alone never triggers a false guest-data import prompt while remaining UID-scoped, migrated on real-data `'import'`, and cleared on `resetAllData()`.
  - `src/tests/adhkarSystem.test.ts`, `src/tests/seerahSystem.test.ts`, `src/services/storageScope.test.ts`: Added 6 automated regression tests covering every fix above.
- **Verification Executed (Local Windows Workspace):**
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - `npm.cmd run test`: **PASS** (`800 PASSED | 0 FAILED`)
  - `$env:NODE_ENV='production'; npx.cmd vite build`: **PASS** (`3.27s`)
  - `npx.cmd --yes bun@1.4.4 install --frozen-lockfile`: **PASS** (`Checked 304 installs across 371 packages`)
  - `npx.cmd --yes bun@1.4.4 audit --audit-level=high`: **PASS** (`No vulnerabilities found (checked 360 packages)`)
- **Production & Safety Confirmation:** ZERO edits to Quran corpus (`completeQuranData.json`, `src/data/sources/`), sync engine, `firestore.rules`, `authService.ts`, Vercel/Firebase settings, secrets, feature flags, or `main`. Exact-head CI (`WIRD Quality Gate`) triggered on push to PR `#404`.

## 2026-11-22 — Four-Variant Design Integration (Design A & Design B × Light / Dark) & Global Token Harmonization (AI Studio Workspace)

- **Environment:** Google AI Studio container workspace (no `.git` directory; production settings, Firebase Rules, Vercel env vars, and sync feature flags untouched).
- **Decisions & Scope Implemented:**
  - Two independent preferences (`design`: `'design-a' | 'design-b'`, default `'design-a'` Andalusian Heritage; `appearanceMode`: `'light' | 'dark'`, default `'light'`), unified collapsible right sidebar (`Sidebar.tsx`), and exposure of the selector in both `SettingsView.tsx` and header `ThemeCustomizerSheet.tsx` with legacy stored preset migration (`mapLegacyPresetToDesign`).
- **Key Files Changed:**
  - `src/services/themePreferences.ts` & `src/main.tsx`: 2×2 design/appearance model (`schemaVersion: 3`), independent persistence (`wird:ui-theme-prefs:v2`, `wird:ui-appearance-mode:v1`), `resetThemePreferences()`, reference preview/emblem mappings (`/public/assets/aistudio/`), pre-mount DOM attribute + `.dark` class + `<meta name="theme-color">` application.
  - `src/wird-identity.css`: high-specificity `:root[data-wird-design='design-a'|'design-b']` and `:root.dark[data-wird-design='design-a'|'design-b']` CSS token cascades (`--wird-bg`, `--wird-surface`, `--wird-surface-muted`, `--wird-primary`, `--wird-primary-ink`, `--wird-accent`, `--wird-accent-ink`, `--wird-sidebar-bg`, `--wird-mushaf-paper`, subtle shell gradients).
  - `src/components/ui/AppearanceSelectorPanel.tsx`, `src/components/ui/ThemeCustomizerSheet.tsx`, `src/components/settings/SettingsView.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/auth/AuthScreen.tsx`, `src/components/brand/BrandDesignShowcase.tsx`, `src/App.tsx`: reusable reference-backed Appearance Selector, header `A`/`B` trigger badge, Auth quick switcher, and showcase preview updates.
  - Token & dark-mode contrast harmonization across 18 feature/shared components (`AuthScreen`, `AuthGate`, `SettingsView`, `AdhkarView`, `RuqyahView`, `RuqyahApiLibrary`, `SeerahView`, `QuranAdvisorView`, `QuranLibraryView`, `TafsirSheet`, `HorizontalScrollRail`, `DisplaySettingsMenu`, `OfflineStatusControls`, `RelatedHadithPanel`, `SurahPickerControl`, `AudioPlaybackRateControl`, `DirectOptionGroup`, `RouteErrorBoundary`, `WirdPrimitives`, `WirdLogo`) + 81 `dark:text-[var(--wird-accent)]` contrast pairings across 15 components + compact `DashboardView.tsx` welcome hero spacing + `src/tests/designSystemV2.test.ts`.
- **Verification Executed (after final implementation edits):**
  - `npm test` (73 suites incl. `designSystemV2.test.ts`, Tanzil validation & 114 Surah chunk split): **PASS** (`806 PASSED | 0 FAILED`)
  - `npm run smoke:api-imports`: **PASS**
  - Legacy hex grep across `src/components` (excluding `brand/`, `QuranMushafFacsimilePage.tsx`, `QuranTypographyLab.tsx`): **PASS** (`NO_LEGACY_HEX_FOUND`)
  - Headless Chromium visual verification (`1440x900` desktop & `390x844` mobile on `http://127.0.0.1:3000`): **PASS** (`rgb(255, 249, 236)` A-Light, `rgb(4, 22, 16)` A-Dark, `rgb(249, 251, 250)` B-Light, `rgb(8, 18, 30)` B-Dark, `overflowX: false`, `0` page/console errors; final dark screenshots visually verified).
  - `compile_applet` & `lint_applet`: executed on final workspace pass.
  - `npm run test:firestore-rules`: **BLOCKED** locally (`java` runtime absent).
  - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** from AI Studio.

## 2026-11-23 — Extensible Video Series Platform & Daily Dashboard Video Suggestion (AI Studio Workspace)

- **Environment:** Google AI Studio container workspace (no `.git` directory; production settings, Firebase Rules, Vercel env vars, Quran corpus, and sync feature flags untouched).
- **Owner Request & Scope Implemented:**
  - Built an extensible multi-series video library architecture seeded with the requested YouTube playlist **«سلسلة بناء النفس المطمئنة» — م. علاء حامد** (`https://youtube.com/playlist?list=PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5`, 13 verified episodes, `16 ساعة و 15 دقيقة`), surfacing a daily suggested lesson on the Dashboard (`#dashboard-daily-series`) with watch-status completion tracking (`unwatched` / `in_progress` / `completed`), full episode browser (`#/series`), personal notes, and future-ready YouTube playlist import for adding unlimited new series.
- **Key Files Created / Changed:**
  - `src/data/videoSeriesCatalog.ts`: multi-series schema (`VideoSeriesDefinition`, `VideoLessonItem`, `VideoSeriesCategory`), 13 verified episodes of `BINA_AL_NAFS_SERIES`, safe YouTube video/playlist ID & URL validators, and `youtube-nocookie.com` embed helpers.
  - `src/services/videoSeriesService.ts` & `src/services/storageService.ts`: UID-scoped key `'wird.video.series.v1'` in `AUXILIARY_SCOPED_KEYS`, deterministic daily suggestion picker + manual skip (`getDailySuggestedLesson`, `advanceDailySuggestedLesson`), per-lesson watch status & notes persistence, featured-series selector, and custom multi-series registration/removal.
  - `api/youtube-playlist.ts`, `server.ts`, `scripts/smoke-api-imports.mjs`: read-only SSRF-safe `/api/youtube-playlist?list=...` resolver strictly validating playlist IDs and querying hardcoded `https://www.youtube.com` endpoints with timeout & rate limiting.
  - `src/components/series/DailyVideoSuggestionCard.tsx`, `src/components/series/VideoSeriesView.tsx`, `src/components/dashboard/DashboardView.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/services/router.ts`, `src/App.tsx`: Dashboard daily video card, lazy-loaded `#/series` multi-series workspace with full episode checklist, filters, inline player, notes, and «إضافة سلسلة جديدة» sheet, plus deep-linking (`#/series?series=...&video=...`) and Sidebar navigation before `الإعدادات`.
  - `src/tests/videoSeriesSystem.test.ts` & `src/tests/runAllTests.ts`: 6 automated tests covering the 13-episode catalog, URL/ID security validation, UID-scoped watch tracking & notes, daily suggestion rotation/skip, multi-series registration/cleanup, router deep-linking, and `/api/youtube-playlist` invalid-input rejection.
- **Verification Executed (after final edits):**
  - `npm test` (74 suites incl. `videoSeriesSystem.test.ts`, Tanzil validation & 114 Surah chunk split): **PASS** (`812 PASSED | 0 FAILED`)
  - `npm run smoke:api-imports`: **PASS**
  - Live `GET /api/youtube-playlist` on `http://127.0.0.1:3000`: **PASS** (`200` with `13` videos for `PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5`; `400` for `../evil`)
  - Legacy hex grep across `src/components/series`: **PASS** (`NO_LEGACY_HEX_FOUND`)
  - Headless Chromium visual & interaction verification (`1440x900` Light/Dark & `390x844` Dark on `http://127.0.0.1:3000`): **PASS** (`#dashboard-daily-series` visible, deep-link `#/series?series=bina-al-nafs-al-mutmainnah&video=HVNcSAD8xKs`, Add Series sheet verified, `OVERFLOW_X: false`, `CONSOLE_ERRORS: []`, `PAGE_ERRORS: []`, temporary `.verify-shots` cleaned up)
  - `compile_applet` & `lint_applet`: executed on final workspace pass.
  - `npm run test:firestore-rules`: **BLOCKED** locally (`java` runtime absent).
  - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** from AI Studio.

## 2026-11-25 — Comprehensive Hisn al-Muslim Adhkar & Duas Encyclopedia Redesign, Separated Workspace & Circular Countdown Counter (AI Studio Workspace)

- **Environment:** Google AI Studio container workspace (no `.git` directory; production settings, Firebase Rules, Vercel env vars, Quran corpus, and sync feature flags untouched).
- **Owner Request & Confirmed Design Scope:**
  - Expanded and redesigned `#/adhkar` to match specialized Islamic Adhkar sites (referenced pattern: IslamBook) with full Hisn al-Muslim coverage (**18 categories, 156 verified, vocalized, primary-sourced items**), separated top-level workspace tabs (**Adhkar Directory**, **Authenticated Duas**, **Standalone Electronic Tasbih Studio**, **Favorites**), a prominent **SVG Circular Countdown Counter** triggered by tapping either the card body or ring, and persisted reader ergonomics (**4-level font-size stepper** + **show/hide virtue & primary source toggle**).
- **Key Files Created / Changed:**
  - `src/data/adhkarCorpusOccasions.ts` *(new)* & `src/data/adhkarCorpusDuas.ts` *(new)* & `src/data/adhkarData.ts`: expanded to 18 categories (`daily_adhkar` 6, `occasion_adhkar` 9, `duas` 3), 156 items, and 8 `FREE_TASBIH_PRESETS`; preserved all legacy `adhkar-*` IDs, `LEGACY_ADHKAR_ITEM_ID_ALIASES`, Quranic ayah coordinates, `adhkar-kalimat-tammat` placement (`evening` 3× & `travel` 1×, never `morning`), and category-specific Mu'awwidhat targets (`1×` after prayer vs `3×` morning/evening/sleep).
  - `src/services/adhkarProgressService.ts`: preserved UID-scoped `'wird.adhkar.progress.v1'` (`schemaVersion: 1`), added persisted `readingPrefs` (`fontScale`: `sm|md|lg|xl`, `showVirtueAndSource`, `autoAdvance`), `getAdhkarRemainingCount()`, `updateAdhkarReadingPrefs()`, `setFreeTasbihTarget()` (incl. `0` unlimited mode), and `getOverallDailyAdhkarSummary()`.
  - `src/components/adhkar/CircularCountdownRing.tsx` *(new)*, `src/components/adhkar/TasbihStudioPanel.tsx` *(new)*, `src/components/adhkar/AdhkarCard.tsx` *(new)*, `src/components/adhkar/AdhkarView.tsx`: modularized the Adhkar UI into 4 separated tabs (2×2 responsive grid on mobile), category card hub directory, global search, focused category reader (`← الفهرس`), interactive circular countdown ring (`target → ... → 1 → 0`), standalone Tasbih studio (`LargeTasbihRing` + cycle target selector), persisted reading toolbar, and preserved verified local Quran chunks (`loadSurahVerses`) + offline-first audio playback (`offlineQuranAudioLibrary` + `globalAudioCoordinator`).
  - `src/tests/adhkarSystem.test.ts`: expanded automated verification across all 18 categories, 115+ corpus floor, Quranic ayah bounds vs `ALL_SURAHS`, primary-source placement & category targets, countdown math, reading prefs persistence, unlimited Tasbih target, UID isolation, legacy alias migration, and `AdhkarView`/`AdhkarCard` integration.
- **Verification Executed (after final polish edits):**
  - `npm test` (74 suites incl. `adhkarSystem.test.ts`, `designSystemV2.test.ts`, Tanzil validation & 114 Surah chunk split): **PASS** (`812 PASSED | 0 FAILED`)
  - `npm run smoke:api-imports`: **PASS**
  - Legacy hex grep across `src/components/adhkar`: **PASS** (`NO_LEGACY_HEX_FOUND`)
  - Headless Chromium visual & interaction verification (`1440x900` Light/Dark & `390x844` mobile Dark on `http://127.0.0.1:3000/#/adhkar`): **PASS** (Hub directory, 4 separated tabs, Morning Adhkar focused reader `24` cards, circular countdown tap `3 → 2`, font stepper, virtue/source hide/restore toggle, Duas 3 categories, Tasbih `LargeTasbihRing` track & tap count, mobile 2×2 tabs & stacked reader header, `overflowX: false`, `0` page/console errors; temporary `.verify-shots` cleaned up)
  - `compile_applet` & `lint_applet`: executed on final workspace pass.
  - `npm run test:firestore-rules`: **BLOCKED** locally (`java` runtime absent).
  - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** from AI Studio.

## 2026-11-25 — Comprehensive Ruqyah Shar'iyyah Overhaul & Timed Audio Ruqyah Studio (AI Studio Workspace)

- **Environment:** Google AI Studio container workspace (no `.git` directory; production settings, Firebase Rules, Vercel env vars, Quran corpus, `ruqyahProgressSchema.ts`, and sync feature flags untouched).
- **Owner Request & Scope Implemented:**
  - Overhauled `#/ruqyah` to match the redesigned `#/adhkar` architecture (separated tabs, category card hub, interactive circular SVG counter ring, reading controls) and added **«الرقية المسموعة» (`AudioRuqyahStudio`)** offering **5 curated timed audio Ruqyah sessions** (~3m, ~6m, ~12m, ~20m, ~30m) composed strictly from verified local Quranic Ruqyah verses played via WIRD's 7 approved reciters.
- **Key Files Created / Changed:**
  - `src/data/ruqyahData.ts`: expanded to 9 categories (`brief`, `medium`, `full`, `eye_envy`, `illness`, `magic_protection`, `children_home`, `anxiety_sleep`, `guidelines`) with `RUQYAH_CATEGORIES` metadata, **44 verified items** (28 canonical Quran passages + 16 authenticated Prophetic duas), **6 verified guidelines**, and **5 timed `AUDIO_RUQYAH_SESSIONS`**. Preserved `RUQYAH_PROGRAM_AUDIO` (`audioUrl: ''`) and strict Hadith count discipline (`repeatTarget: null` unless a fixed number is narrated).
  - `src/services/ruqyahContentService.ts`: preserved exact `getRuqyahAudioQueueForItems()` output shape and strict lazy-loading runtime-import invariant (imports only `loadSurahVerses` and `ALL_SURAHS` at runtime, zero `new Map(` caches); added `estimateRuqyahSessionStats(session, items)` and `buildAudioRuqyahSessionQueue(session, items)` supporting explicit Mu'awwidhat 3× repetitions and `passageStartIndices`.
  - `src/components/ruqyah/RuqyahCountdownRing.tsx` *(new)*: 80×80px interactive SVG circular ring supporting countdown (`target → 0`) for narrated fixed counts and upward counting for open counts (`repeatTarget === null`), preserving exact accessible `status`/`aria-label` contracts.
  - `src/components/ruqyah/AudioRuqyahStudio.tsx` *(new)*: dedicated studio UI with 5 timed session cards, reciter selector (`FALLBACK_QURAN_RECITERS`), playback speed (`0.75×/1×/1.25×`), live synced canonical `QuranText` ayah display, prev/play-pause/next/stop controls, continuous loop toggle, Sleep Timer (`إيقاف / 15 / 30 / 45 / 60 د`) with live countdown, LTR time clock + seek/volume sliders, collapsible interactive tracklist, and honest provenance note.
  - `src/components/ruqyah/RuqyahView.tsx`: re-architected into 4 separated tabs (`القراءة والعداد`, `الرقية المسموعة`, `آداب وإرشادات`, `المكتبة الموسعة`), context-aware Hero CTA, 8-card Category Hub Grid (`min-h-12`, `aria-pressed`), Reading Controls Toolbar (`أ-`/`أ+`, persisted `إخفاء/إظهار البيان والتخريج`, internal search, auto-advance, accessible reset confirmation), and single managed HTML `<audio>` instance shared across all playback modes (`ruqyahViewAudioLock.test.ts` preserved).
  - `src/tests/ruqyahIntegrity.test.ts` & `src/services/ruqyahContentService.test.ts`: updated reviewed source registry (6 guidelines + 44 items), fixed-count verification, 9-category filters, 28 Quran coordinate regressions, and added unit tests covering all 5 `AUDIO_RUQYAH_SESSIONS`, `estimateRuqyahSessionStats`, and `buildAudioRuqyahSessionQueue`.
- **Verification Executed (after final polish edits):**
  - `npm test` (74 suites incl. `ruqyahIntegrity.test.ts`, `ruqyahContentService.test.ts`, `ruqyahViewAudioLock.test.ts`, `quranLazyLoading.test.ts`, `designSystemV2.test.ts`, Tanzil validation & 114 Surah chunk split): **PASS** (`814 PASSED | 0 FAILED`)
  - `npm run smoke:api-imports`: **PASS**
  - Legacy hex grep across `src/components/ruqyah`: **PASS** (`NO_LEGACY_HEX_FOUND`)
  - Headless Chromium visual & interaction verification (`1440x900` Light/Dark & `390x844` mobile Dark on `http://127.0.0.1:3000/#/ruqyah`, 2 rounds incl. polish of trailing `۞`, LTR audio clock, and context-aware hero CTA): **PASS** (`overflowX: false` across desktop & mobile, `0` console/page errors; temporary `.verify-shots` cleaned up)
  - `compile_applet` & `lint_applet`: executed on final workspace pass.
  - `npm run test:firestore-rules`: **BLOCKED** locally (`java` runtime absent).
  - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** from AI Studio.




## 2026-11-24 — Full 4-Volume Ibn Kathir Prophetic Seerah Encyclopedia (`feat/seerah-encyclopedia-ibn-kathir`)

- **Repository & Branch:** `ifawz40-boop/WIRD-APP`, feature branch `feat/seerah-encyclopedia-ibn-kathir` branched from `main` @ `45f3edc611be08482d53570afd49f6e9471f44c7`. Production settings, `firestore.rules`, Quran corpus (`completeQuranData.json`, `src/data/sources/`), `bun.lock`, Vercel env vars, and sync flags untouched.
- **Source Analysis & Open-Source Decision:**
  - Inspected owner-supplied PDFs in gitignored `seerah-sources/` (`01_10169_compressed.pdf` 536p, `02_10170_compressed.pdf` 564p, `03_10171_compressed.pdf` 732p, `04_10172_compressed.pdf` 734p = 2,566 scanned pages with `0` embedded text characters) and confirmed identity as *Al-Sīra al-Nabawiyya* by Imam Ibn Kathir (d. 774 AH).
  - Benchmarked local Windows `ar-SA` OCR on sample pages and rejected it due to severe text corruption unsuitable for religious/historical text.
  - Verified exact volume-for-volume and page-for-page alignment against OpenITI (`OpenITI/0775AH`: `0774IbnKathir.Bidaya.Shamela0000930-ara6`, WorldCat `oclc/235980396`), excluding the modern 1964 editor preface (`تقديم مصطفى عبد الواحد`) and keeping only Ibn Kathir's authentic public-domain matn starting at `ذكر أخبار العرب` (Vol 1 p. 1). Recorded OpenITI CC BY-NC-SA 4.0 attribution and non-commercial review note in `docs/OWNER_ACTIONS.md` and `docs/engineering/OPEN_SOURCE_RESEARCH.md`.
- **Key Files Created / Changed:**
  - `docs/seerah/MASTER_DIRECTIVE.md` & `docs/seerah/EXECUTION_STATUS.md`: complete Seerah Encyclopedia directive, architecture, acceptance criteria, and live phase tracker.
  - `scripts/build-seerah-encyclopedia.py` & `scripts/validate-seerah-encyclopedia.mjs`: deterministic corpus generator and pure-Node CI validator.
  - `public/data/seerah-encyclopedia/` (`manifest.json`, `toc.json`, `chunks/vol-*-chunk-*.json`, `search/vol-*-search.json`): 4 volumes, 2,475 printed pages, 90 chronological sections, 101 reading chunks (`5.02 MB`, max `57.5 KB`/chunk), 4 normalized Arabic full-text search indexes (`5.94 MB`), 567,856 words, and 16 curated chapter cross-links.
  - `src/services/seerahEncyclopediaService.ts`, `src/services/storageService.ts` (`wird.seerah.encyclopedia.v1` in `AUXILIARY_SCOPED_KEYS`), `public/sw.js` (Cache-First `/data/seerah-encyclopedia/*.json` in `wird-app-content-v1`).
  - `src/components/seerah/SeerahEncyclopediaReader.tsx` & `src/components/seerah/SeerahView.tsx`: 4-volume reader, full-text Arabic search across 2,475 pages, direct printed-page jump (`ج X · ص Y`), typography & focus controls, optional per-volume offline caching, page bookmarks + personal notes, deep-links from all 16 curated chapters, and unified Bookmarks tab using pure `--wird-*` semantic CSS tokens.
  - `src/tests/seerahEncyclopedia.test.ts`, `src/tests/runAllTests.ts`, `e2e/seerah-encyclopedia.spec.ts`: unit, integration, UID isolation, token hygiene, and desktop/mobile Playwright E2E coverage.
  - Canonical docs reconciled: `docs/CONTINUE_HERE.md`, `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/engineering/OPEN_SOURCE_RESEARCH.md`, `docs/OWNER_ACTIONS.md`, `docs/README.md`.
- **Verification Executed (2026-11-24):**
  - `node scripts/validate-seerah-encyclopedia.mjs`: **PASS**
  - `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
  - `npm.cmd test` (75 suites): **PASS** (`822 PASSED | 0 FAILED`)
  - `npm.cmd run smoke:api-imports`: **PASS**
  - `NODE_ENV=production` + `vite build`: **PASS** (`2.82s`, `SeerahView` `162.65 kB` / `38.21 kB` gzip, `index` `245.92 kB`, 0 chunks > 500 kB)
  - `node scripts/smoke-server.mjs`: **PASS** (production `4179` + dev `4180`)
  - Playwright E2E (`e2e/seerah-encyclopedia.spec.ts`, Edge Chromium Desktop `1440×900` & Mobile `390×844`): **PASS** (`4 passed | 0 failed`, `35.6s`, zero `pageerror`, zero `overflowX`)
  - Legacy hex scan on `src/components/seerah/*.tsx`: **PASS** (`0` matches)
  - `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched).
  - GitHub CI / Vercel Preview / Vercel Production: **NOT EXECUTED** (local feature branch only pending owner authorization).
- **Unresolved Risks & Next Action:**
  - OpenITI transcription is licensed `CC BY-NC-SA 4.0` (recorded in `docs/OWNER_ACTIONS.md` for non-commercial compliance / future commercial exit).
  - Next action: Owner-authorized PR push for `feat/seerah-encyclopedia-ibn-kathir` to run exact-head GitHub Actions Quality Gate (including Java Firestore Emulator) and Vercel Preview review before merge.


---

## 2026-11-25 — Complete Prophetic Seerah Digital Book & Character Storytelling Transformation (`feat/seerah-encyclopedia-ibn-kathir`)

### Scope & Directive Compliance
- Executed all 10 phases and satisfied all 17 acceptance criteria of `docs/seerah/MASTER_DIRECTIVE.md` (verified 100% unmodified: `20,130` bytes, SHA-256 `7a1e25cf667fa62d6dccd268237ddaf32a128d3cc53d7704e2776af68a8d1472`) on feature branch `feat/seerah-encyclopedia-ibn-kathir`.
- **Phase 1 & Phase 2 (`research/`):** Built complete research repository tracking `2,566 / 2,566` PDF pages across all 4 volumes (`2,475` verified matn pages + `91` classified non-matn apparatus pages), `90` major events, `120` sub-events, `32` characters, `26` places, `22` classical sources, `50/50` verbatim Quranic passages, `43/43` verbatim Hadiths (`100%` verified substrings in Ibn Kathir), `18` historical disputes, and the chronological hierarchy (`6` eras → `12` sections → `40` chapters → `120` scenes + `32` bidirectionally linked characters).
- **Phases 3, 4 & 5 (`research/authored_chapters/`, `research/authored_characters/`, `public/data/seerah/`):** Authored all `40 / 40` third-person Arabic historical chapters (`53,280` words) and all `32 / 32` independent continuous character stories (`26,400` words) = `79,680` words. Passed every chapter and character through independent Review A (Historical Accuracy), Review B (Arabic Writing Quality), and Review C (Deterministic byte-for-byte Quran & Hadith verification via `scripts/phase5_quotation_verify_and_publish.py`: `52` Quran blocks + `43` Hadith blocks verified, `0` unverified `﴿ ﴾` in prose), publishing lazy-loaded static JSON under `public/data/seerah/`.
- **Phases 6, 7, 8 & 10 (`src/components/seerah/`, `src/services/seerahBookService.ts`, `src/services/storageService.ts`, `src/services/router.ts`, `public/sw.js`):** Replaced `SeerahView.tsx` with `SeerahBookLanding.tsx`, `SeerahChapterReader.tsx`, and `SeerahCharacterViews.tsx` (`0` legacy hex leaks); registered `'wird.seerah.v2'` in `AUXILIARY_SCOPED_KEYS` for Guest & UID-scoped progress; updated `public/sw.js` for Cache-First `/data/seerah/*.json`; removed obsolete Seerah files (`seerahData.ts`, `seerahProgressService.ts`, `seerahEncyclopediaService.ts`, `SeerahEncyclopediaReader.tsx`, `seerahSystem.test.ts`, `seerahEncyclopedia.test.ts`, `e2e/seerah-encyclopedia.spec.ts`, `scripts/validate-seerah-encyclopedia.mjs`, and `public/data/seerah-encyclopedia/`) with `0` dangling references.

### Verification Executed (2026-11-25, local branch `feat/seerah-encyclopedia-ibn-kathir`)
- `node scripts/verify_seerah_content.mjs`: **PASS** (`6` eras, `12` sections, `40` chapters, `32` characters, `52` verbatim Quran blocks, `43` verbatim Hadith blocks, 100% bidirectional links)
- `npm.cmd run lint` (`tsc --noEmit`): **PASS** (`0` errors)
- `npm.cmd test` (`src/tests/runAllTests.ts` incl. `seerahBookSystem.test.ts`, `designSystemV2.test.ts`, Tanzil validation & 114 Surah split): **PASS** (`814 PASSED | 0 FAILED`)
- `npm.cmd run smoke:api-imports`: **PASS**
- `NODE_ENV=production vite build`: **PASS** (`2.92s`, `SeerahView` `49.26 kB` / `10.39 kB` gzip, `index` `246.39 kB`, `0` chunks > 500 kB)
- `node scripts/smoke-server.mjs`: **PASS** (production + dev Express servers)
- Playwright E2E (`e2e/seerah-book.spec.ts` on Edge Chromium Desktop `1440×900` + Mobile `390×844`): **PASS** (`4 passed | 0 failed`, `22.4s`, `0` page errors, `0` horizontal overflow)
- `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; runs in GitHub Actions CI)
- GitHub CI, Vercel Preview, Vercel Production, Production Sync Flags, `firestore.rules`, `bun.lock`, and Quran corpus: **UNTOUCHED / NOT EXECUTED**

### Next Action
- Push `feat/seerah-encyclopedia-ibn-kathir` to a GitHub Pull Request upon explicit owner authorization and inspect exact-head GitHub Actions `WIRD Quality Gate` and Vercel Preview before any merge.

---

## 2026-11-26 — Master App Overhaul (`feat/master-app-overhaul-20261126` → `main`)

### Scope & Phased Execution (`docs/MASTER_APP_OVERHAUL.md`)
- **Phase 1 (`37af33d0`) — Quranic/Editorial Typography & Circle-Glyph Elimination:** Reproduced and fixed the mid-ayah black-ball/dotted-circle (`●◌`) glyph artifact caused by QPC-encoded `UthmanicHafs1Ver18` lacking Tanzil `U+06DF` and combining pause marks. Switched `.font-quran` to `'Amiri Quran', 'Scheherazade New', 'Amiri', serif`, passed canonical `(surahNumber, ayahNumber)` coordinates to `QuranText`, and replaced `' ۞ '` separators with `﴿رقم﴾` without altering canonical Quran sources.
- **Phase 2 (`bde6aaa8`) — New Minimalist Geometric SVG Logo, PWA Icons & ZERO AI Look:** Created a clean geometric SVG logo across `WirdLogo.tsx`, `WirdAvatar.tsx`, `WirdPattern.tsx`, `favicon.svg`, `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png`; refined warm paper light (`#FAF6EE`) & restful deep dark (`#06120E`) surfaces; eliminated card-in-card nesting; removed all emojis from production `src/`.
- **Phase 3 (`d99ab6be`) — Written & Audio Ruqyah Shar'iyyah Rebuild:** Separated written Ruqyah clearly into Quranic verses and Authentic Prophetic Sunnah Duas with 3-way filtering, sources/takhrij, repetition counters, and progress tracking; added `MediaSession` lock-screen/background audio playback, ±10s seek, mute toggle, floating mini-player, and full offline audio session/category downloads via `offlineQuranAudioLibrary.ts` (`'ruqyah'` scope + reconnect auto-resume).
- **Phase 4 (`871b74dd`) — Gemini 2.5 Flash AI Assistant Upgrade:** Upgraded `api/advisor.ts` and `server.ts` to `gemini-2.5-flash` (with `gemini-2.0-flash` and deterministic local fallback; server-side API key only), added Arabic intent classification (`classifyAdvisorIntent` / `detectAdvisorQueryIntent`), user-progress context, and UID-scoped persistent chat history (`wird.advisor.chat.v1`).
- **Phase 5 (`577a7fe7`) — Internal Runtime & 100% Offline-First Engine:** Added `src/services/runtimeCoordinator.ts` (hover/focus + idle route chunk prefetching, background Surah cache RAM trimming, reconnect download auto-resume), exponential backoff retry in `cloudSyncCoordinator.ts`, included all `43` Seerah JSON files + PWA icons in `wird-precache-manifest.json` (`311` assets via `vite.config.ts`), and upgraded `public/sw.js` to 4-worker parallel resumable full-offline downloads.
- **Phase 6 — Full Verification, E2E Fixes & Documentation Closeout:** Fixed 4 E2E regressions caught by Playwright (`Sidebar.tsx` non-focusable footer preserving `الإعدادات` as last focus-trap element, `DashboardView.tsx` single daily session CTA + `64px` quick-action height + `'تصفح المصحف والمكتبة'` label, `SettingsView.tsx` `'داكن ليلي'` label, and `e2e/dashboard-ux.spec.ts` 10-progressbar count including `DailyVideoSuggestionCard`), added optional `PLAYWRIGHT_CHANNEL`/`PLAYWRIGHT_PREVIEW_CMD` env overrides to `playwright.config.ts` (preserving exact CI defaults), and reconciled canonical docs.

### Verification Executed (2026-11-26, `feat/master-app-overhaul-20261126`)
- `npm.cmd run lint` (`tsc --noEmit` + Tanzil validation): **PASS** (`0` errors)
- `node scripts/verify_seerah_content.mjs`: **PASS** (`6` eras, `12` sections, `40` chapters, `32` characters, `52` verbatim Quran + `43` verbatim Hadith quotes)
- `npm.cmd run smoke:api-imports`: **PASS**
- `npm.cmd test` (74 suites): **PASS** (`816 PASSED | 0 FAILED`)
- `NODE_ENV=production vite build`: **PASS** (`3.07s`, `allAssets: 311` incl. `43` Seerah JSON files, `0` chunks > 500 kB)
- `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
- Protected files diff (`MASTER_DIRECTIVE.md`, Quran corpus, `firestore.rules`, `bun.lock`): **PASS** (`0` bytes diff)
- Production `src/` emoji scan: **PASS** (`0` hits)
- Playwright E2E (`app-shell`, `dashboard-ux`, `ruqyah-ux`, `ruqyah-audio`, `advisor-ux`, `seerah-book`, `settings-ux` on Edge Chromium Desktop `1440×900` & Mobile `390×844`): **PASS** (`50 passed | 0 failed`)
- `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub Actions CI).

### Next Action
- Per explicit owner authorization («كمل وارفع على جيت هب main و انشر على فيرسل»), merge `feat/master-app-overhaul-20261126` into `main`, push to `origin/main`, and verify GitHub Actions CI + Vercel Production deployment status.

---

## 2026-11-27 — Root-Cause Fix for Offline Downloads & Cloud Sync + Firebase Rules Deployment (`main`)

### Root Causes Diagnosed
1. **Offline Audio Downloads (100% browser failure):** Live HTTP probe proved `cdn.islamic.network` omits `Access-Control-Allow-Origin`, causing `fetch(..., { mode: 'cors' })` in `offlineQuranAudioLibrary.ts` to throw a CORS `TypeError` on every ayah of every reciter in real browsers (plus `ar.ahmedajamy` returned `application/octet-stream`).
2. **Full-App Offline Preparation & 604p Mushaf Pack:** `prepareWirdForOffline()` and `getWirdOfflinePackageStatus()` rejected immediately when `navigator.serviceWorker.controller` was `null` (first visit / hard refresh) instead of using `registration.active`; `downloadFullMushafForOffline()` had no per-page retry across 604 SVGs.
3. **Cloud Sync Deadlock & Undeployed Rules:** `cloudSyncCoordinator.ts` called `flushAuxiliaryCloudSyncNow()` (`baseRevision: 0`) BEFORE pulling remote events, causing a permanent `REMOTE_REVISION_CONFLICT` + `blocked_pending_local` deadlock on any second device or fresh sign-in. Additionally, Production `wird-quran-app` had not had repository `firestore.rules` released.

### Changes Applied & Firebase Deployment
- `api/quran-audio.ts` & `scripts/smoke-api-imports.mjs`: Added strictly allowlisted same-origin proxy `GET /api/quran-audio?type=ayah&reciter=<approvedId>&ayah=<1..6236>` (immutable Edge CDN cache `s-maxage=31536000`, `audio/mpeg` content-type, 8 MB limit, 15s timeout).
- `src/services/offlineQuranAudioLibrary.ts` & `src/components/settings/SettingsView.tsx`: Added transparent browser CORS fallback to `/api/quran-audio?type=ayah&...`, `application/octet-stream` audio handling, and `job.lastError` visibility.
- `src/services/offlinePreparationService.ts`, `public/sw.js`, `src/services/mushafFacsimileService.ts`: Added `registration.active` fallback when `controller` is `null` and 3-attempt retries with backoff.
- `src/services/cloudSyncCoordinator.ts`: Pull remote reconciliation before `flushAuxiliaryCloudSyncNow()` when local outbox is empty so fresh devices learn server revisions first.
- **Firebase Production (`wird-quran-app`):** Executed `firebase deploy --only firestore:rules --project wird-quran-app` per explicit owner authorization (`rules file firestore.rules compiled successfully` → `released rules firestore.rules to cloud.firestore` → `Deploy complete!`).
- **Google Sign-In Hardening & Same-Origin `authDomain` (`src/lib/firebase.ts`, `vercel.json`, `public/sw.js`, `src/context/AuthContext.tsx`, `src/services/authService.ts`):** Added `Cross-Origin-Opener-Policy: same-origin-allow-popups` and Firebase Auth reverse-proxy rewrites (`/__/auth/:path*`, `/__/firebase/init.json`) in `vercel.json`, excluded `/__/` from `public/sw.js` fetch interception, surfaced `getRedirectResult` errors and set `user` immediately on popup success in `AuthContext.tsx`, added Arabic diagnostics in `authService.ts`, verified Google OAuth acceptance of `https://wird-app.vercel.app/__/auth/handler` after owner console update, and switched Production `authDomain` in `src/lib/firebase.ts` to `'wird-app.vercel.app'` (keeping `wird-quran-app.firebaseapp.com` for local dev/tests).

---

## 2026-11-27 — Firebase SQL Connect (Data Connect) Setup & Type-Safe Web SDK (`main`, base `9e1666de`, uncommitted local changes)

### Scope & Implementation
- **Firebase CLI & Project Link (`.firebaserc`, `firebase.json`, `.gitignore`):** Verified Node `v26.13.0`, `firebase-tools@15.37.0` via `npx`, authenticated session (`xm8eslam@gmail.com` / `ifawz40@gmail.com`), active Firebase project `wird-quran-app` (`WIRD`, project number `741238306826`, registered Web app `1:741238306826:web:3db91a75a7b7dc5dae07f3`), and zero pre-existing SQL Connect services. Added `.firebaserc` (`default: "wird-quran-app"`), added `dataconnect` source + emulator port `9399` to `firebase.json` (preserving `firestore.rules` intact), and ignored `.dataconnect/` in `.gitignore`.
- **Relational Schema, Authorized Operations & Local Seed Data (`dataconnect/`):**
  - `dataconnect/dataconnect.yaml`: Configured `serviceId: "wird-quran-app-service"`, `location: "us-central1"`, PostgreSQL `database: "fdcdb"`, `instanceId: "wird-quran-app-fdc"`, `schemaValidation: "STRICT"`.
  - `dataconnect/schema/schema.gql`: Defined `5` enums (`PlanType`, `PlanUnitType`, `PortionStatus`, `RevisionRating`, `PortionStrength`) and `7` normalized tables (`User`, `MemorizationPlan`, `MemorizationPortion`, `RevisionLog`, `WeakVerse`, `DailyActivityLog`, `AssessmentResult`) with explicit `userUid` foreign keys, composite B-tree indexes, and coordinate-only Quran references (preserving WIRD's verified local Tanzil Quran text boundary).
  - `dataconnect/connector/connector.yaml`, `queries.gql`, `mutations.gql`: Authored `8` queries and `10` mutations (`18` total), every operation enforcing `@auth(level: USER_EMAIL_VERIFIED)` (matching `firestore.rules` `isVerifiedUser()`) and binding row ownership strictly via server-side `auth.uid` (including atomic `@transaction` mutations `AssignPortionToPlan` and `RecordRevisionReview` with `query @redact` + `@check`). Configured `javascriptSdk` (`@wird/dataconnect`, `outputDir: "../../src/lib/dataconnect"`, 5s in-memory client cache, `packageJsonDir` omitted to preserve `package.json`/`bun.lock` parity).
  - `dataconnect/seed_data.gql`: Added local-only transactional `SeedWirdDevData` and `ResetWirdDevData` mutations without `@auth` directives.
- **Type-Safe Web SDK Integration & Automated Tests (`src/lib/dataconnect/`, `src/lib/dataconnectEntry.js`, `src/lib/dataconnectEntry.d.ts`, `src/lib/sqlConnectClient.ts`, `tsconfig.json`, `vite.config.ts`, `src/tests/dataConnectSetup.test.ts`, `src/tests/runAllTests.ts`):**
  - Generated `@wird/dataconnect` SDK into `src/lib/dataconnect/` and mapped `@wird/dataconnect` cleanly across `tsc`, `tsx`, and `vite` via `src/lib/dataconnectEntry.{js,d.ts}` (kept outside the generated directory so re-running `dataconnect:sdk:generate` never overwrites it).
  - Created `src/lib/sqlConnectClient.ts` with lazy `getWirdDataConnect()` bound to canonical `wird-quran-app`, opt-in emulator configuration (`VITE_FIREBASE_DATACONNECT_EMULATOR=true`), and resilient enum mappers with explicit `default` branches.
  - Added `src/tests/dataConnectSetup.test.ts` (`7` tests) and registered it in `src/tests/runAllTests.ts`.

### Verification Executed (2026-11-27, local workspace on base `9e1666de`)
- `npx -y firebase-tools@latest use` (inside `WIRD-APP`): **PASS** (`wird-quran-app`)
- `npx -y firebase-tools@latest dataconnect:compile`: **PASS** (`Successfully compiled SQL Connect service: wird-quran-app-service`)
- `npx -y firebase-tools@latest dataconnect:sdk:generate`: **PASS** (`Successfully Generated SDKs for services: wird-quran-app-service`)
- `tsc --noEmit`: **PASS** (`0` errors)
- `tsx src/tests/dataConnectSetup.test.ts`: **PASS** (`7 PASSED | 0 FAILED`)
- `npm.cmd test` (`76` suites incl. Tanzil validation + 114 Surah split): **PASS** (`840 PASSED | 0 FAILED`)
- `NODE_ENV=production vite build`: **PASS** (`3.68s`, `vendor-firebase` `159.05 kB`, `0` chunks > 500 kB)
- `npm.cmd run smoke:api-imports`: **PASS**
- Protected files (`firestore.rules`, `package.json`, `bun.lock`, Quran corpus, Vercel env vars/flags): **UNTOUCHED**
- Production Cloud SQL deployment (`deploy --only dataconnect`) & live SQL Connect emulator execution: **NOT EXECUTED** (production deploy requires explicit owner Blaze/Cloud SQL authorization; recorded in `docs/OWNER_ACTIONS.md`).

### Follow-Up — Typed Repository & Live Auth + SQL Connect Emulator Verification (2026-11-27)
- Added `emulators.auth.port: 9099` to `firebase.json`, created domain-typed `src/services/sqlConnectRepository.ts` (forwarding `ExecuteQueryOptions` `fetchPolicy` and omitting undefined optional query variables so SQL Connect never receives `limit: null`), and created `scripts/dataconnectEmulator.test.ts`.
- Executed `npx -y firebase-tools@latest emulators:exec --only auth,dataconnect --project demo-wird "node_modules\.bin\tsx.cmd scripts/dataconnectEmulator.test.ts"`: **PASS (`7 PASSED | 0 FAILED`)** against live local PostgreSQL + Auth emulator (verified unauthenticated denial, unverified-email denial, verified User A profile/plan/portion CRUD, atomic `RecordRevisionReview` `@transaction`, coordinate-only weak-verse upsert/resolve with `QueryFetchPolicy.SERVER_ONLY`, idempotent daily activity upsert, assessment results, and User B cross-user isolation).
- Re-ran full quality gate after repository edits: `tsc --noEmit` (**PASS**, `0` errors), `npm.cmd test` (**PASS**, `840 PASSED | 0 FAILED`), `NODE_ENV=production vite build` (**PASS**, `3.26s`, `0` chunks > 500 kB), `npm.cmd run smoke:api-imports` (**PASS**).
- Production Cloud SQL deployment (`deploy --only dataconnect`) remains **NOT EXECUTED** pending explicit owner authorization (Cloud SQL / Blaze billing).

### Next Action
- Review local diff and commit on a feature branch when ready, or explicitly authorize provisioning Cloud SQL and deploying with `npx -y firebase-tools@latest deploy --only dataconnect`.


---

## 2026-11-28 — Cloud Sync V4 (Real-Time `onSnapshot` + Bidirectional Additions & HLC Tombstone Deletions) & Personal Per-Account Cloud Vault (`main`)

### Root Causes Diagnosed
1. **Broken `origin/main` Build (`e2bf963f`):** Commit `e2bf963f` on `origin/main` deleted the 32 files added in `2a85d7a5` (including `auxiliaryCloudSyncService.ts`, `auxiliaryDomainsSchema.ts`, `src/fonts.css`, `MushafPaperFlipStage.tsx`, etc.) while keeping imports to them, causing GitHub Actions and Vercel deployment `dpl_141KW1A68QNc2KXCVkKriYYJKLRF` to fail.
2. **First-Sync `baseRevision` Deadlock & Missing Real-Time Replication:** Non-empty local outbox entries with `baseRevision: 0` skipped remote reconciliation and permanently deadlocked against existing Firestore documents (`REMOTE_REVISION_CONFLICT` + `blocked_pending_local`), while Event #1 hit `blocked_base_revision` when local storage was non-empty; `CloudSyncCoordinator` also lacked `onAuthStateChanged` / scope-change hooks and a live Firestore `onSnapshot` listener on `users/{uid}/syncSystem/remoteReplication`, and views never re-hydrated state after remote projection.
3. **Grow-Only Union Resurrecting Deletions:** Auxiliary merges (`mergeAuxiliaryDomainSnapshots`) used grow-only set unions (`new Set([...local, ...remote])`), resurrecting deleted Reading Khatmas, unmarked Khatma pages, removed Mushaf bookmarks, removed Adhkar favorites, unmarked Seerah chapters, and deleted custom video series; additionally, `deleteReadingKhatmaById` returned early without calling `scheduleAuxiliaryCloudSync()` when deleting the last Khatma.

### Implementation Completed
- **Branch Recovery & Pure-ESM Auth Init (`e9c63135`, `73ecbc88`, `api/firebase-init.ts`, `src/services/authService.ts`):** Reverted `e2bf963f` cleanly on fast-forward history, ported direct Google Identity Services `signInWithCredential`, and hardened `api/firebase-init.ts` using `fs.readFileSync` (`smoke:api-imports` PASS).
- **HLC Tombstone Ledger & Account Cloud Vault V4 (`src/services/syncTombstoneRegistry.ts`, `src/services/accountCloudBundleService.ts`, `src/services/auxiliaryDomainsSchema.ts`, `src/services/auxiliaryCloudSyncService.ts`):**
  - Built UID-scoped `SyncTombstoneLedgerV1` (`wird.sync.tombstones.v1`) tracking monotonic `upsertedAtMs` and `deletedAtMs` across all 15 user domains (`plans`, `enginePlans`, `portions`, `weakVerses`, `tests`, `readingKhatmas`, `khatmaPages`, `pageBookmarks`, `ribbons`, `adhkarFavorites`, `adhkarCounts`, `seerahChapters`, `customVideoSeries`, `watchedVideos`, `videoNotes`).
  - Wired automatic array snapshot diffing into `StorageService` (`savePlans`, `saveEnginePlans`, `saveUnifiedPortions`, `saveWeakVerses` — with atomic rollback inclusion in `applyJournalTransaction`) plus explicit upsert/delete hooks across `readingKhatmaService.ts` (including last-khatma deletion sync), `adhkarProgressService.ts`, `seerahBookService.ts`, `videoSeriesService.ts`, `mushafRibbonBookmarksService.ts`, and `QuranMushafReader.tsx`.
  - Built `AccountCloudBundleV4` (`users/{uid}/syncMeta/accountCloudVaultV4`, 100% authorized by deployed `firestore.rules`) with lossless `CompactEnginePlanV4` schedule compression (`< 115 KB` guaranteed) and commutative/idempotent `mergeAccountCloudBundles` preventing resurrection of deleted items while preserving concurrent additions and supporting causal re-add restores.
- **Real-Time Global Sync & Live UI Re-Hydration (`src/services/cloudSyncCoordinator.ts`, `src/services/remoteInboxProjector.ts`, `src/components/auth/AuthGate.tsx`, `src/components/layout/Header.tsx`, `src/App.tsx`, and views):**
  - Added live Firestore `onSnapshot` on `users/{uid}/syncSystem/remoteReplication`, `onAuthStateChanged` + `notifyStorageScopeChanged` triggers across all routes, self-healing outbox/inbox revision reconciliation after Vault V4 convergence, `مُزامن حياً` header badge, and `wird:cloud-sync-applied` state re-hydration across `App.tsx`, `QuranLibraryView`, `QuranMushafReader`, `RevisionCenterView`, `AdhkarView`, `SeerahView`, and `VideoSeriesView`.
- **Personal Per-Account Cloud Vault (`src/services/personalCloudSyncService.ts`, `src/components/settings/PersonalCloudVaultPanel.tsx`, `src/components/settings/SettingsView.tsx`):**
  - Added `#settings-personal-cloud-vault` in Settings with 3 personal cloud modes powered by `AccountCloudBundleV4` (syncing additions + deletions): (1) Google Drive private `appDataFolder` (`drive.appdata` + auto-sync + graceful `403 accessNotConfigured` guidance), (2) File System Access API Live Linked Cloud File (`iCloud Drive` / `OneDrive` / `Dropbox`) + universal Smart JSON Merge, and (3) gzip-compressed `WIRD4Z:` peer-to-peer sync capsules.

### Verification Executed (2026-11-28)
- `npm.cmd run lint` (`tsc --noEmit` + Tanzil validation + 114 Surah split): **PASS** (`0` errors)
- `npm.cmd run smoke:api-imports` (all 7 API handlers incl. `api/firebase-init.ts` & `api/seerah-tts.ts`): **PASS**
- `npm.cmd test` (`76` suites incl. `19/19` in `cloudSyncAdditionsAndDeletions.test.ts` & `17/17` in `wirdNextPlatformUpgrade.test.ts`): **PASS** (`852 PASSED | 0 FAILED`)
- `$env:NODE_ENV='production'; npx.cmd vite build`: **PASS** (`2.67s`, `0` chunks > 500 kB, `dist/wird-precache-manifest.json` emitted)
- `node scripts/smoke-server.mjs`: **PASS** (prod `4179` + dev `4180`)
- Production UI/service emoji scan: **PASS** (`0` hits)
- Protected files diff (`completeQuranData.json`, `quran-simple-1.1.xml`, `tanzilReferenceData.json`, `docs/seerah/MASTER_DIRECTIVE.md`, `firestore.rules`, `bun.lock`): **PASS** (`0` bytes diff)
- Playwright E2E (`e2e/app-shell.spec.ts` + `e2e/settings-ux.spec.ts` incl. `#settings-personal-cloud-vault` on Edge Chromium Desktop `1440×900` & Mobile `390×844`): **PASS** (`24 passed | 0 failed`)
- `npm run test:firestore-rules`: **NOT RUN** locally (`firestore.rules` untouched; executes in GitHub Actions CI).

### Next Action
- Fast-forward merge `feat/cloud-sync-v4-add-delete-personal-cloud` into `main`, push to `origin/main` (per explicit owner authorization), and verify exact-head GitHub Actions CI and Vercel Production deployment (`https://wird-app.vercel.app/`).


---

## 2026-11-28 (Follow-Up) — Root-Cause Fix for Stuck Outbox, Blocked Inbox & Open Projection Conflicts (`main`)

### Owner Report & Root Causes Diagnosed
- Owner reported Cloud Sync V4 was working well, with a few historical sync operations still appearing stuck or failed (`عالقة أو متعذرة`).
- Code audit identified 5 interacting root causes:
  1. **Exponential Backoff Hiding Outbox Entries (`nextAttemptAtMs > Date.now()`):** Prior failed attempts set `nextAttemptAtMs` up to 60 minutes in the future via `markFailed`, so `listReadyEntries(Date.now())` returned `0` items while `refreshPendingCount()` still counted `pendingCount > 0`, forcing `status = 'error'` (`X تغيير معلق`).
  2. **`rebasePendingMutation` Aborting After `setRemoteRevisionFromRemote`:** `setRemoteRevisionFromRemote` sets `cached.localSequence = nextSequence - 1 >= entry.sequence`, causing `IndexedDbSyncJournal.rebasePendingMutation` (`mutation.sequence <= cached.localSequence`) to abort on every `REMOTE_REVISION_CONFLICT`.
  3. **Oversize `> 128 KB` `enginePlans` / `syncMeta` Outbox Entries:** `IndexedDbSyncJournal` allows `450 KB` for `enginePlans` and session transactions, whereas `writeRevisionedRemoteMutation` rejects `> 128 KB` with `INVALID_REVISIONED_MUTATION`.
  4. **Duplicate `tombstoneLedger` Inside `auxiliary` & Vault Contention:** `captureAccountCloudBundle` serialized `tombstoneLedger` twice (`bundle.tombstoneLedger` and `bundle.auxiliary.tombstoneLedger`), and `reconcileAccountVaultV4` lacked a contention retry.
  5. **Residual Blocked Remote Inbox Events & Open `projectionConflicts`:** Previously archived open conflicts (including `weakVerses`/`activityEvents`/`syncMeta` where `containsUnsafeFullSnapshotProjection` hid manual resolution buttons) and blocked inbox events remained open even after `AccountCloudBundleV4` merged all local and remote data losslessly.

### Changes Implemented
- `src/services/accountCloudBundleService.ts`: Added `fitBundleForFirestoreVault` deduplicating inner `auxiliary.tombstoneLedger` and guaranteeing `{ vaultBundle }` stays `< 120 KB`.
- `src/services/indexedDbSyncJournal.ts` & `src/services/localSyncOutbox.ts`: Added `resetPendingBackoff` and atomic `reconcileVaultConvergedState` (acknowledging Vault-backed superseded outbox entries, advancing converged remote inbox cursors, clearing stale projection intents, and transitioning open `RemoteProjectionConflict` records to `status: 'resolved', resolution: 'reconciled'` while preserving conflict archive snapshots).
- `src/services/cloudSyncCoordinator.ts` & `src/hooks/useCloudSync.ts`: Added 2-attempt contention retry and `durablySyncedOnRemote` verification in `reconcileAccountVaultV4`, woke backoff-delayed items via `resetPendingBackoff`, deferred oversize (`> 120 KB`) / `REMOTE_REVISION_CONFLICT` mutations to post-Vault atomic supersession (refreshing canonical single-doc state via `buildAuthoritativeSingleDocPayload` without calling aborting `rebasePendingMutation`), looped `projectRemoteInboxBatch(100)` across multiple pages, and exposed `reconcileStuckOperations()`.
- `src/components/settings/SettingsView.tsx` & `src/components/layout/Header.tsx`: Wired `{ manual: true }` into manual sync triggers and added 1-click «حسم العمليات العالقة الآن» + smart CRDT merge buttons on unsafe/tombstone conflict cards.
- `src/tests/cloudSyncAdditionsAndDeletions.test.ts`: Added Section 7 regression tests (`25/25` passing; overall `858 PASSED | 0 FAILED`).

---

## 2026-11-28 (AI Studio Workspace) — Stale `/src/lib/firebase.ts` Module Export Error & Dev Service Worker Bypass

### Error Observed
- Runtime `AppErrorBoundary` error in preview browser: `SyntaxError: The requested module '/src/lib/firebase.ts' does not provide an export named 'WIRD_GOOGLE_OAUTH_CLIENT_ID'`.

### Root Cause
- `src/lib/firebase.ts` already exported `WIRD_GOOGLE_OAUTH_CLIENT_ID` on disk and over Vite (`http://127.0.0.1:3000/src/lib/firebase.ts`), but `public/sw.js` intercepted and cached same-origin Vite dev module paths (`/src/*.ts`) cache-first whenever a Service Worker was registered on the preview origin, and `src/main.tsx` did not unregister leftover Service Workers in non-production dev mode. In addition, `AppErrorBoundary` only reset component state on retry rather than reloading to pick up the updated ES module graph when HMR is disabled.

### Changes Implemented
- `public/sw.js`: Bypassed fetch interception and Cache Storage for Vite dev-server paths (`/src/`, `/node_modules/`, `/@*`, `.ts`, `.tsx`).
- `src/main.tsx`: Added non-production cleanup calling `navigator.serviceWorker.getRegistrations()` to unregister stale Service Workers in dev mode.
- `src/components/shared/AppErrorBoundary.tsx`: Detected stale ES module/chunk errors (`does not provide an export named`, `Failed to fetch dynamically imported module`, `ChunkLoadError`) and triggered a cooldown-guarded (15s via `sessionStorage`) single page reload to fetch the fresh module graph.

### Verification Executed (2026-11-28, AI Studio Workspace)
- `restart_dev_server` + live module check on `http://127.0.0.1:3000/src/lib/firebase.ts`: **PASS** (`HTTP 200`, `WIRD_GOOGLE_OAUTH_CLIENT_ID` exported).
- `npm run smoke:api-imports`: **PASS**.
- `npm test` (`76` suites incl. `pwaIntegration.test.ts` & `cloudSyncAdditionsAndDeletions.test.ts`): **PASS** (`858 PASSED | 0 FAILED`).
- `compile_applet` & `lint_applet`: verified in final build check.
- `npm run test:firestore-rules`: **BLOCKED** locally (`java` absent).
- Protected files (`completeQuranData.json`, `src/data/sources/`, `firestore.rules`, `bun.lock`, Vercel env vars/flags): **UNTOUCHED**.

---

## 2026-11-28 (AI Studio Workspace) — Category-Isolated Adhkar Counters, Synced Custom Tasbih, Compact YouTube Playlists & Surahs Icon Cleanup

### Owner Requests Implemented
1. **Category-Isolated Adhkar Counters (`src/services/adhkarProgressService.ts`, `src/components/adhkar/AdhkarView.tsx`):**
   - Keyed category-scoped daily counts by `${category}:${canonicalId}` via `getAdhkarCountKey` and `getAdhkarItemCount` (preserving backward-compatible normalization for legacy bare IDs and legacy Arabic sleep alias).
   - Updated `incrementAdhkarItemCount`, `resetAdhkarItemCount(..., category?)`, `resetAdhkarCategoryCounts`, `getAdhkarCategoryProgressSummary`, `getOverallDailyAdhkarSummary`, and `AdhkarView.tsx` so counting or resetting a shared dhikr in Morning Adhkar never increments or clears Evening, After-Prayer, or Sleeping Adhkar.
2. **Custom Tasbih Phrases + Cross-Device Cloud Sync V4 (`src/services/adhkarProgressService.ts`, `src/services/syncTombstoneRegistry.ts`, `src/services/auxiliaryDomainsSchema.ts`, `src/components/adhkar/TasbihStudioPanel.tsx`, `src/components/adhkar/AdhkarView.tsx`):**
   - Added bounded `customTasbihPhrases` (`max 50`, `2..240` chars, target `0..10000`, optional virtue) to `AdhkarProgressStore` with `addCustomTasbihPhrase` and `removeCustomTasbihPhrase` mutators.
   - Added `'customTasbih'` to `SyncTombstoneDomain` and wired HLC tombstone anti-resurrection + newest-timestamp convergence into `mergeAdhkarJson` (with safe active-preset fallback if deleted remotely).
   - Added inline «إضافة ذكر للمسبحة» creation form, custom phrases section, and accessible delete action to `TasbihStudioPanel.tsx`.
3. **Hide YouTube Descriptions on Custom Added Video Playlists (`api/youtube-playlist.ts`, `src/services/videoSeriesService.ts`, `src/components/series/VideoSeriesView.tsx`, `src/components/series/DailyVideoSuggestionCard.tsx`):**
   - Stopped extracting raw YouTube `media:description` in `api/youtube-playlist.ts` and stripped custom video descriptions in `sanitizeCustomVideo`.
   - Removed the auto-filled description field from the add-playlist sheet and suppressed hero/lesson descriptions for `sourceType === 'custom'` series across `VideoSeriesView.tsx` and `DailyVideoSuggestionCard.tsx`.
4. **Remove/Replace Gemini-like `Sparkles` Icon on Surahs View (`src/components/library/QuranLibraryView.tsx`, `src/components/library/QuranMushafReader.tsx`, `src/components/library/TafsirContentPane.tsx`):**
   - Replaced all 4 `Sparkles` icons in `QuranLibraryView.tsx` (hero eyebrow -> `BookOpen`, all 114 Surah card hifz buttons -> `BookMarked`, Surah study header & Ayah hifz buttons -> `BookMarked`) plus `QuranMushafReader.tsx` and `TafsirContentPane.tsx` (`BookOpen`).

### Verification Executed (2026-11-28, AI Studio Workspace)
- `npm test` (`76` suites incl. updated `adhkarSystem.test.ts`, `cloudSyncAdditionsAndDeletions.test.ts`, `videoSeriesSystem.test.ts`): **PASS** (`861 PASSED | 0 FAILED`).
- `npm run smoke:api-imports`: **PASS**.
- Live browser verification (`playwright-cli`, Chromium `1440×900` against `http://localhost:3000`): **PASS** across all 4 journeys (Morning `1/24` vs Evening `0/24`; Custom Tasbih add/persist-on-reload/delete; Custom YouTube playlist zero leaked descriptions; Surahs view `114` cards with `0` `lucide-sparkles` SVGs; `0` console errors).
- `compile_applet` & `lint_applet`: verified together in final build check.
- `npm run test:firestore-rules`: **BLOCKED** locally (`java` absent).
- Protected files (`completeQuranData.json`, `src/data/sources/`, `firestore.rules`, `bun.lock`, Vercel env vars/flags): **UNTOUCHED**.


