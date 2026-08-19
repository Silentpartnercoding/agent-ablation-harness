# RESTRAINT-INTERVENTIONS-001 — results

Run 19 August 2026 against the corpus frozen in `PREREGISTRATION.md`.
Analyst `openai/gpt-4.1`, temperature 0, one trial per arm per variant.
Corpus digest `sha256:a823506ca499e0f1…`, 9 cases, 37 scoreable targets per arm.

**Verdict: VOID.** The control did not replicate. Nothing can be concluded about
any of the three interventions.

## What the preregistration said would make this void

> **Void** — the control does not replicate: blind and assisted restraint do not
> differ. There is then no gap to close and nothing can be concluded about any
> intervention. The corpus is synthetic and small; this outcome is plausible and
> must not be explained away.

## What happened

| variant | blind | assisted | gap |
| --- | --- | --- | --- |
| V0 control | 0.5135 | 0.5405 | **−0.027** |
| V1 citation | 0.5405 | 0.7568 | −0.2163 |
| V2 commit-first | 0.4595 | 0.3784 | +0.0811 |
| V3 falsifier | 0.2973 | 0.5135 | −0.2162 |

The control gap is **−0.027**: not merely small, but the *wrong sign*. The
assisted arm was marginally more restrained than the blind arm, opposite to the
direction reported in `PAPER.md`.

The "share of the gap closed" figures the runner printed — −701%, +400% — are
arithmetic on a near-zero denominator and mean nothing. They are recorded here
only so that nobody recovers them from the logs and reads them as findings.

## Why it is void, measurably

The blind arm received an **identical prompt in all four runs**, over the same
frozen corpus. It is therefore an unintended but exact variance control, and it
says this:

| run | blind restraint |
| --- | --- |
| V0 | 0.5135 |
| V1 | 0.5405 |
| V2 | 0.4595 |
| V3 | 0.2973 |

**Spread 0.2432. Standard deviation 0.0943.** Same prompt, same evidence, same
model, temperature 0.

The effect under measurement was **0.027**. The instrument's own noise floor is
**9× larger than the effect**. This design cannot detect what it was built to
detect, and no number in the table above survives that.

## The error, precisely

`harness/run.mjs` sets `DEFAULT_TRIALS = 3`, with a comment directly above it
explaining that a single run of each arm cannot separate treatment from
run-to-run variation, and stating:

> "Three trials is the default for that reason, not for cost."

This run passed `trials: 1` to save cost. The default existed to prevent exactly
the outcome that occurred, and the comment said so in advance. The harness was
right and the operator overrode it.

## What can and cannot be said

**Cannot:** anything about whether a citation requirement, commit-first
ordering, or a falsifier requirement changes restraint. The three interventions
are untested, not disproven.

**Can:** the prompts clearly move behaviour a long way — assisted restraint
ranged 0.3784 to 0.7568 across variants — but with a noise floor this size the
direction of any individual move is not attributable to the intervention.

**Can, and it is the useful output of this run:** an ablation on this corpus
needs enough trials for the blind arm's own spread to fall below the effect
being measured. At the observed standard deviation of ~0.094 per run and an
effect on the order of 0.05–0.20, one trial per arm is short by roughly an order
of magnitude. The blind arm should be reported as a variance control in any
future run, because here it was the only thing that revealed the problem.

## A results file that was not a result

The runner originally wrote `results.json` in this directory. Every restraint
value in it was `null`: the runner read the wrong field of `runCase`'s return
value, so it tallied nothing while the model calls succeeded and their analyses
were written correctly to disk.

It has been deleted rather than corrected in place. It carried no marking that
distinguished it from a measurement, sat in the directory where a measurement
would sit, and had the shape of one. That is the same defect recorded for four
E001 files in `agent-trust-benchmark` on the same day: a hand-shaped artifact
indistinguishable from an emitted one, in the directory emitted ones live in.

`scores.json` replaces it and is computed from the written analyses by
`score.mjs`, which anyone can re-run without calling a model. It now carries a
`provenance` block naming what produced it and from which inputs.

## Preserved

All 72 analyses are in `runs/<variant>/<seed>/{blind,assisted}-analysis-trial1.json`,
with per-arm manifests. `score.mjs` recomputes `scores.json` from those files
without re-running the model, so this scoring can be checked independently of
the process that produced it.

The negative control (`int-neg`) is included in the corpus and its per-case rows
are in `scores.json`; with the run void, no claim is made about it either.
