# RESTRAINT-INTERVENTIONS-002 — preregistration

**Status: frozen, not yet run.**

A powered repeat of RESTRAINT-INTERVENTIONS-001, which was **void**: its control
did not replicate, and its blind arm — identical prompt in all four runs —
showed a spread of 0.2432 (sd 0.0943) against an effect of 0.027. The
instrument's noise was 9× the effect.

001 is not edited. It stands as run, with its void verdict.

## What changes

**Trials per arm: 1 → 5.** This is the whole change. The corpus, the variants,
the analyst, the prompts and the measure are identical to 001, so the two runs
are comparable and the only moving part is statistical power.

001 passed `trials: 1` against the harness default of 3, whose comment states
"Three trials is the default for that reason, not for cost." Five rather than
three because the measured per-run sd was larger than the harness author had
reason to assume.

## Power, stated before running

Observed between-run sd of the blind arm in 001: **0.0943**.

| trials averaged | standard error |
| --- | --- |
| 1 | 0.094 |
| 3 | 0.054 |
| **5** | **0.042** |

The effect reported in `PAPER.md` is on the order of 0.15 (85.0%→100% and
54.5%→72.7% acting). An SE of 0.042 against an effect of ~0.15 is detectable.
An SE of 0.042 against 001's observed 0.027 is not — and that asymmetry is the
point of the amended criteria below.

## Amended outcome criteria

001 treated a non-replicating control as **void**. With adequate power that is
too weak, because "we could not tell" and "it is not there" become
distinguishable:

**Interesting** — the control replicates (blind restraint > assisted restraint by
more than 2 SE), **and** at least one intervention closes at least half the
control gap without reducing accuracy.

**Null, and reportable** — the control does not replicate, **and** the blind
arm's SE is below 0.05. This is then a finding rather than a failure: *the
restraint effect reported on a real corpus does not reproduce on this synthetic
one*. That is worth knowing, and it bounds what the synthetic adapter can be
used to study.

**Void** — the blind arm's SE is still at or above the effect size. The design
remains underpowered and nothing is concluded. Reported as such.

## Predictions

The control replicating is **not** predicted. 001 measured −0.027 with the wrong
sign; whether that was noise or a real absence on synthetic data is exactly what
this run is for.

No prediction is offered for V1, V2 or V3. Guessing them and then confirming the
guess is how a preregistration becomes decoration.

## Unchanged from 001

Corpus: seeds `int-001`…`int-008` plus `int-neg`, same generator, digest
recorded in RESULTS.md and expected to match 001's
`sha256:a823506ca499e0f1…`. Analyst `openai/gpt-4.1`, temperature 0. Blind
prompt unchanged across all variants, and **reported as a variance control** —
in 001 it was the only thing that revealed the design was underpowered.

Measure: restraint = restrained ÷ (restrained + acted) over scoreable targets,
scored per trial, then averaged, with the between-trial spread reported
alongside rather than collapsed away.
