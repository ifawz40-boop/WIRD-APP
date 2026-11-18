# WIRD downstream picomatch security fork

## Why this exists

The current upstream picomatch release is affected by GHSA-fc5q-39xc-vjpf / CVE-2026-112366. The advisory identifies versions through 4.0.7 as affected and does not name a patched upstream release.

Vite and its glob tooling consume picomatch during development and build tooling. WIRD therefore vendors a locally patched copy rather than suppressing the advisory or disabling the dependency audit.

## Provenance

- Upstream: https://github.com/micromatch/picomatch
- Baseline: 4.0.7
- Patch proposal: https://github.com/micromatch/picomatch/pull/261
- License: upstream MIT license retained in `vendor/picomatch/LICENSE`
- Local package version: `4.0.8+wird.1` (downstream identifier only; not an upstream release)

The patch is not an upstream release and has not been merged by the upstream maintainer. Treat it as a maintained downstream security fork and review upstream status periodically.

## Security behavior

Repeated-extglob patterns that cannot be proven safe are rejected with `SyntaxError` or safely literalized. The validation is mandatory even when the legacy recursion heuristic is disabled. Safe common patterns remain supported.

## Regression coverage

`scripts/test-picomatch-security.mjs` checks advisory patterns, unsafe overlapping/nested patterns, alternate recursion options, safe common glob behavior, and a time-bounded isolated worker using long adversarial inputs.

The complete Bun dependency audit remains enabled. Do not add an audit suppression for this advisory.

## Removal condition

Replace this fork only after an official upstream release is verified to contain equivalent mandatory bounded-ambiguity protections and the full WIRD test suite passes against that release.
