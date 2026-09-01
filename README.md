# Maintenance of Everything

A local learning prototype for a personal agent that helps keep what matters going. The first product wedge is physical things, represented internally as Subjects: Moe remembers their history and mediates their care across Chat, Inventory, and Maintenance using the same durable application tools.

## Requirements

- Node.js 22.13 or newer (required by Nanocodex)
- An OpenAI API key with access to the supported GPT-5.6 model family

## Setup

```sh
npm install
cp .env.example .env.local
```

Add `OPENAI_API_KEY` to `.env.local`.

Environment variables:

- `OPENAI_API_KEY` — required; used only by the Node server.
- `MOE_ACCESS_PASSWORD` — required in production; protects every application page and API endpoint with an HTTPS Basic Auth challenge.
- `MOE_ACCESS_USERNAME` — optional; defaults to `moe`.
- `NANOCODEX_MODEL` — optional conversation model; defaults to `gpt-5.6-luna` and also accepts `gpt-5.6-terra` or `gpt-5.6-sol`. Web searches inherit the model that invoked the tool.
- `OPENAI_API_BASE_URL` — optional OpenAI API base URL; defaults to `https://api.openai.com/v1`.
- `MOE_DATABASE_PATH` — optional SQLite path; defaults to `data/moe.db`.
- `NANOCODEX_WEBSOCKET_URL` and `MOE_NEXT_DIST_DIR` — test-harness overrides; leave unset for normal local use.

Start the application:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local state is stored in `data/moe.db` and survives page reloads and server restarts. Delete that file when you intentionally want to restore the believable seed data.

## Deploy for personal use

The production shape is one Docker service and one persistent volume. This keeps the prototype's SQLite database and long-lived streaming route intact. Railway is the recommended first host:

1. Push this branch to GitHub and create a Railway project from the repository. Railway will build the root `Dockerfile` automatically.
2. Add service variables `OPENAI_API_KEY`, `MOE_ACCESS_PASSWORD`, and optionally `MOE_ACCESS_USERNAME` and `NANOCODEX_MODEL`.
3. Attach a volume to the service at `/data`. The image already sets `MOE_DATABASE_PATH=/data/moe.db`.
4. Keep the service at one replica because this SQLite prototype has one writable database file.
5. Set the health-check path to `/healthz`, generate a Railway HTTPS domain, and open it on your phone. Sign in with username `moe` (or `MOE_ACCESS_USERNAME`) and your shared password.
6. Enable Railway volume backups after the first successful session.

The access gate is disabled during local development. In production it fails closed with `503` when `MOE_ACCESS_PASSWORD` is missing. It is intentionally only a shared password for this single-user prototype—not an account system. Do not deploy without the `/data` volume: the container filesystem is disposable and your Subjects, events, plans, and conversations would be lost on redeploy.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The end-to-end suite starts an isolated local database and uses the installed Google Chrome at desktop and phone viewport sizes.

The model-behavior evals live under `evals/harbor`. `identification` checks deduplication, timely clarification, and Subject boundaries. `maintenance-mediation` measures whether research becomes a small plan at the right granularity. `maintenance-revision` checks whether preference changes reshape an existing plan without fake history. `maintenance-continuation` checks whether completed work and new findings keep an existing plan current without duplication. Each dataset README has run and inspection commands.

The main manual flow is:

1. Start a chat with “I just bought a 2026 4Runner. I want to keep it forever.”
2. Ask for a small maintenance plan.
3. Say that Toyota handles the work and ask to track service intervals instead.
4. Report that the 5,000-mile service was completed today.
5. Confirm the Subject, history Event, and next MaintenanceItem in the structured surfaces.
6. Reload the page and restart the dev server; confirm the conversation and application state remain.

## Shape

- `app/` contains the Next.js UI and thin HTTP routes.
- `agent/` contains the small product prompt, twelve application tools, and the canonical `web__run` tool.
- `lib/database.ts` is the obvious SQLite boundary for Subject, Event, MaintenanceItem, and Conversation.
- `components/` contains shadcn-style UI primitives and native Subject/Maintenance renderers shared across chat and structured surfaces.

Nanocodex runs only in the Node route. Each turn includes a compact index of every Subject with its stable ID, category, attributes, and care preferences so the agent can resolve identity directly while the inventory remains small. The dependency is pinned to an immutable, CI-verified preview containing the canonical `web__run` tool. Its caller-owned search boundary runs server-side with `OPENAI_API_KEY`; credentials never enter the browser. The browser receives ordered NDJSON events for assistant text, tool activity, native tool results, and the final durable state. Each completed turn stores Nanocodex's session snapshot with its Conversation so the next request resumes the retained agent history.

This remains intentionally single-user. The Docker deployment and shared password gate exist only to make personal mobile use safe enough for learning; accounts, multi-user authentication, notifications, background scheduling, media, and the other exclusions in `prototype.md` remain out of scope.
