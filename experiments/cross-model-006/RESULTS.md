# CROSS-MODEL-006 — results

**VOID.** The free tier cannot host this experiment. No claim is made about
whether 005's result generalises across models, because no analyst completed
enough of the corpus to say.

This is the outcome `PREREGISTRATION.md` named:

> **Void** — an analyst produces unparseable or contract-violating output at a
> rate that makes scoring meaningless, or free-tier limits stop the run before
> the corpus completes.

## What happened to each analyst

**`google/gemma-4-31b-it:free` — 0 of 108.** HTTP 429 on the first call,
*"temporarily rate-limited upstream"*, and still failing on a single unrelated
call several minutes later. Six retries with backoff to 45s did not clear it.

**`poolside/laguna-s-2.1:free` — 24 of 108, then 4 of 108 after a parser fix.**
Two distinct failure modes, and only one of them was the model's.

## The first failure mode was mine

Of the first run's five gaps, **three were the harness refusing valid JSON**
because Laguna wrapped it in markdown fences despite `response_format:
json_object`. That scored the strictness of my parser, not the behaviour of the
analyst.

`run.mjs` now strips fences and leading prose before parsing. Genuinely
malformed JSON still throws and is still recorded as a gap, so the distinction is
preserved: *the model produced nonsense* versus *the model produced fine JSON in
a wrapper I would not read*.

This is the third instance tonight of an experiment measuring its own
instrument. The other two: npm downloads scored over a window that ended before
publication, and 002's citation prompt containing the answer it was testing for.
All three were caught by a later run rather than by review.

## The second failure mode is the model's, and is disqualifying

After the fix, the remaining gaps are truncation: malformed JSON at positions
2160 and 2985, mid-structure. The task needs roughly 3KB of structured output —
four target assessments, each with an evidence array — and Laguna does not
reliably complete it.

A model that truncates a third of its responses cannot be scored on a measure
computed from the whole response. Nothing is learnt about the contract by
including it.

## What this does and does not establish

**Does:** the free tier is not a viable route for this experiment. One model is
rate-limited to zero throughput; the other cannot produce output of the required
length reliably. Four further free models were rejected before the run for
returning provider errors, malformed JSON, or nothing at all.

**Does not:** anything about 005. Whether stating the contract eliminates the
gap on models other than `gpt-4.1` remains **untested**, and 005's result should
continue to be described as a property of one analyst until it is.

## What a real replication needs

A paid model reached through the same gateway, so no gateway variable is
introduced between analysts. Candidates confirmed reachable on this key:
`openai/gpt-4o` and other paid entries in the catalogue. The cost is cents at
this corpus size.

The preregistration stands unchanged and can be reused verbatim: only the
analyst list changes, and that list is recorded here rather than edited into the
frozen document.

## Provenance

Partial runs under `runs/`. No `scores.json` is written: scoring a corpus this
incomplete would produce a number that looks like a measurement, which is the
defect recorded in 001's deleted `results.json` and in the four E001 files in
`agent-trust-benchmark`.
