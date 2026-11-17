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




## 2026-11-17 — Quran ayah navigation controls

- Owner request remains local/offline app readiness, with four ordered tasks: all active memorization plans on Dashboard; navigation beneath ayat; one-/two-page printed Mushaf; opposite-page Tafsir al-Muyassar.
- Task 2 PR #384, branch feat/ayah-navigation-controls-20261117, stacked on lockfile prerequisite PR #382.
- Added src/components/shared/AyahNavigationControls.tsx: accessible previous/next controls with Surah-boundary handling and no network dependency.
- Integrated controls beneath each ayah card and the continuous-reading block in src/components/library/QuranLibraryView.tsx; integrated beneath the Mushaf page in src/components/library/QuranMushafReader.tsx. The session view already provides its own sticky ayah navigation and was left unchanged.
- Added E2E coverage in e2e/wird-navigation-tafsir.spec.ts for study-card and Mushaf navigation. No local tests/build were run; task 2 remains NOT VERIFIED until exact-head CI and browser checks pass.
- PR #382's Bun lockfile alignment fixed the frozen install issue on its branch; last known Playwright failures were caused by tests firing the shortcut before listener readiness and firing media error before the new audio instance existed. Follow-up test synchronization was committed; await rerun.
- Task 4 data research: QuranEnc official Arabic At-Tafsir al-Muyassar page identifies source key arabic_moyassar and provides a surah API. Its displayed reuse conditions require content not to be modified/added/deleted, clear publisher/source attribution, version number, preserving edition information, reporting translation feedback, updating to new releases, and avoiding unsuitable ads. This supports a controlled offline package path but does not yet verify the exact source edition version or a complete bundled corpus.
- No Quran text was modified; no Firebase/Vercel production configuration or user data changed.
- Next: complete task 3 in its own PR; then verify the official Tafsir edition metadata and implement complete, resumable local Tafsir storage before task 4 UI.



## 2026-11-17 — Printed Mushaf one-/two-page mode

- Owner task 3 PR #385, branch feat/mushaf-facing-pages-20261117, stacked on task 2 PR #384.
- Added local preference wird.quran.pageDisplayMode.v1 with one-page default and optional facing spread.
- Spread order: page n (odd/lower number) on the right, page n+1 on the left; final spread is 603–604. Page jump normalizes to the odd spread start; page controls and touch navigation advance by two.
- The two facsimile components independently load and validate their SVG hit areas against WIRD local Quran ayah records. The spread never derives Quran text from the SVG.
- Audio combines right-page then left-page ayahs and waits for both page maps before playback/auto-continue. Switching mode stops active audio to prevent stale queue behavior.
- Responsive spread uses a 640px minimum side-by-side canvas with horizontal scrolling on narrow screens.
- Added E2E coverage for one/two-page switching, left/right order, two-page navigation, local preference persistence and offline opening.
- No local build/test run is claimed. PR remains OPEN / Draft / NOT VERIFIED because the prerequisite PR #382 currently fails bun audit on high-severity picomatch ReDoS advisory GHSA-fc5q-39xc-vjpf; do not suppress the audit.
- Task 4 source research: QuranEnc identifies Arabic Tafsir al-Muyassar as key arabic_moyassar, publisher King Fahd Complex, version V1.0.1 dated 2026-11-09. API returns surah aya/translation/footnotes. Official reuse terms require unmodified content, visible publisher and QuranEnc.com source, version number, retained edition metadata, feedback reporting, updating to source releases, and no unsuitable ads.
- Next: resolve the dependency security blocker without weakening audit, then exact-head validate stacked PRs. Build task 4 as a complete resumable IndexedDB offline package before exposing opposite-page Tafsir.



## 2026-11-17 — Offline Tafsir al-Muyassar and opposite-page mode

- Owner task 4 PR #386, branch feat/offline-tafsir-opposite-page-20261117, stacked on task 3 PR #385, task 2 PR #384 and lockfile prerequisite #382.
- Official source researched: QuranEnc Arabic Tafsir al-Muyassar, key arabic_moyassar, publisher King Fahd Complex, catalogue edition V1.0.1 dated 2026-11-09. Reuse conditions require unchanged translation content, publisher/source attribution, version and embedded edition information, reporting corrections, updating to source releases and no unsuitable ads.
- Added src/services/tafsirOfflineLibrary.ts: user-initiated 114-surah download, complete verse count/coordinate/non-empty text validation, raw payload storage with footnotes in IndexedDB, versioned manifest, durable transaction commits, pause/resume and skip-verified-surah behavior. No Firestore sync or network reads during display.
- Added TafsirOfflineDownloadPanel.tsx and TafsirMushafPage.tsx. Download UI shows progress, pause/resume and source attribution. Tafsir page is not shown until all 114 surahs validate; it displays source ayah text from WIRD local Quran data, untouched Tafsir translation and footnotes, with selected ayah highlight/scroll.
- Integrated independent content selectors in facing Mushaf spread: both pages default to Quran; choosing Tafsir on one side keeps Quran on the other; the selected ayah(s) from the opposite Quran page appear in Tafsir. Direction can be reversed and content-mode preference is local.
- Added E2E tests for full download, both spread directions, offline navigation, footnotes, invalid source payload rejection and partial download resume.
- No local build/test run is claimed. All PRs remain Draft / NOT VERIFIED because prerequisite #382 currently fails bun audit on GHSA-fc5q-39xc-vjpf / CVE-2026-112366 (picomatch through 4.0.7). Upstream #237 is open/unmerged; #238 is narrower and has a documented remaining vulnerable pattern. Do not suppress audit or pin a partial unmerged patch.
- Next: resolve the dependency security blocker; run exact-head CI, desktop/mobile and offline E2E for the full stack; then review each PR separately before merge/deploy.


- Follow-up review: the Tafsir side now has previous/next controls beneath each ayah; navigation swaps the reading side back to Quran when crossing into a page currently occupied by Tafsir. Audio is limited to the Quran side when Tafsir is active and covers both pages only when both are Quran. Corrupt stored surahs are invalidated from the manifest so resume can repair them.
- The downloader also verifies the live QuranEnc Arabic catalogue version before downloading; if the pinned edition is not the current catalogue edition, it refuses to mislabel the data.


## 2026-11-17 — Exact-head CI reconciliation

- Current task PR heads: #382 e8ca61cf86b0d49d94783670f76db1c250c7c146; #383 45acc719a90049f1f71606995cb02943ac5e337d; #384 3f59506204e21f702749159333162e80ab2f324d; #385 10529d88e358b35a63c7b41060ffe966141d54e2; #386 d386b1c32f2ea045643ffb0afc1a23594bc0a959.
- PR #382 run #4461: frozen install succeeds; bun audit fails on picomatch@4.0.7 via vite > tinyglobby > fdir > picomatch, GHSA-fc5q-39xc-vjpf.
- PR #383 run #4460: bun install --frozen-lockfile fails because main's package manifest/lockfile are out of sync; this is why the #382 lockfile alignment is a prerequisite.
- PRs #384–#386 have no workflow runs yet because they are stacked on non-main feature branches. Exact-head CI must be run after the parent chain is safely resolved.
- Advisory research refreshed 2026-11-17: GitHub advisory now reviewed/updated, High CVSS 8.7, affected through 4.0.7, no fixed version stated; npm still lists 4.0.7 as latest. Upstream PR #237 remains open/unmerged; #238 is not a complete fix for every reported pattern. Do not suppress audit or pin an unmerged patch.


## 2026-11-17 — Opposite-page navigation integrity and exact-head checkpoint

- Reviewed the current #386 implementation and official QuranEnc API schema. The API docs specify the translations catalogue as `{"translations":[...]}`, with `key/version/last_update`, and surah responses as `{"result":[...]}` with `sura/aya/arabic_text/translation/footnotes`. The downloader's catalogue wrapper and row parser match the documented shapes. Source docs: https://quranenc.com/ar/home/api.
- Found a spread navigation defect: when the target ayah was on the physical page currently displaying Tafsir, role-swapping changed the Quran/audio source but the old guard failed because `audioAyahs` still reflected the previous render. The code then loaded a neighboring page and could shift the facing spread anchor.
- Fixed `jumpToNavigationPoint`: when the target is already visible in the current single page/spread, it now stores a pending target and returns without changing the spread anchor; the existing effect scrolls once the Quran-side data renders.
- Added an E2E regression to navigate from Tafsir for page 2 back to page 1 ayah 7 and assert that the 1–2 spread remains, page 1 returns to Quran, and page 2 remains Tafsir.
- Hardened offline Tafsir completeness: the status helper now filters invalid/out-of-range surah IDs and considers the package complete only when the exact set 1–114 is present. Resume also ignores invalid stored surah numbers.
- Updated continuation and master-state docs with exact PR heads, CI/Preview evidence, Vercel build-rate-limit status and the picomatch audit blocker.
- Code-fix commit: `3d4bcbaac5e1830faf369125536294a8f8487e02`; subsequent commits on the branch are documentation-only. Re-fetch PR #386 for the live exact head. The last observed Vercel status remains FAILED due `build-rate-limit`; no GitHub Actions run returned. PR #386 remains OPEN/Draft. Its Vercel status is FAILED due `build-rate-limit`; no GitHub Actions run was returned for the current head.
- #382 run #4461 fails `bun audit` on picomatch 4.0.7 / GHSA-fc5q-39xc-vjpf. #383 run #4460 fails `bun install --frozen-lockfile`. #384/#385 previews were READY on their exact older heads; neither has a GitHub Actions run.
- No local checkout/terminal was available. No local test/build pass is claimed. Do not merge or deploy until the lockfile/security blocker is resolved and each task passes exact-head gates. No Production, Firebase, Vercel settings/secrets, sync flags or user data changed.


## 2026-11-17 — Task 1 duplicate-plan completion identity

- During follow-up review of the multi-plan Dashboard fix, identified an ambiguity: if two active plans contain the same ayah coordinates, coordinate-only completion matching could update the wrong plan when the user started the other plan's card.
- PR #383 code commit `77f360a4390466863c487dd164d567a95a83a605` now passes the originating engine plan ID from both the primary daily task and additional plan cards into session state.
- Session completion filters by that exact plan ID when present; changing the session range clears the plan identity. Deep-linked sessions without an originating ID keep the coordinate fallback.
- Added a regression assertion that the primary daily selection retains the exact plan ID. PR #383 remains OPEN/Draft and its current exact-head Quality Gate is still blocked by the frozen lockfile/security prerequisite; no local test pass is claimed.


- Exact-head refresh after Task 1 duplicate-plan identity fix: PR #383 head `77f360a4390466863c487dd164d567a95a83a605`; Quality Gate run #4465 fails at frozen Bun install because #383 is based on main and does not include #382's lockfile alignment. Latest Vercel status is `build-rate-limit`. PR #383 remains Draft/NOT VERIFIED.


## 2026-11-17 — Upstream picomatch remediation re-check

- Re-fetched upstream picomatch PR #237 and #238; both remain OPEN/unmerged and no patched npm release is stated by the current GitHub advisory.
- Reviewed PR #238's latest review: it demonstrates residual exponential behavior for `+(*)`, `*(*)`, and `+(a*)`, including `+(*)` from the advisory itself. PR #238 is therefore not a complete fix.
- PR #237 proposes broader collapse behavior but remains unmerged/unreleased and has no official security release to consume.
- Updated PR #382's body with the finding. Keep audit enabled and all dependent tasks on HOLD until a complete reviewed upstream fix is published and the lockfile/audit pass.


## 2026-11-17 — Navigation coverage extended to Revision Center

- PR #384 code commit `022c1dd1cd5435f9c54a152e918e815dd601bbf5` adds adjacent-ayah controls below weak-verse cards in Revision Center. Previous/next opens a one-ayah review session for the adjacent canonical Quran coordinate.
- Shared navigation props now accept only `surahNumber` and `numberInSurah`, avoiding a fake/incomplete Ayah object for stored weak-verse records.
- Added E2E coverage: manually record a weak ayah, verify controls under its text, click next and confirm the one-ayah review route.
- PR #384 latest Vercel status is FAILED due to `build-rate-limit`; no GitHub Actions run returned. Its older READY preview predates these changes. Keep Draft until latest exact-head checks pass.


## 2026-11-17 — Offline Tafsir persisted-payload integrity follow-up

- Re-review found that the IndexedDB resume path and download status originally trusted stored record keys/source version without re-validating the persisted QuranEnc payload. A malformed/corrupt record could be skipped on resume and counted toward the offline package.
- Updated `tafsirOfflineLibrary.ts` so both package status and resume eligibility require full validation of stored surah payloads (canonical verse count, sequential surah/ayah coordinates and non-empty translation). Invalid records are treated as missing and fetched again.
- Added an E2E test that seeds a corrupt stored surah and stale manifest, verifies 0/114 progress, and verifies a complete 114-surah re-download with correct output.
- Commits: `2dfe56cdced650f45a004b183b1cca793edb1fe1`, `b41262195a14760faa75d4f530814ee13e56d070`. Exact current PR head must be re-fetched.
- No local Bun/Playwright execution or CI pass is claimed; PR #386 is stacked on a feature branch and remains Draft/NOT VERIFIED. No Production, Firebase, sync flags or user data changed.
