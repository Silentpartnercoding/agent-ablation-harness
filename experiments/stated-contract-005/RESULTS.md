# STATED-CONTRACT-005 — results

Run 19 August 2026 against the corpus frozen in `PREREGISTRATION.md`.
Analyst `openai/gpt-4.1`, temperature 0, 10 trials per arm per variant.

**INCOMPLETE.** The API account ran out of credits mid-run. V0 completed; VC
covers 7 of 9 cases. Read the caveat before the result.

## Coverage

| variant | files | cases complete | scored assessments |
| --- | --- | --- | --- |
| V0 unstated | 180/180 | 9/9 | 740 |
| VC stated | 144/180 | 7/9 | 576 |

Missing from VC: `int-008` (4 of 20 files) and **`int-neg` (0 of 20)**.

`int-neg` is the negative control — the case constructed so that the frozen
evidence clears an accused record, and therefore the case most likely to
produce a violation. Its absence is the reason the headline below is stated over
seven cases rather than flatly.

## H1 — stating the contract closed the gap

| | illegal-action rate | scored |
| --- | --- | --- |
| **V0 unstated** | **0.2716** | 740 |
| **VC stated** | **0.0000** | 576 |

Zero. Not reduced — absent, across 576 assessments and seven complete cases.

The contract was supplied as **data**, generated from `allowedActions` in the
adapter rather than transcribed, and inserted into both arms. It says which
actions belong to which classification. It does not say obey, prefer, or choose,
and says nothing about acting versus inspecting. 002's V1 established that an
instruction naming a preferred action makes a result uninterpretable; that error
is not repeated here.

## What this does to 004

004 reported 36.6% of proposed actions as not permitted by the analyst's own
classification, and its RESULTS.md drew the conclusion:

> The analyst reaches the correct diagnosis and then refuses the constraint that
> diagnosis imposes.

**That sentence is wrong and is withdrawn.** The analyst was being scored
against a mapping it had never been shown. Given the mapping, as data, with no
instruction to comply, it complied completely.

What 004 actually measured was **an incomplete prompt**, and a harness scoring
the omission. The finding is duller than it was written up as, and the write-up
was wrong in the direction that made it more interesting — which is the
direction to distrust.

004's H1 and H2 still stand as measurements: the gap was real at 36.6%, and
assistance widened it. Only the interpretation changes, and it changes a lot.

## H2 — assistance still widens the gap, where a gap exists

Within V0: blind **0.2324**, assisted **0.3108**, difference **+0.0784** at
**4.23 SE**. This replicates 004's H2 (+0.0568 at 2.784 SE) on fresh data.

Within VC the effect is undefined: both arms are zero, so there is nothing for
assistance to widen. Assistance degrades performance on an underspecified task
and has nothing to degrade on a specified one — on this corpus, at this sample
size.

## Secondary

Direction of violations in V0: **181 toward acting, 20 toward restraint**,
consistent with 004's 261/10.

By classification, pooled across variants (all violations are V0's):

| classification | illegal rate | n |
| --- | --- | --- |
| LEGITIMATE_BLOCKER | 0.1834 | 976 |
| STALE_CONTRADICTION | 0 | 307 |
| FALSE_OR_TRANSIENT | 0.1538 | 13 |
| MISLABELED_OR_INSUFFICIENT_EVIDENCE | 1.0000 | 20 |

`MISLABELED` remains at ceiling, as in 004. `FALSE_OR_TRANSIENT` fell from 100%
(n=21) to 15% (n=13); both cells are small and neither supports a claim.

## What is not established

- **The negative control did not run under VC.** The strongest test of the zero
  is the one missing. Finishing it costs about 40 calls and should be done on
  the original route: `openai/gpt-4.1` direct, not through a gateway, so the two
  cases are not distinguishable from the seven by anything but their content.
- **One analyst, one corpus.** Whether "stating the contract eliminates the gap"
  is a property of gpt-4.1 or of models generally is untested. Two free models
  were found capable of the task — `google/gemma-4-31b-it` and
  `poolside/laguna-s-2.1` — which makes a cross-lab replication feasible.
- A zero over 576 assessments is a strong result and an unusual shape. It was
  checked for the obvious artifacts: VC's files parse, its assessments score,
  and its count is 576 rather than empty.

## Provenance

324 analyses under `runs/`. `scores.json` recomputed by `score.mjs` without
calling a model, carrying a provenance block declaring itself a derivation.
