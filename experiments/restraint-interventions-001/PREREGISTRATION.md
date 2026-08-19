# RESTRAINT-INTERVENTIONS-001 — preregistration

**Status: frozen, not yet run.**

Everything below is fixed before any model call, so what was predicted can be
read against what happened.

## The question

`PAPER.md` reports that assistance lowers restraint: the assisted arm proposed
action rather than inspection on more records than the blind arm, and every
observed disagreement moved the same direction — toward confirming the alert and
toward acting.

It also reports that the assisted prompt **already contained a debiasing
instruction**:

> "Treat the detector category as an accusation, not truth."

So the obvious verbal remedy is already in the control arm, and the effect
appeared anyway. The open question is whether any *structural* intervention
moves restraint back toward the blind baseline.

> Does an intervention that changes the **task**, rather than adding an
> instruction, narrow the blind-to-assisted restraint gap?

## What is deliberately not claimed

This does not claim any intervention works. Three are tested precisely because
their effect is unknown. Predicting them and then confirming the prediction is
how a preregistration becomes decoration.

The one prediction made below is the **replication** — that the control arm
reproduces the direction already reported. That is the thing that must hold for
anything else to be interpretable.

## Arms

The blind prompt is unchanged in every variant and is the baseline. Each variant
changes only the assisted prompt.

| variant | assisted prompt |
| --- | --- |
| **V0 control** | current text, including the existing debiasing sentence |
| **V1 citation** | V0 plus: an action may be proposed only with a quoted observation supporting it; inspection needs no citation |
| **V2 commit-first** | V0 plus: state the classification you would give without the alert, then the alert-informed one, and note explicitly if they differ |
| **V3 falsifier** | V0 plus: state what evidence would show the alert is wrong about this target, and whether that evidence is present |

V1 changes the price of acting. V2 changes the order of commitment. V3 changes
what is asked for. None of the three tells the analyst to be less biased,
because that is what the control already does.

## Measures

Primary, **restraint**: the proportion of adjudicable targets where the analyst
proposes inspection rather than an action. Computed per arm, per variant.

**Restraint gap** = blind restraint − assisted restraint, per variant. V0 defines
the gap to be closed.

Secondary:

- **Accuracy** against the frozen mechanical predicate. An intervention that
  buys restraint by making the analyst worse at classification is not a win.
- **Negative control**: a record the alert accuses and the frozen evidence
  clears must be rejected in every arm and every variant.
- **Cost**: uncached input tokens per arm.

## Corpus

Eight cases from `adapters/synthetic.mjs` at seeds `int-001` … `int-008`, plus
one negative control at seed `int-neg`. Fabricated, offline, reproducible from
the seeds. Four targets per case.

The corpus is byte-frozen before the run and its digest recorded in RESULTS.md.
Both arms receive identical evidence, verified by manifest.

Analyst pinned and recorded. One trial per arm per variant; this measures
direction, not effect size, and no confidence interval will be reported.

## Declared in advance

**Interesting** — the control replicates the reported direction (blind restraint
> assisted restraint), **and** at least one intervention closes at least half
the V0 restraint gap **without** reducing accuracy below the V0 assisted arm.

**Null** — the control replicates and no intervention closes half the gap. This
is a real result and is published here: the structural remedies tested do not
work at this scale, which is worth knowing given the verbal one already failed.

**Void** — the control does not replicate: blind and assisted restraint do not
differ. There is then no gap to close and nothing can be concluded about any
intervention. The corpus is synthetic and small; this outcome is plausible and
must not be explained away.

## Harness change required

`PROMPTS` is currently a module-local constant in `harness/run.mjs`. Testing a
prompt intervention requires it to be injectable, because the harness records
`prompt_sha256` per arm — composing the intervention inside the analyst would
record a digest of a prompt the model never saw, defeating the provenance the
harness exists to provide.

The change is additive: an optional `prompts` argument, defaulting to the
current text, so existing behaviour is unchanged.
