# WIRD-maintained picomatch security fork

This directory vendors the MIT-licensed picomatch 4.0.7 runtime and applies the mandatory bounded repeated-extglob ambiguity validation proposed in upstream pull request #261.

- Upstream project: https://github.com/micromatch/picomatch
- Upstream baseline: 4.0.7
- Security advisory: GHSA-fc5q-39xc-vjpf / CVE-2026-112366
- Patch proposal: https://github.com/micromatch/picomatch/pull/261
- Patch commits: `ac794fd86f1d3fd862993831daae783d7c316a23`, `ac0aeeb9022f3b4113e57f587a853f1e358efee2`, `b911986d9fb69c39ac203a1d08b7436057508058`

The upstream maintainer has not accepted an official release containing this fix. This is a downstream build, not an upstream release. It rejects ambiguous or unproven repeated-extglob patterns with `SyntaxError`, including patterns that disable the legacy recursion heuristic. Callers compiling external patterns must handle this error.

The local package version `4.0.8+wird.1` identifies this downstream patched build; it does not claim that upstream published picomatch 4.0.8. Remove this fork only after an official upstream release is verified to contain equivalent protections and the complete WIRD test suite passes against it.

The original MIT LICENSE is retained.
