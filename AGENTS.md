# Agent instructions

## Friction logging

- Log papercuts and friction (tooling, docs, APIs, tests, conventions) as you hit them with `pnpm frog log`.
- Do not add global, system, or internal friction.
- Run `pnpm frog list` first to see what is already known.

Read `vision.md` and `prototype.md` before making significant product or implementation decisions.

This is a disposable learning prototype. Prefer the simplest implementation that lets us test the product, keep important code obvious, and avoid premature abstraction.

## Git workflow

Work directly on `main`. Do not create feature branches or pull requests for this repository.

Before starting work, pull the latest `origin/main`. When a change is complete and verified, commit it with a conventional commit message and push it directly to `origin/main`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
