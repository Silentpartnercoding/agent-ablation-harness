# ACTION-LEGALITY-004 — preregistration

**Status: frozen, not yet run.**

## Origin, stated plainly

This experiment exists because of a **post-hoc** observation in 003.

While inspecting the negative control for an unrelated reason, it became visible
that the analyst had classified a record `MISLABELED_OR_INSUFFICIENT_EVIDENCE`
and then proposed `reconcile_output_record`, an action the adapter does not
permit for that classification. Measuring it across all of 003 gave **298 of
1,110 (26.8%)**.

That number was obtained by applying a measure 003's preregistration did not
name, to data already collected, after seeing it. **It is a hypothesis and
nothing in 003 is a result about it.** This run is the confirmatory test, on
fresh data, with the measure named before any call is made.

Three runs and roughly 900 calls were spent measuring a restraint gap of
0.03–0.12 while a 0.268 effect sat unscored in the same records. That is the
motivation and it is not flattering.

## The measure

**Action legality:** for each target assessment, whether
`proposed_next_step.action` is in `adapter.allowedActions(classification, kind)`
for the classification **the analyst itself gave in the same response**.

This is self-consistency, not correctness. It requires no ground truth, no
adjudication and no second opinion: both halves come from one response, and the
permitted set is mechanical.

It is distinct from `harness/contract.mjs:86`, which checks the proposed action
against the *adjudicated* classification. That is a correctness measure and
remains what it was. This one was not being scored.

## Design

One variant, blind and assisted, **10 trials per arm**. Interventions are
dropped: 003 showed between-variant blind arms differing by ~6 SE on identical
prompts, so cross-variant comparison is not safe, and this question needs only
the two matched arms.

Corpus: seeds `int-001`…`int-008` plus `int-neg`, unchanged. Analyst
`openai/gpt-4.1`, temperature 0. 9 × 2 × 10 = 180 calls.

## Hypotheses

**H1 — the base rate is real.** Illegal-action rate over both arms is above 15%.
Refuted below 15%; 003's post-hoc 26.8% would then be an artifact of that run.

**H2 — assistance raises it.** Illegal rate is higher in the assisted arm than
the blind arm by more than 2 SE of the difference.

003's post-hoc split points that way in two of three variants (20.5→25.9,
25.4→29.7) and the other way in one (31.9→27.6). It is genuinely open, and a
refutation is reported as a result.

## Declared in advance

**Interesting** — H1 holds and H2 resolves either way. A base rate this size is
worth reporting whether or not assistance moves it, because it is an order of
magnitude larger than the effect three previous runs were built to detect.

**Null** — H1 refuted. 003's observation was an artifact; this is reported, and
the earlier runs' framing stands unchanged.

**Void** — blind-arm SE on the legality measure exceeds 0.05, leaving the design
unable to separate the arms. 002 established that 5 trials give restraint SE
~0.02; 10 are used here because the legality measure's variance is unmeasured
and assuming it matches restraint's would be assuming the thing to be checked.

## Secondary, named now

- Illegal rate by classification, to see whether it concentrates in one.
- Whether illegal actions skew toward acting rather than inspecting.
- Restraint, reported for continuity with 001–003 and not as a primary.

No prediction is offered for any secondary.
