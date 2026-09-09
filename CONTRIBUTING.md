# Contributing

## Local setup

See the README's [Getting Started](README.md#getting-started-local-development) section — clone, `npm install`, `./scripts/deploy-local.sh`, then `apps/api` and `apps/frontend` in separate terminals.

## Before opening a PR

Run whichever of these apply to what you touched:

- `packages/contracts` changes: `forge test` (from `packages/contracts/`).
- Any TypeScript package/app change: `npm run typecheck` (repo root).
- `apps/frontend` changes specifically: also `next build` (from `apps/frontend/`) — `tsc --noEmit` alone doesn't catch everything a real Next.js build does (e.g. the client/server component boundary).
- `apps/frontend/e2e/full-flow.spec.ts` changes, or anything upstream of it (`sdk`, `execution-node`, `indexer`, `api`): needs `anvil` (fully deployed — `./scripts/deploy-local.sh`) and `apps/api` already running, then `npm run e2e` from `apps/frontend/`.

CI (`.github/workflows/ci.yml`) runs `forge test` and `npm run typecheck` on every PR — a red check there blocks merge.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), scoped to whichever package/app the change actually touches:

```
<type>(<scope>): <description>
```

- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
- **Scope:** the directory name under `packages/`/`apps/` you changed (`contracts`, `sdk`, `types`, `config`, `execution-node`, `indexer`, `api`, `frontend`, `landing`), or `repo` for something cross-cutting (CI, root config, this file).
- One logical change per commit — don't bundle unrelated edits across scopes into one commit. A PR can (and often should) still be several commits, one per feature/fix.
- Never `git commit --no-verify`.
- A diff touching `packages/contracts/src/core/` or `packages/contracts/src/access/` needs explicit review of that diff before it's committed — these are the trust-boundary paths (see CLAUDE.md's Scan/audit scope rules).

## Where things live

The README's [Repository Structure](README.md#repository-structure) section is the map. `CLAUDE.md` (root, and one per app under `apps/`) carries the more detailed, why-shaped notes an AI coding agent (or a human) needs before changing a given area — read the relevant one before touching unfamiliar code.
