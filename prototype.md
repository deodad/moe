# Prototype

This prototype exists to learn, not to become the production architecture.

We expect to throw it away.

The goal is to get into a tight loop:

```text
build → use → notice → change → use
```

Optimize for **days-to-learning**, code readability, and ease of modification by Codex.

## Mission and prototype wedge

The broader mission is to help people keep what matters going. This prototype begins with physical Subjects because their identity, history, condition, and maintenance are concrete enough to test that idea end to end.

Do not generalize the prototype around every possible kind of responsibility. People, relationships, practices, communities, and institutions are not Subjects in the current model. Their place in the mission is a future product question, not a reason to add generic entities or vague agent capabilities now.

---

# What we're trying to learn

The core question:

**Does a ChatGPT-like agent that remembers your physical Subjects and mediates their care feel meaningfully better than generic chat/search?**

The prototype should let us experience:

```text
              CHAT
                │
        agent understands
          what happened
                │
          ┌─────┴─────┐
          ▼           ▼
       INVENTORY   MAINTENANCE
      durable state   attention
```

Everything else can wait.

---

# Stack

Keep it boring.

```text
Next.js
TypeScript
shadcn/ui

Nanocodex
  Node integration

Initially:
  fake / in-memory application state

Later:
  simple persistent database

Deployment:
  Vercel or similarly trivial web hosting
```

For an internet-accessible single-user deployment, a shared password at the
HTTP boundary is enough. This is deployment protection, not a product account
system.

Use Nanocodex server-side through Node rather than browser WASM for the prototype.

Do not use Expo yet.

The web application should be responsive enough to use comfortably from a phone.

---

# Product surface

Only three surfaces matter.

```text
        CHAT          INVENTORY         MAINTENANCE
```

## Chat

This is the real product.

Start with:

- ChatGPT-like interaction
- streaming responses
- recent conversations
- visible tool activity where useful
- inline structured UI
- responsive mobile layout

Eventually images/media matter greatly, but they don't need to block the first usable build.

## Inventory

A flat list of maintained Subjects.

Seed believable fake data:

```text
House
4Runner
HVAC
Bosch dishwasher
Espresso machine
```

A Subject detail can remain extremely small:

```text
4Runner
2019 Toyota 4Runner

Care
Keep long term. Proactive about worthwhile reliability
maintenance. Usually serviced at a shop.

Upcoming
5,000-mile service · soon

Recent
Oil changed · Jun 3

[ Ask about 4Runner ]
```

Do not build an asset-management dashboard.

## Maintenance

One attention screen.

```text
OVERDUE

THIS WEEK

THIS MONTH

LATER

WATCHING
```

Example:

```text
┌────────────────────────────────┐
│ 5,000-mile service             │
│ 4Runner                        │
│ This month                     │
│                                │
│ [ Done ] [ +1 month ]          │
└────────────────────────────────┘
```

No calendar UI.

No sophisticated scheduling system.

---

# Chat and UI should mirror each other

This is worth establishing early.

An agent tool can optionally have a native UI representation.

```text
Nanocodex event
      │
      ▼
tool call / result
      │
      ├── agent-readable structured result
      │
      └── optional UI renderer
```

For example:

```text
list_maintenance
        │
        ▼
<MaintenanceList />

get_subject
        │
        ▼
<SubjectCard />

create_maintenance
        │
        ▼
<MaintenanceCard />
```

The same underlying application action should be accessible through both language and UI.

```text
[ Done ]
    │
    └──────────────┐
                   ▼
            update_maintenance
                   ▲
                   │
"I did this yesterday"
```

Don't build a second application workflow behind the buttons.

---

# Minimal model

For the first real persistent version:

```text
Subject
Event
MaintenanceItem
Conversation
```

That's enough.

Do not implement generic relations yet.

Conceptually they may belong in the long-term product, but we don't need them to learn whether the core interaction works.

## Subject

```text
id
name
category?
attributes
care_preferences?
archived_at?
merged_into_id?
```

A Subject's identity is revisable. Archiving preserves retired or absorbed records; merging or splitting should preserve Events and MaintenanceItems rather than treating the first representation as final.

Keep attributes sparse. Identity, stable configuration, and directly current characteristics belong on the Subject. Historical readings, completed work, observations, and findings belong in Events rather than mirrored attributes such as `current_mileage` or `last_service`.

## Event

```text
id
subject_id?
summary
occurred_at
data
```

Events are the canonical history. Their loose data can retain readings, completion details, findings, source, and a link to the MaintenanceItem whose completion produced the Event.

## MaintenanceItem

```text
id
subject_id?
title
status
due (optional date and/or prose condition)
check_on? (YYYY-MM-DD; next review, not the work's deadline)
rationale?
data
```

MaintenanceItems describe future intent. Completion marks the item done and atomically creates a linked Event containing what actually happened; it does not replace the item's planned source or scope with completion facts.

Archive an obsolete MaintenanceItem when the plan changes. Archived intentions leave the attention queue without being deleted or producing a false completion Event.

## Conversation

Enough information to restore/resume an agent conversation.

Keep the actual schema loose and easy to change.

---

# Minimal agent tools

The tools are one of the most important parts of the prototype.

Start around here:

```text
Subjects
  search_subjects
  get_subject
  create_subject
  update_subject
  archive_subject
  merge_subjects

History
  get_history
  record_event
  update_event

Maintenance
  list_maintenance
  create_maintenance
  update_maintenance
```

Avoid generic graph primitives for now.

Avoid domain workflows.

No:

```text
maintain_car
change_oil
winterize_house
```

The agent should compose simple tools itself.

---

# Agent instructions

Keep the initial system prompt extremely small.

Something like:

```text
Help the user take care of the physical things in their life.

Research when knowledge is needed.

Use durable application state rather than relying on conversation
memory for facts that should persist.

Search before creating Subjects.

Record meaningful events when useful.

Maintain a useful set of future maintenance items.

Do not overwhelm the user with every theoretically possible
maintenance action.

Mediate recommendations based on the Subject, its history, and what
you understand about how the user wants to care for it.

Prefer maintenance at the granularity at which the user actually
acts.

Ask preference questions only when the answer materially affects a
current decision.

Care preferences can remain natural-language descriptions and
should evolve as useful patterns emerge.
```

Iterate on this constantly through use.

Don't build sophisticated orchestration before the simple agent fails.

---

# Build order

## Milestone 1 — feel the product

Build the product shell with fake application state.

```text
┌────────────────────┬─────────────────────────────────────┐
│ + New chat         │                                     │
│                    │                                     │
│ THINGS             │              CHAT                   │
│ House              │                                     │
│ 4Runner            │                                     │
│ HVAC               │                                     │
│ Dishwasher         │                                     │
│                    │                                     │
│ MAINTENANCE        │                                     │
│ 3 this week        │                                     │
│                    │                                     │
│ RECENT             │                                     │
│ Dishwasher noise   │                                     │
│ Car maintenance    │                                     │
└────────────────────┴─────────────────────────────────────┘
```

Build:

1. Responsive application shell.
2. ChatGPT-like sidebar.
3. Working Nanocodex conversation with streaming.
4. Fake Inventory surface.
5. Fake Maintenance surface.
6. Reusable inline MaintenanceCard.
7. Good-enough phone layout.

Use hardcoded data freely.

The point is to experience the information architecture before introducing infrastructure.

---

# Milestone 2 — let the agent operate the app

Introduce simple persistence and the application tools.

The interaction we want to test:

```text
USER
"I just bought a 2026 4Runner.
I want to keep it forever."

            │
            ▼

AGENT
create_subject(...)
update_subject(care_preferences=...)

            │
            ▼

THINGS
4Runner appears

            │
            ▼

USER
"Look up what maintenance I should
be thinking about."

            │
            ▼

AGENT
researches
reasons
creates a small mediated plan

            │
            ▼

MAINTENANCE
useful items appear
```

Then:

```text
USER
"Actually I take it to Toyota.
Just track the service intervals."

            │
            ▼

AGENT
updates care preference
adapts maintenance granularity
```

Then later:

```text
USER
"Got the 5k service done today."

            │
            ▼

record_event(...)
update_maintenance(...)
create/update future maintenance

            │
            ▼

History + Maintenance update
```

Refresh the app.

The state should still be there.

If that feels compelling, the prototype has already taught us a lot.

---

# Persistence

Do not solve persistence before we need it.

Milestone 1 can use fake/in-memory state.

For Milestone 2, choose the simplest hosted persistence that works with the deployment environment.

A boring hosted Postgres database is likely sufficient.

Don't design a general storage architecture.

Nanocodex conversation/session durability can initially use the simplest supported resume/snapshot mechanism that works.

Improve it only when actual usage exposes a problem.

---

# Repository shape

Keep the codebase obvious.

```text
moe/
├── vision.md
├── prototype.md
├── AGENTS.md
│
├── app/
├── components/
│   ├── chat/
│   ├── subjects/
│   └── maintenance/
│
├── agent/
│   ├── agent.ts
│   ├── instructions.ts
│   └── tools.ts
│
└── ...
```

No monorepo.

No internal framework.

No elaborate service/repository layers.

No generalized agent abstraction unless Nanocodex actually forces one.

A coding agent should be able to understand the interesting parts of the application quickly.

---

# Explicitly out of scope

Do not build yet:

- product accounts or multi-user authentication
- multi-user support
- onboarding
- native mobile / Expo
- notifications
- background scheduling
- calendar integration
- email or receipt ingestion
- warranties
- parts inventory
- service-provider marketplace
- graph database
- Subject relationships
- rich ontology
- manufacturer schedule importer
- elaborate knowledge ingestion
- sharing
- collaboration
- preference/settings screens
- subagents
- sophisticated orchestration
- generalized infrastructure for hypothetical future requirements

Even reminders can initially just be MaintenanceItems visible inside the app.

---

# Prototype principles

**Learning over longevity.**  
Assume the implementation will be replaced.

**Vertical slices over infrastructure.**  
Get an interaction working end-to-end before generalizing it.

**Fake before building.**  
Hardcoded data is good when we're testing product shape rather than persistence.

**Agent first.**  
Don't accidentally turn this into a traditional maintenance application with a chatbot attached.

**UI mirrors tools.**  
Structured UI should expose the same actions available to the agent.

**Keep the tools small.**  
Tool design is important; workflow design belongs mostly to the agent.

**Don't solve known future problems early.**  
Relations, notifications, native mobile, durable agent infrastructure, and richer knowledge systems can wait until the prototype makes us want them.

**Use the thing.**  
The most valuable feedback should come from actually trying to maintain our own stuff with it.
