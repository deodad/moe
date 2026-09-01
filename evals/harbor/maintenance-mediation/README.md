# Maintenance mediation evals

This dataset starts after onboarding. Every case supplies a known Subject and an explicit natural-language care preference, then asks the agent to research and create an initial maintenance plan.

The first six cases test one narrow product question across different care shapes:

1. Turn 4Runner guidance into a small composite plan for an owner who uses a shop.
2. Turn the same guidance into separate actionable work for a DIY owner.
3. Create a low-noise Dyson plan without materializing every possible failure or troubleshooting step.
4. Mix owner-performed filter changes with bundled professional HVAC service.
5. Select a few high-value actions from the enormous whole-home maintenance domain.
6. Keep a Baratza Encore plan genuinely low maintenance while retaining useful routine cleaning.

The deterministic verifiers expose several diagnostic metrics rather than reducing subjective plan quality to one assertion. The 4Runner cases distinguish discovering Toyota's schedule, attempting the official PDF, successfully opening it, opening a mirrored PDF, and withholding unsupported specifics when the official PDF was not inspected. A case can therefore show whether the failure is source access or agent judgment while separately measuring granularity and plan size. Transcript, tool, and final-state artifacts should be reviewed alongside the scores.

The first focused Luna/Terra research comparison is recorded in [model-comparison-2026-08-30.md](model-comparison-2026-08-30.md).

These evals deliberately do not test Subject creation, preference discovery, onboarding, background research, or plan refresh. Those are separate product questions.

## Run

From the repository root:

```sh
PYTHONPATH="$PWD" harbor run \
  -p evals/harbor/maintenance-mediation \
  -a evals.harbor.moe_agent:MoeAgent \
  -m gpt-5.6-luna \
  -n 1 \
  -o .harbor/jobs
```

Inspect individual transcripts and tool calls with:

```sh
harbor view .harbor/jobs
```
