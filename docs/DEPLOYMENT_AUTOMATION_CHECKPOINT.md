# Post-transfer deployment smoke checkpoint

This document records the lightweight Git-to-Vercel deployment smoke test after the repository transfer to `ifawz40-boop/WIRD-APP`.

- Repository: `ifawz40-boop/WIRD-APP`
- Production branch: `main`
- Vercel project: `wird-app`
- Purpose: verify that a new commit pushed to `main` triggers the connected Vercel production deployment.
- Scope: documentation-only; no application code, environment variables, Firebase settings, or production secrets are changed.

The smoke test is complete only after Vercel reports a new production deployment for this commit as `READY`.
