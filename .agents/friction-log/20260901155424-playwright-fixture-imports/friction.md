---
title: 'Playwright fixture imports missing ws dependency'
severity: 'minor'
---

## Expected Behavior

`pnpm test:e2e` loads the browser test fixture and runs its assertions.

## Current Behavior

Playwright stops during test discovery with `Cannot find package 'ws' imported from tests/e2e/prototype.spec.ts`, followed by `No tests found`.

## Possible Solution

Declare `ws` as a development dependency or replace the fixture import with an already available WebSocket implementation.

## Minimal Reproducible Example

From the repository root, run `pnpm test:e2e` in an environment where the local Next server can start.

## Context

Observed while verifying the maintenance due-condition change. Unit tests, type checking, lint, and the production webpack build succeed.
