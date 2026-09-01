# Subject context evals

These cases test whether Moe uses a Subject's freeform agent context as a concise, revisable working brief without allowing it to become canonical truth.

The suite covers six behaviors inspired by real prototype conversations:

1. Classify mixed baseline information into stable Subject attributes, Event evidence, future maintenance, and uncertain agent context.
2. Preserve tentative interpretations of colloquial user language without promoting them to confirmed facts or preferences.
3. Rewrite context when the user confirms an interpretation and later answers an open question.
4. Prefer canonical Event evidence over conflicting agent context and repair the stale brief.
5. Preserve uncertainty across repeated discussion instead of laundering an estimate into a fact.
6. Inspect canonical evidence before consequential advice and reject a conflicting tentative inference.

The verifiers inspect final application state, tool calls, and assistant output. They intentionally avoid an LLM judge and exact response wording.

## Run

From the repository root:

```sh
PYTHONPATH="$PWD" harbor run \
  -p evals/harbor/subject-context \
  -a evals.harbor.moe_agent:MoeAgent \
  -m gpt-5.6-luna \
  -n 1 \
  -o .harbor/jobs
```
