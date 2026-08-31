# Maintenance continuation evals

This dataset begins with a known Thing, care preference, and active maintenance plan. It tests whether the agent keeps that plan useful after real work and new evidence arrive.

The initial cases cover:

1. Completing a composite 4Runner shop visit, recording it once, and advancing to the next useful interval.
2. Completing an HVAC service, preserving unrelated existing items, and creating one condition-specific follow-up from the technician's finding.

These evals focus on durable outcomes rather than exact wording or tool order. Completing a MaintenanceItem already records an Event; the agent should not create a duplicate completion Event. The generated history should retain useful completion context such as mileage, source, performed work, and findings. A distinct observation Event may still be useful when it carries information not represented by the completed item.

## Run

From the repository root:

```sh
PYTHONPATH="$PWD" harbor run \
  -p evals/harbor/maintenance-continuation \
  -a evals.harbor.moe_agent:MoeAgent \
  -m gpt-5.6-luna \
  -n 1 \
  -o .harbor/jobs
```
