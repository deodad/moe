# Identification evals

This local Harbor dataset covers seventeen narrow identification behaviors. The original ten establish identification, deduplication, and timely clarification:

1. Request identifying evidence for model-sensitive Dyson care without persisting a guess.
2. Persist a confirmed Dyson identity and free-form care preference.
3. Reuse an existing Subject when recording history.
4. Enrich a partial Subject instead of creating a duplicate.
5. Ask which of two existing Subjects the user means before recording history.
6. Avoid inferring ownership from shopping research.
7. Correct mistaken identity without leaving stale identity or a duplicate.
8. Attach component work to the maintained parent Subject.
9. Proceed without exact identity when the action is model-insensitive.
10. Clarify conflicting identity evidence before mutating state.

Seven reconciliation cases extend that contract:

11. Give generic advice without forcing irrelevant identity clarification.
12. Clarify between existing Subjects when a part or procedure is model-sensitive.
13. Merge duplicate Subjects while preserving agent-selected identity, preferences, history, and maintenance.
14. Split a conflated Subject and reassign only history supported by evidence.
15. Archive a replaced Subject and create its replacement instead of renaming it.
16. Defer an identity conflict while answering safely and making no durable change.
17. Create a separate Subject when the user explicitly distinguishes another identical product.

The verifiers use transcript, tool-call, and application-state assertions. There is no LLM judge and no required response wording beyond minimal clarification signals. Some cases are expected to fail while the product's uncertainty behavior is still evolving; do not weaken a useful eval merely to make the suite green.

## Run

Install Harbor once:

```sh
uv tool install harbor
```

Run the dataset from the repository root:

```sh
PYTHONPATH="$PWD" harbor run \
  -p evals/harbor/identification \
  -a evals.harbor.moe_agent:MoeAgent \
  -m gpt-5.6-luna \
  -n 1 \
  -o .harbor/jobs
```

Change only `-m` to compare supported Moe models. Inspect results with:

```sh
harbor view .harbor/jobs
```

The custom Harbor agent runs the local worktree, loads `.env.local` or `.env`, and requires `OPENAI_API_KEY`. Each Harbor task gets a fresh temporary SQLite database seeded only with the state declared by that case. Full transcripts, tool calls, state snapshots, and token usage are retained under the trial's `artifacts/` directory.
