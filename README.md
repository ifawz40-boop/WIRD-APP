# وِرد | WIRD

A focused Quran reading, listening, memorization, revision, and daily-worship application.

## Mandatory new-session and documentation rule

Every new chat or coding agent must read [`AGENTS.md`](./AGENTS.md) and [`docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md`](./docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md) first, then follow the startup sequence below. Documentation is automatic for every request—including requests outside the roadmap—and never depends on the owner reminding the agent.

## Start here

For contributors, coding agents, and future ChatGPT sessions, read these in order:

1. [Core engineering instructions](./AGENTS.md) — mandatory safety, testing, authorization, and change-control rules.
2. [Current continuation queue](./docs/CONTINUE_HERE.md) — the single live execution queue and current verified evidence.
3. [Master project state](./docs/engineering/MASTER_PROJECT_STATE.md) — the single current-state summary.
4. [Application architecture](./docs/engineering/ARCHITECTURE.md) — system boundaries and data/API responsibilities.
5. [Unified development roadmap](./docs/DEVELOPMENT_ROADMAP.md) — product priorities and owner-request intake.
6. [Release checklist](./docs/engineering/RELEASE_CHECKLIST.md) — exact release acceptance gates.
7. [Documentation operating standard](./docs/engineering/DOCUMENTATION_OPERATING_STANDARD.md) — mandatory bootstrap, automatic documentation, and cross-chat continuity.
8. [Engineering work log](./docs/engineering/WORK_LOG.md) — append-only historical record.
9. [Documentation catalog](./docs/DOCUMENTATION_CATALOG.md) — specialist documents and ownership.

Google AI Studio instructions are in [GEMINI.md](./GEMINI.md). The specialist design documents are indexed by [docs/README.md](./docs/README.md) and [docs/engineering/README.md](./docs/engineering/README.md).

## Product and trust boundaries

WIRD stays focused on the verified Quran experience and daily worship: reading/listening, tafsir/search, memorization/revision/tasmee‘, adhkar, prayer tools, and supporting routines. It is not a general Islamic portal.

- Display Quran text only from the verified local Quran corpus.
- External APIs may provide validated coordinates/identifiers or approved media transport; they do not replace local Quran text.
- AI and untrusted providers are not authorities for Quran, authenticated Hadith, Tafsir, Fiqh, or publishable Seerah.
- Preserve user data, provenance, licensing, attribution, privacy, and offline safety.

## Repository and deployment

- GitHub repository: `xm8eslam-stack/WIRD-APP`
- Primary branch: `main`
- Production: https://wird-app.vercel.app/

The continuation and master-state documents contain dated evidence. Always re-fetch live GitHub, Vercel, and Firebase state before acting; never treat a historical SHA or deployment status as current.

## Engineering expectations

Research official standards, SDKs, and maintained open-source solutions before building substantial functionality from scratch. Review license, maintenance, security, privacy, cost, quotas, and architecture fit before reuse. Keep API credentials server-side, validate upstream data, and provide safe timeout/retry/error behavior. Prefer free/open solutions; paid dependencies require owner approval.

Every change must be reviewed, tested on its exact commit SHA, documented, and kept in a focused PR. Never alter Production settings, secrets, Firebase Rules/data, sync flags, or user data without explicit authorization.
