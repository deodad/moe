# Maintenance revision evals

These cases begin with a known Subject, an explicit care preference, and an active maintenance plan. They test whether Moe can reshape that plan when the user changes how they want to care for the Subject.

The initial cases cover:

1. Replacing separate 4Runner operation reminders with composite Toyota service visits.
2. Reducing an overbuilt Dyson plan to a small amount of useful recurring care.

The desired behavior is deliberately independent of a particular tool sequence. Moe should persist the changed preference, preserve useful source context, and leave a small active plan at the user's preferred granularity. Obsolete intentions must leave the attention queue without being marked complete or creating false history.

## Run

From the repository root:

```sh
PYTHONPATH="$PWD" harbor run \
  -p evals/harbor/maintenance-revision \
  -a evals.harbor.moe_agent:MoeAgent \
  -m gpt-5.6-luna \
  -n 1 \
  -o .harbor/jobs
```

Inspect transcripts, tool calls, and state with:

```sh
harbor view .harbor/jobs
```

## Initial baseline

The first Luna run on 2026-08-31 used the existing `active | done` maintenance contract. Luna persisted both preference changes and created no false Events, but it could not remove obsolete intentions from attention. It renamed all four 4Runner operations into service-visit placeholders and converted four Dyson items into condition-based placeholders, leaving both plans noisy.

Job: `.harbor/jobs/2026-08-31__19-12-54`

- `care_preference_updated`: 2/2
- `no_fake_completion_history`: 2/2
- `obsolete_items_retired`: 0/2
- 4Runner composite plan: failed with four active items
- Dyson low-noise plan: failed with five active items

After adding neutral maintenance archiving and one general plan-revision instruction, the same cases passed without domain-specific handling.

Job: `.harbor/jobs/2026-08-31__19-15-25`

- `care_preference_updated`: 2/2
- `obsolete_items_retired`: 2/2
- `no_fake_completion_history`: 2/2
- 4Runner composite plan: passed with three active service visits
- Dyson low-noise plan: passed with one active filter-care item
