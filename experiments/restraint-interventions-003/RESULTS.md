# RESTRAINT-INTERVENTIONS-003 — results

Run 19 August 2026 against the corpus frozen in `PREREGISTRATION.md`, with the
secondary analysis in `PREREGISTRATION-ADDENDUM.md`. Analyst `openai/gpt-4.1`,
temperature 0, 5 trials per arm per variant, 3 variants, 270 analyses.

## Q1 — the citation requirement does not increase restraint

002's V1 moved assisted restraint to 0.8486 and could not be interpreted: its
prompt ended "If you cannot quote it, propose inspect_only", naming the
restrained action as the default.

V1R removes that sentence and keeps the citation requirement.

| | 002 V1 (with fallback) | 003 V1R (without) | 003 V0 control |
| --- | --- | --- | --- |
| assisted restraint | 0.8486 | **0.3622** | 0.4162 |

**The effect was the giveaway, not the citation requirement.** Without a named
fallback, V1R sits *below* the control. Requiring evidence for an action does
not, on this corpus, make the analyst more restrained.

## Q2 — H1 is untestable, and why is the result

H1 predicted that acting would be more common where the analyst recorded
`falsifier.present = false`.

**`falsifier.present` was `false` in 185 of 185 assessments.** Never once true.
The comparison has an empty cell and is not available.

That absence is the finding. A question whose answer never varies carries no
information: on this corpus the falsifier check can only ever return "no
disconfirming evidence", so it cannot disconfirm anything. It is not a test, it
is a ritual — and it cannot be failed.

This includes the negative control, the one case constructed so that
disconfirming evidence exists. On `doc_02186e94`, the record the frozen evidence
clears, all five trials recorded `present: false`, and all five described as the
falsifier something that would show the alert **right** rather than wrong
("Evidence that doc_02186e94 is actually blocked or incomplete"). That inversion
is **not** general: across the full sample it appears in 2 of 37 descriptions,
both on this case. Elsewhere the falsifiers are correctly formed ("Evidence that
the document is not actually blocked").

## The core finding, which was not what this run was measuring

While checking the negative control it became visible that on `doc_02186e94` the
analyst classified `MISLABELED_OR_INSUFFICIENT_EVIDENCE` — correctly — and then
proposed `reconcile_output_record`, which the adapter does not permit for that
classification. Permitted were `inspect_only` and `reconcile_routing`. All five
trials.

Measured across the whole run:

> **298 of 1,110 proposed actions (26.8%) are not permitted by the
> classification the analyst itself gave.**

| variant | blind | assisted |
| --- | --- | --- |
| V0 control | 38/185 (20.5%) | 48/185 (25.9%) |
| V1R citation | 59/185 (31.9%) | 51/185 (27.6%) |
| V3R falsifier | 47/185 (25.4%) | 55/185 (29.7%) |

This is **self-contradiction**, not error about the world. It needs no ground
truth: the classification and the action both come from the same response, and
the permitted set is mechanical.

`harness/contract.mjs:86` already checks proposed actions — but against the
**adjudicated** classification, which is a correctness measure. Consistency with
the analyst's *own* classification was not being scored.

Set against what these three runs were built to measure:

| | magnitude |
| --- | --- |
| restraint gap under study | 0.03 – 0.12 |
| self-contradiction rate | **0.268** |

Three runs and roughly 900 model calls were spent on an effect an order of
magnitude smaller than one sitting unscored in the same records.

**This is post-hoc.** It was found by applying a measure the preregistration did
not name, to data already collected, after seeing it. It is a hypothesis. It is
preregistered as the primary measure of 004, and no claim rests on the numbers
above.

## Between-variant comparison is not safe in this run

The blind arm received an identical prompt in all three variants:

| variant | blind restraint | sd |
| --- | --- | --- |
| V0 | 0.4486 | 0.0405 |
| V1R | 0.2649 | 0.0551 |
| V3R | 0.4000 | 0.0265 |

V0 and V1R differ by 0.1837 on unchanged inputs — about **6 SE**. Within-variant
blind-versus-assisted gaps remain matched and interpretable; comparisons across
variants do not. As in 001, the blind arm is what revealed the limit.

## Secondary, per addendum: ambiguous target only

| variant | blind | assisted | gap |
| --- | --- | --- | --- |
| V0 control | 0.6500 | 0.5500 | +0.1000 |
| V1R citation | 0.2000 | 0.4000 | −0.2000 |
| V3R falsifier | 0.5500 | 0.4750 | +0.0750 |

n = 40 per arm. The control gap is larger than the pooled +0.0324, directionally
consistent with 002's post-hoc slice. With the between-variant instability above,
this is not promoted further.

## Provenance

270 analyses under `runs/`. `scores.json` is recomputed by `score.mjs` without
calling a model and carries a provenance block declaring itself a derivation.
