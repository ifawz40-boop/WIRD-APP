# Gemini / Google AI Studio Project Instructions

Before making any change in this repository, read and follow the complete root-level `AGENTS.md`. It is the canonical engineering instruction set for WIRD and applies to all work performed through Google AI Studio, Gemini, GitHub, CI, or other coding agents.

In particular:
- The user is not responsible for manual testing, terminal commands, browser-console inspection, or post-deployment verification.
- Build automated unit, integration, Firestore Emulator, and independent multi-client IndexedDB tests.
- Never enable remote sync projection before server-owned revisions, base-revision capture, transactional compare-and-set, safe import/deduplication, durable cursors, and conflict handling are implemented and tested.
- Keep the synchronization state honest; do not claim full sync based on upload-only behavior or simulated tests.
- Run and inspect quality gates on the exact commit SHA.
- Keep work on the feature branch and preserve checkpoints.
- Do not merge, deploy manually, change production Firestore rules/data, or modify secrets/environment variables without explicit authorization.

For synchronization architecture, read `docs/sync/ARCHITECTURE.md`, `docs/sync/RELEASE-GATES.md`, and `docs/sync/TEST-MATRIX.md` before changing cloud sync, journal, outbox, storage projection, or Firestore rules. The old `REMOTE_REPLICATION_PLAN.md` path is not present in the current repository tree. Always begin from `docs/CONTINUE_HERE.md` and `docs/DEVELOPMENT_ROADMAP.md`.


## Continuation and parallel task rules
- Follow `AGENTS.md` and `docs/CONTINUE_HERE.md`; do not rely on old status snapshots.
- Keep independent tasks moving while tests run. Assign separate files to parallel tasks; never race edits to the same path.
- Record failed checks and return to them after independent work; do not weaken tests.
- Keep owner-only/physical-device/Production actions in `docs/OWNER_ACTIONS.md` until the end.
- Update the unified queue, feature roadmap, specialist checkpoint, and work log after meaningful progress.


## Mandatory change reconciliation
For every modification, follow `AGENTS.md` and `docs/CHANGE_CONTROL.md`: refresh exact GitHub/Vercel/Firebase evidence; map every open PR's changed paths before parallel work; serialize overlapping files; use the committed Bun lock as the single dependency graph; run and inspect exact-head checks; distinguish missing logs from code failures; update the live queue, specialist notes, work log, checkpoint and owner actions; then search for stale SHAs, contradictory status, wrong environment-variable names and broken links. Never change Production settings, secrets, Firebase Rules/data, sync flags, public-access protection, merge or deploy without the required specific approval.


## Current verified-state workflow (2026-11-14)

Before every Google AI Studio task, read `docs/engineering/MASTER_PROJECT_STATE.md`, `RELEASE_CHECKLIST.md`, `ARCHITECTURE.md`, `WORK_LOG.md`, and `docs/CONTINUE_HERE.md`. Use `docs/engineering/README.md` as the index. Append new history only to `docs/engineering/WORK_LOG.md`; the former progress path is a compatibility pointer.

Do not assume Production sync is disabled. Both Vercel Production sync flags were verified as `true` on 2026-11-14. Do not change them, Firebase settings, secrets, rules, or user data without explicit owner approval. Do not perform sync-related Production actions while this discrepancy is unresolved.

Always distinguish isolated tests, GitHub Actions, Vercel Preview, Production deployment, live smoke, and Google AI Studio synchronization. Never claim a test or deployment passed without exact SHA evidence.


## Open-source-first and API integration
Before creating a substantial capability, research official SDKs, standards and maintained open-source projects. Compare fit, license, maintenance, security, cost, privacy, quotas, attribution and long-term ownership. Prefer free and proven solutions; do not copy code without license review. For APIs, read official docs/terms, keep credentials server-side, validate/bound payloads, use safe timeouts/retries/idempotency, and implement explicit offline/error behavior. Verified local Quran text remains authoritative; no API or AI may replace Quran, authenticated Hadith, Tafsir, Fiqh or publishable Seerah.

## New owner requests
Requests outside the current roadmap must still be evaluated and, when accepted, recorded in `docs/DEVELOPMENT_ROADMAP.md` or a scoped requirement with acceptance criteria, dependencies, risk and tests. Reprioritize transparently; do not reject a request merely because it was not planned.
