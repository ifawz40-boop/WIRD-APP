# WIRD — Documentation Operating Standard

**Mandatory for every developer, AI agent, coding assistant, and automation.** This policy applies to every request, including requests outside the roadmap, and remains mandatory even when the owner does not mention documentation.

## New-session bootstrap — no chat-memory dependency

Before planning, answering project-state questions, editing code, or executing work:

1. Read root `README.md`, `AGENTS.md`, and this document.
2. Read `docs/CONTINUE_HERE.md` for the only live execution queue.
3. Read the leading snapshot of `docs/engineering/MASTER_PROJECT_STATE.md`.
4. Read `docs/DEVELOPMENT_ROADMAP.md` for product direction and all owner requests.
5. Read `docs/engineering/ARCHITECTURE.md`, `docs/engineering/RELEASE_CHECKLIST.md`, and the relevant specialist design/test/security documents.
6. Read the latest relevant entries in `docs/engineering/WORK_LOG.md` and `docs/OWNER_ACTIONS.md`.
7. Refresh live GitHub refs/PRs/changed paths, exact-SHA CI, Vercel deployments/configuration, Firebase project/Rules evidence, and API state as relevant. Never assume an old SHA, status, environment, or prior conversation summary is current.

If a canonical file is missing from the active branch, explicitly report the integration blocker and locate the authorized canonical branch; do not invent a substitute or claim a new chat can see files that are not on its branch. Repository files—not chat history or model memory—must be sufficient to resume work.

## Documentation is automatic and part of acceptance

The owner must never have to say "document this", "update the notes", or remind the agent. For every accepted request:

- Capture intent and acceptance criteria in `docs/DEVELOPMENT_ROADMAP.md` or a scoped requirement before substantial implementation.
- At every meaningful checkpoint, and before finishing or pausing, update the applicable canonical records:
  - `docs/CONTINUE_HERE.md`: replace the leading live queue, exact next step, blockers, and active status.
  - `docs/engineering/MASTER_PROJECT_STATE.md`: replace the leading current-state snapshot with freshly verified facts and evidence statuses.
  - `docs/DEVELOPMENT_ROADMAP.md`: add/revise request, priority, acceptance criteria, dependencies, risks, and sequencing.
  - Specialist docs: update affected architecture, API contracts, data models, security/privacy, tests, and release criteria.
  - `docs/engineering/WORK_LOG.md`: append a dated evidence entry with branch and exact SHA, changes/files, tests actually run, CI run IDs, deployment evidence, review findings, unresolved risks, and next action.
  - `docs/OWNER_ACTIONS.md`: add/update/close actions requiring owner approval, credentials, production access, physical-device testing, or external decisions.
  - Update `docs/README.md`, `docs/DOCUMENTATION_CATALOG.md`, root README, `AGENTS.md`, and `GEMINI.md` when ownership, navigation, invariants, or agent workflow changes.
- Do not call a task complete while required documentation is missing. If interrupted, immediately write an IN PROGRESS/BLOCKED checkpoint with the exact remaining work.

## One source of truth per category

| Category | Canonical source |
|---|---|
| Live queue and next action | `docs/CONTINUE_HERE.md` |
| Current verified repository/platform state | Leading snapshot in `docs/engineering/MASTER_PROJECT_STATE.md` |
| Product plan and all new requests | `docs/DEVELOPMENT_ROADMAP.md` |
| Agent/repository rules | `AGENTS.md` and this standard |
| Google AI Studio rules | `GEMINI.md` (subordinate to AGENTS.md) |
| Change and evidence policy | `docs/CHANGE_CONTROL.md` |
| Architecture and implementation contracts | `docs/engineering/ARCHITECTURE.md` and subsystem specialists |
| Historical work evidence | Append-only `docs/engineering/WORK_LOG.md` |
| Owner-only/external actions | `docs/OWNER_ACTIONS.md` |

Resolve conflicting copies by updating the noncanonical copy in the same documentation pass. Verify operational claims against the live source system, not another document.

## Freshness: replace current snapshots, preserve history

- Replace the leading current-state and queue snapshots on reconciliation; never append a second competing "current" section.
- Mark older snapshots and checkpoints HISTORICAL and link them to the canonical live queue.
- The work log is append-only. Never erase useful decisions, test evidence, incidents, or rationale.
- Supersede outdated facts with dated corrections; preserve the prior record as history.
- Remove only genuinely duplicate/obsolete instructions after migrating useful content and recording the reconciliation.
- Never create parallel "master state", "latest handoff", or competing roadmap files.
- Every lifecycle fact (PR, SHA, CI, deployment, Firebase Rules, environment variable name/target) must be dated and tied to evidence, or marked BLOCKED/NOT VERIFIED. Re-fetch before reuse.

## Requests outside the roadmap

The roadmap is extensible, not a whitelist. Evaluate every new request regardless of current plan membership. Capture exact intent, classify it, define acceptance criteria, priority, dependencies, affected architecture/data, privacy/security risks, and verification. Reprioritize transparently without silently dropping existing commitments or broadening the request. Execute within existing authorization; ask only for a genuinely blocking detail or permission. Update the queue, relevant specialist docs, and work log automatically.

## Research, open source, and APIs

Before substantial custom implementation, search official documentation/standards, maintained open-source repositories, SDKs, and proven implementations. Prefer adapting a small suitable solution over rebuilding solved functionality. Record source, maintenance, license/attribution, security, compatibility, performance/bundle impact, privacy/retention, cost/quotas, lock-in, and why reuse is or is not appropriate. Never copy code without license review or add dependencies without a clear need.

For every API integration, record provider/purpose/endpoints, data flow, secret variable names only, environments, server/client boundary, authentication, validation, timeout/retry/cache, quota/cost, licensing/attribution, privacy/retention, fallback/offline behavior, tests, and approvals. Presence of a secret variable does not prove validity or a successful upstream call. Never disclose secret values. Existing Quran/religious-source restrictions in `AGENTS.md` remain absolute.

## Closeout checklist

- [ ] Request and acceptance criteria are recorded.
- [ ] Live queue and leading state snapshot are current and contain no stale live claims.
- [ ] Roadmap/requirement and affected specialist documents are updated.
- [ ] Work log has an append-only dated evidence entry.
- [ ] Owner-only actions are captured.
- [ ] New/changed documents are indexed and relative links resolve.
- [ ] Contradictory duplicate plans, stale SHAs, old PR statuses, and obsolete active instructions are reconciled.
- [ ] Tests/deployments are reported only for exact SHAs and only when actually observed.
- [ ] A new session can resume from repository files without chat memory.

If any item cannot be completed, label the task BLOCKED or NOT VERIFIED and record the exact missing evidence and next action.
