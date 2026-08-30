# Maintenance of Everything

A local learning prototype for a personal agent that remembers physical Things and mediates their maintenance. The product has three surfaces—Chat, Things, and Maintenance—backed by the same durable application tools.

## Requirements

- Node.js 22.13 or newer (required by Nanocodex)
- An OpenAI API key with access to the supported GPT-5.6 model family

## Setup

```sh
npm install
cp .env.example .env.local
```

Add `OPENAI_API_KEY` to `.env.local`. `NANOCODEX_MODEL` defaults to `gpt-5.6-luna`; it can also be set to `gpt-5.6-terra` or `gpt-5.6-sol`.

Start the application:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local state is stored in `data/moe.db` and survives page reloads and server restarts. Delete that file when you intentionally want to restore the believable seed data.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The end-to-end suite starts an isolated local database and uses the installed Google Chrome at desktop and phone viewport sizes.

The main manual flow is:

1. Start a chat with “I just bought a 2026 4Runner. I want to keep it forever.”
2. Ask for a small maintenance plan.
3. Say that Toyota handles the work and ask to track service intervals instead.
4. Report that the 5,000-mile service was completed today.
5. Confirm the Thing, history Event, and next MaintenanceItem in the structured surfaces.
6. Reload the page and restart the dev server; confirm the conversation and application state remain.

## Shape

- `app/` contains the Next.js UI and thin HTTP routes.
- `agent/` contains the small product prompt and nine caller-owned Nanocodex tools.
- `lib/database.ts` is the obvious SQLite boundary for Thing, Event, MaintenanceItem, and Conversation.
- `components/` contains shadcn-style UI primitives and native Thing/Maintenance renderers shared across chat and structured surfaces.

Nanocodex runs only in the Node route. The browser receives ordered NDJSON events for assistant text, tool activity, native tool results, and the final durable state. Each completed turn stores Nanocodex's session snapshot with its Conversation so the next request resumes the retained agent history.

This is intentionally single-user and local. Authentication, deployment, notifications, background scheduling, media, and the other exclusions in `prototype.md` remain out of scope.
