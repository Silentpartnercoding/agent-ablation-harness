# STATED-CONTRACT-005 — results

Run 19-20 August 2026 against the corpus frozen in `PREREGISTRATION.md`.
Analyst `openai/gpt-4.1`, temperature 0, 10 trials per arm per variant.

**COMPLETE.** The first run stopped when the API account ran out of credits, with
VC covering 7 of 9 cases. The two missing cases were run on 20 August on the same
key, same account, `gpt-4.1` direct, no gateway — the route the earlier draft of
this file specified, so the two cases differ from the seven only in content.

## Coverage

| variant | files | cases complete | scored assessments |
| --- | --- | --- | --- |
| V0 unstated | 180/180 | 9/9 | 740 |
| VC stated | 180/180 | 9/9 | 740 |

The completing run rewrote nothing. `run.mjs` had no notion of work already done
and would have re-frozen and re-run all sixteen finished cases, overwriting the
artifacts these numbers are scored from; it now skips a case whose
`comparison.json` exists, that file being written only on completion. The sixteen
were skipped and **V0's per-trial values are identical before and after**, which
is the check that the skip actually held rather than merely being claimed.

`int-008` had two orphan trials and no `comparison.json`, so it was re-run whole
under a single freeze rather than topped up. Mixing trials from two freezes would
need a footnote that a clean re-run does not.

It was in fact run twice. The first attempt re-ran it in place, over a directory
still holding the two orphan analyses — which surfaced a defect in the harness
described below — and it was then deleted and run again from an empty directory.
Both runs produced the same scored result, which is a reproducibility check
nobody designed and it is worth recording that it passed.

## A defect in the instrument, found by resuming it

Completing 005 required running a case into a directory that was not empty, and
that is a state the harness had never been in.

`freezeCase` built its manifest by walking the case directory. On a clean
directory that is exactly the three input files. On `int-008`'s dirty one it also
froze the previous run's four analysis outputs **as though they were inputs**, and
their digests went stale the instant the new run overwrote them. The case then
carried a manifest that failed verification, with no tampering anywhere near it.

Pulling that thread found the larger problem. `verifyCase` also walked the
directory, comparing present contents against contents at freeze time. Every
analysis an experiment produces is therefore reported `not in manifest`. Run
against the eighteen completed cases in this experiment, it returned
`manifest_intact: false` on **all eighteen**, twenty-three mismatches each.

`freeze.mjs` opens by saying the property is "verifiable after the fact from the
manifest, by a third party who trusts nobody." A third party doing precisely that
got a failure on every case. Meanwhile every `comparison.json` in this experiment
records `manifest_intact: true`, because that value was captured at freeze time —
**a stored verdict that could not be reproduced by re-running the check that
produced it.**

Fixed in `harness/freeze.mjs`: the manifest now records the three files the freeze
writes rather than whatever it finds, and verification checks those recorded paths
against disk. An unexpected file inside `blind-input/` or `assisted-input/` still
fails, because that changes what an arm was given; outputs elsewhere in the case
directory are the run's own product and no longer count as corruption. All
eighteen cases now verify, and a deliberately mutated `evidence.json` is still
caught as a hash mismatch — the check goes red when it should.

None of this touched a number. It was the verification of the numbers that was
broken, which is the harder thing to notice and the reason it survived four
experiments.

## H1 — stating the contract closed the gap

| | illegal-action rate | scored |
| --- | --- | --- |
| **V0 unstated** | **0.2716** | 740 |
| **VC stated** | **0.0000** | 740 |

Zero. Not reduced — absent, across **740 assessments and all nine cases**, in
every one of the ten trials in both arms.

**The negative control did not break it.** `int-neg` is constructed so the frozen
evidence clears an accused record, and it was named in the earlier draft as the
case most likely to produce a violation. It contributed 20 assessments under VC
and none of them were illegal. Its run verified clean: manifest intact, both arms
on evidence digest `ab5be0de…`, arm order balanced, `model_pinned` true on all
twenty calls.

The arms were not identical in behaviour — blind and assisted diverged on the
classification of `doc_fa1861fc` in trials 2, 3 and 6. They were identical in
legality, which is the thing being measured.

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

| classification | illegal / n | rate |
| --- | --- | --- |
| LEGITIMATE_BLOCKER | 179 / 1087 | 0.1647 |
| STALE_CONTRADICTION | 0 / 340 | 0 |
| FALSE_OR_TRANSIENT | 2 / 33 | 0.0606 |
| MISLABELED_OR_INSUFFICIENT_EVIDENCE | 20 / 20 | 1.0000 |

**Every numerator here is unchanged from the seven-case scoring.** 179, 0, 2 and
20 are the same violations; only the denominators grew, by the 164 assessments
the two completing cases added. The rates fell because nothing illegal was added,
not because anything was corrected — worth stating, because a table where three
of four rates move looks like a finding and is not one.

`MISLABELED` remains at ceiling, as in 004, and took none of the new
assessments. `FALSE_OR_TRANSIENT` is where `int-neg` landed: 13 assessments to 33,
the same 2 violations, all of them V0's.

## What is not established

- **The reported separation is -64.67 SE, and that number should not be read as
  a confidence statement.** It is computed against an arm whose variance is
  exactly zero, so the denominator is degenerate. What the data supports is the
  plain statement: 201 illegal actions in V0, none in VC, across matched
  corpora. The magnitude is real; the standard-error framing of it is not
  meaningful and is retained only because the scorer emits it.
- **Zero is a bounded claim, not an absence proof.** 740 assessments at this
  corpus size cannot distinguish a true zero from a rate low enough to be
  unobserved here. The negative control failing to produce one is the strongest
  evidence available and is still one case.
- **One analyst, one corpus.** Whether "stating the contract eliminates the gap"
  is a property of gpt-4.1 or of models generally is untested. Two free models
  were found capable of the task — `google/gemma-4-31b-it` and
  `poolside/laguna-s-2.1` — which makes a cross-lab replication feasible.
- A zero over 740 assessments is a strong result and an unusual shape. It was
  checked for the obvious artifacts: VC's files parse, its assessments score,
  and its count is 740 and matches V0's exactly rather than being empty or
  short. A scorer that silently dropped VC would produce the same headline, so
  the count matching is the check that distinguishes the two.

## Provenance

360 analyses under `runs/`, 180 per variant, symmetric. `scores.json` recomputed
by `score.mjs` without calling a model, carrying a provenance block declaring
itself a derivation.

The completing run of 20 August is recorded in `results.json`, which the first
run never reached — it died before writing it, which is why the model pinning
for the original sixteen cases is recoverable only from each case's
`comparison.json`. Those carry `model_pinned: true` and `analyst_id:
openai/gpt-4.1` per trial, and the two completing cases carry the same.
