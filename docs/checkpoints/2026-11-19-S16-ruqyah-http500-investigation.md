# S16 Checkpoint — Ruqyah API HTTP 500 Investigation

**Checkpoint time:** 2026-11-19 07:44 Africa/Cairo (UTC+02:00)  
**Responsible workstream:** S16 — Security, API & Sources  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Base branch / SHA:** `main` / `026a86bc5e26d8f27cafadbf1ddce3b155fe00d6`  
**Investigation progress:** 85% (investigation only; not a fix-completion percentage)

## Executive result

The historical HTTP 500 reported for `/api/ruqyah` remains **NOT VERIFIED**. The available evidence does not identify its originating layer or reproduce the historical failure.

Current Production requests were reported by the S16 investigation as successful for all three Ruqyah programs, with the invalid-input HTTP 400 case also behaving as expected. This establishes only that the tested requests worked at the time of those checks; it does not explain or disprove the earlier 500.

## Evidence and verification boundaries

| Area | Result | Evidence boundary |
|---|---|---|
| Production Ruqyah API | PASS — 3 program requests and one HTTP 400 case | Reported by S16 checkpoint on 2026-11-19; not rerun by this documentation change |
| Production deployment | READY | S16 checkpoint; current main SHA was independently re-fetched as `026a86bc5e26d8f27cafadbf1ddce3b155fe00d6` |
| Preview deployment | READY | S16 checkpoint; Preview runtime access was blocked by SSO |
| Historical HTTP 500 cause | NOT VERIFIED | No correlated Request ID / runtime evidence establishing the source of the historical failure |
| Vercel Runtime Errors | No matching error cluster reported for the prior 24-hour window | S16 checkpoint; absence of a cluster is not proof that no failure occurred |
| Local automated tests | NOT RUN | No local test result is claimed |
| PR #395 Quality Gate | FAILED | Exact head `3b2d0dcd0745530641960da173bbd799b536802d`; run `44455832494` failed at frozen-lockfile installation before Ruqyah tests |
| PR #395 Vercel Preview status | SUCCESS / READY | Status is for the PR Preview deployment only; it does not override the failed GitHub Quality Gate |

## Ownership

S16 retains ownership of:
- `api/ruqyah.ts`
- `src/services/ruqyahApiService.ts`
- Independent Ruqyah API tests.

S16 does not take ownership of `src/components/ruqyah/**`; that UI remains under W09 ownership. Shared integration files remain subject to central coordination and existing PR overlap controls.

## Decisions

1. Do not merge or deploy any S16 change based on this investigation.
2. Do not change Production secrets, Vercel settings, Firebase configuration, security rules, or sync flags.
3. Preserve the verified local Quran corpus. Do not use an untrusted API or AI output as Quran, Hadith, or religious-source text.
4. Keep the historical 500 classified as **NOT VERIFIED** until a reproducible failure or correlated platform/runtime evidence is obtained.
5. Keep the Mushaf/navigation workstream running independently; S16 does not block it.

## Procedure if HTTP 500 recurs

Capture evidence from the failing response before retrying:
- Exact UTC timestamp (and local timezone if available).
- Full `x-vercel-id` response header.
- HTTP status and response headers.
- Sanitized response body.
- Deployment URL / environment and route.

Never share or log `ISLAMICAPI_API_KEY`, Authorization headers, or any URL/query containing the key.

Use the captured `x-vercel-id` and timestamp to locate the matching Vercel request/runtime log, then correlate the request with the exact deployment and source SHA. Classify the result as platform-generated, runtime-handler, upstream, routing, or still unknown only when supported by evidence.

## Preview access

If Preview runtime testing is required, arrange authorized SSO access through the project owner. Do not attempt to bypass the protection or copy production credentials into Preview.

## Next action

Wait for a correlated Request ID / reproducible HTTP 500. If it recurs, collect the evidence above and continue read-only tracing before proposing a code change. The central continuation document should link this checkpoint after the currently overlapping documentation PRs are reconciled.

## Checkpoint metadata

- Branch: `docs/s16-ruqyah-http500-checkpoint-20261119`
- PR: pending creation from this documentation branch
- Files changed: this checkpoint file only
- Tests: Not Run (documentation-only change)
- CI: not yet run for this new branch/PR
- Preview: not yet created/verified for this new branch/PR
- Production: unchanged; no deployment initiated
