---
title: 'Playwright dev server exhausts file watchers'
severity: 'minor'
---

## Expected Behavior

`pnpm test:e2e` starts the Next.js test server and runs the Playwright assertions.

## Current Behavior

Watchpack repeatedly fails with `EMFILE: too many open files, watch`. Next reports that `.next-e2e/dev` was deleted and restarts in a loop before Playwright reaches assertions.

## Possible Solution

Reduce watched paths or run the end-to-end server in a production-like mode that does not install development file watchers.

## Minimal Reproducible Example

From the repository root, run `pnpm test:e2e`.

## Context

Observed while verifying the maintenance due-condition change. Unit tests, type checking, lint, and the production webpack build succeed.
