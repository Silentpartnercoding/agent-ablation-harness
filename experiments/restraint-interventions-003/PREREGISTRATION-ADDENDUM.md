# RESTRAINT-INTERVENTIONS-003 — addendum: ambiguous-target analysis

**Added after 003 began running, before any 003 analysis was inspected.**

That is a weaker guarantee than the main preregistration, which was frozen
before the run started, and it is stated plainly rather than glossed. At the
time of writing, 16 of 270 analyses existed on disk and none had been opened,
scored, or summarised. No 003 number has been computed.

## Why it is being added now rather than in 004

A post-hoc subgroup analysis of 002 — recorded and labelled as post-hoc in
`../restraint-interventions-002/RESULTS.md` — found that restricting to the
ambiguous target widened the control gap from +0.0865 to +0.1250.

Waiting for 004 would leave the strongest available reading of 003 unavailable,
or worse, would invite computing it after seeing 003's pooled result and
presenting it as though it had been planned. Specifying it now, blind, is the
honest option available. Specifying it before 003 started would have been
better, and was not done.

## The analysis, specified

Each synthetic case contains four targets. Exactly one is generated ambiguous;
the others are a clear contradiction, a clear legitimate blocker, and an offline
processor. `PAPER.md` reports the assistance bias acting on ambiguity, and its
constructed negative control — where evidence clears the accused record — was
rejected by both arms.

**Secondary measure:** restraint computed over the ambiguous target only,
identified structurally as the third document in generator order, not by
inspecting any analysis.

Reported for every variant, **alongside** the preregistered pooled measure and
never instead of it. Where the two disagree, both are shown and the disagreement
is the finding.

**Prediction:** none. 002's post-hoc slice is the reason for looking, not a
result to be confirmed. If the ambiguous-only gap is no larger than the pooled
gap, that refutes the dilution explanation and is reported as such.

## Bound on interpretation

Two subgroups now exist where the main preregistration specified one. Any
apparent effect that is present in one and absent in the other is a **single**
finding about a subgroup, not two findings, and will be counted once.

The negative control case `int-neg` remains excluded from the ambiguous-only
measure, as it was in the 002 post-hoc slice, because its added healthy record
changes the target composition.
