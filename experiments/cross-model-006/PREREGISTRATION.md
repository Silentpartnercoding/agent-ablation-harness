# CROSS-MODEL-006 — preregistration

**Status: frozen, not yet run.**

## Question

005 found that stating the permitted-action contract as data took the
illegal-action rate from 0.2716 to 0.0000 on `openai/gpt-4.1`.

> Is that a property of gpt-4.1, or of models?

One analyst is not a finding. `PAPER.md` already re-ran its corpus with a second
analyst for exactly this reason.

## Why this does not wait for 005 to finish

005 is incomplete: its VC arm covers 7 of 9 cases, missing `int-008` and, more
importantly, `int-neg` — the negative control, the case built so the evidence
clears an accused record and therefore the case most likely to break a zero.

006 is not a continuation of 005 and does not inherit that gap. It runs the
**full corpus including `int-neg`** on different analysts. If the pattern holds
on another model with the negative control included, that is independent support
005 cannot supply for itself; if the negative control breaks it here, that is a
reason to doubt 005's zero before it is finished rather than after.

## Analysts

Two, from different labs, both free tier:

| id | lab |
| --- | --- |
| `google/gemma-4-31b-it:free` | Google |
| `poolside/laguna-s-2.1:free` | Poolside |

Both were checked before this was written: each returns valid JSON under
`response_format: json_object`. Four other free models were rejected —
`z-ai/glm-5.2` (provider error), `nvidia/nemotron-3-ultra` (malformed JSON),
`cohere/north-mini-code` and `liquid/lfm-2.5` (no response).

**These are not independent roots.** Models across labs share training data,
architecture lineage and often distillation ancestry. A result holding on both
is reported as *"the direction held across two model families"*, never as two
independent confirmations. This is the same rule the memory profile applies to
evidence, applied to analysts.

## Design

Identical to 005 in every respect except the analyst and the trial count:
variants `V0_unstated` and `VC_stated`, both arms, contract generated from
`allowedActions` rather than transcribed, inserted as data with no instruction
to comply.

Corpus: seeds `int-001`…`int-008` plus `int-neg` — **all nine**.
**3 trials** per arm per variant, not 10: free-tier throughput is unknown and a
smaller run that completes is worth more than a larger one that dies at 80%,
which is how 005 ended. 9 × 2 × 2 × 3 = 108 calls per analyst.

Route: OpenRouter. 005's completion must use the original OpenAI route, because
mixing gateways within one frozen experiment introduces an unrecorded variable.
006 is a new experiment whose analysts are all reached the same way, so no such
mixing occurs.

## Measures

**Primary:** illegal-action rate per variant per analyst — proposed action not in
`allowedActions(classification, kind)` for the classification given in the same
response.

**H1:** VC's illegal rate is lower than V0's, on both analysts.

**H2:** within V0, the assisted arm's illegal rate exceeds the blind arm's.
005 found +0.0784 at 4.23 SE and 004 found +0.0568 at 2.784 SE, both on
gpt-4.1.

## Declared in advance

**Interesting** — H1 holds on both analysts. The 005 result is then not specific
to one model.

**Split** — H1 holds on one and not the other. Reported as a split, and the
005 result is bounded rather than general. This is a real outcome, not a failure.

**Refuted** — H1 fails on both. 005's zero is then a property of gpt-4.1, and
should be described that way everywhere it appears.

**Void** — an analyst produces unparseable or contract-violating output at a
rate that makes scoring meaningless, or free-tier limits stop the run before the
corpus completes. Reported with coverage stated, as 005 was.

No prediction is offered. 005's zero was surprising enough that guessing whether
it generalises would be decoration.
