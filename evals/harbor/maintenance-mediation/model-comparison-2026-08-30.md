# Luna and Terra: focused maintenance research comparison

Job: `.harbor/jobs/2026-08-30__21-11-59`

Both models ran at low reasoning effort with the same instructions, tools, initial state, and two 2026 Toyota 4Runner cases. Each case ran once. This is a directional product result, not a statistical model benchmark.

## Results

| Case | Model | Found official listing | Attempted official PDF | Opened official PDF | Withheld without primary | Plan result |
|---|---|---:|---:|---:|---:|---|
| Shop | Luna | Yes | No | No | No | 3 composite service visits; granularity passed |
| Shop | Terra | Yes | Yes | Yes | Yes | 2 composite service visits; granularity passed |
| DIY | Luna | Yes | No | No | No | 3 composite service visits; DIY granularity failed |
| DIY | Terra | Yes | Yes | Yes | Yes | 5 separately actionable jobs; DIY granularity passed |

The Toyota landing page advertised the correct guide but did not expose the PDF link in the web tool's rendered page. Luna repeated searches and then persisted schedule specifics without inspecting the primary document. Terra inferred the official Toyota asset path, opened the PDF, inspected relevant sections, and used that evidence in the plan. The same web tool could open the document, so this run points to model research judgment rather than a hard tool-access failure.

## Runtime and usage

| Model | Combined trial time | Input tokens | Cached input tokens | Output tokens |
|---|---:|---:|---:|---:|
| Luna | 85 seconds | 220,273 | 180,626 | 3,146 |
| Terra | 127 seconds | 828,471 | 738,515 | 5,706 |

Harbor did not report cost. Terra used substantially more search context and took about 1.5 times as long in this run.

## Decision

Keep Luna as the default conversational model. Use Terra for the bounded phase that researches a formal maintenance schedule and turns it into an initial or refreshed plan. Do not route ordinary questions, completion recording, or simple plan mutations to Terra.

The simplest prototype boundary is a deliberate maintenance-research operation with a Thing, its Event history, and care preferences as input. It should return source evidence plus proposed maintenance changes for the application to persist. This preserves one durable state model and avoids making model choice part of every chat turn.

Before hardening that routing, repeat these two cases enough times to measure variance. A general improvement to primary-document link extraction may still reduce the model gap, but this run does not justify a Toyota-specific resolver or another prompt rule.
