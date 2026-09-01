# Maintenance scheduling

These cases test whether Moe preserves real-world due criteria without inventing calendar dates. Dates are valid only when supported by known evidence. `checkOn` schedules the agent's next review; it must not replace or erase the actual condition.

The suite focuses on durable outcomes rather than exact wording: conditions survive, unsupported dates do not appear, known dates are calculated correctly, and check-on changes leave due criteria intact.

## Run

From the repository root:

```sh
PYTHONPATH="$PWD" harbor run \
  -p evals/harbor/maintenance-scheduling \
  -a evals.harbor.moe_agent:MoeAgent \
  -m gpt-5.6-luna \
  -n 1 \
  -o .harbor/jobs
```
