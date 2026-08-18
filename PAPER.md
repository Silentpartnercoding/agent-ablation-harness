# A Blind-Control Harness for Measuring Alert-Assisted Agent Analysis

**Status:** Preprint draft — instrument description with preliminary, underpowered observations.
**Data:** `data/per-case.csv`, `data/aggregate.json`
**Version:** draft-01

---

## Abstract

Agent evaluations routinely measure whether an agent reaches a correct conclusion. They rarely
measure whether *assistance given to the agent* changes the conclusion it reaches, because they
lack a control arm: the same evidence analysed without the assistance.

We describe a harness that supplies one. A read-only shadow observes a production multi-agent
orchestration system, opens a *case* when a signal persists across observations, freezes the
observed state into hash-manifested inputs, and then analyses that frozen evidence twice — once
**blind** (raw observations only) and once **assisted** (identical observations plus the
detector's alert). Ground truth for the machine condition is derived mechanically rather than
adjudicated by a model, and targets whose cause is not independently provable are recorded as
`UNADJUDICATED` rather than guessed. The shadow holds no authority: `production_effects = 0`
across every case.

We report preliminary observations from 11 completed cases (35 persistent targets, 32 assessed).
Case-level verdicts agreed in 10/10 scoreable cases. The cost of assistance was strongly
signal-dependent: on deep `signal_A` cases (n=7) the assisted arm used 24.6% less uncached
input and 39.7% fewer reasoning tokens, while on shallow `signal_B` cases (n=4) the effect
was absent (+1.2% uncached input, four cases clustered in [+1.0%, +1.4%]). Beneath identical
case-level verdicts, per-target agreement was lower — 28/32 on classification and 21/32 on
proposed action — and every observed disagreement moved in the same direction: toward confirming
the alert and toward acting rather than inspecting.

These observations are **hypothesis-generating, not confirmatory**. The harness does not currently
record model identity or configuration per arm, ran one trial per arm per case, and yielded exactly
one adjudicated target. We state these limitations precisely and specify what each would require.
The contribution we claim is the instrument.

---

## 1. Motivation

When an agent is given a hint — an alert, a retrieved document, a prior classification — it
usually reaches its answer faster. Whether it reaches the *same* answer, and whether the answer is
*as good*, is normally unobservable, because the un-hinted counterfactual is never run.

This matters beyond efficiency. If assistance narrows an agent's search rather than accelerating
it, cost savings and judgment degradation appear in the data as the same thing: fewer tokens. A
system that measures only cost will read that as an unambiguous improvement.

The obstacle is evidentiary. Production state moves continuously, so "the same situation, analysed
without the hint" is not ordinarily available. The harness described here obtains it by freezing
observations and replaying them into two arms.

## 2. The harness

### 2.1 Read-only shadow

A shadow process observes the production orchestrator and records a state snapshot with a
`state_sha256`, a metrics block, and a verdict. Every record carries
`"authority": "none-observation-only"` and `"effects": 0`. The shadow proposes; it never acts.

### 2.2 Case formation

A detector tracks named signals with a persistence streak and a `target_fingerprint`. When a signal
is observed on the same targets across consecutive observations, it opens a **case** identified by
a content hash.

### 2.3 Frozen inputs

Each case stores per-observation `queue`, `state`, `status` and `receipt` documents, enumerated in
a `manifest.json` with a SHA-256 for every file. This is what makes the two arms comparable: both
receive byte-identical evidence, verifiable after the fact.

### 2.4 The two arms

| Arm | Input |
|---|---|
| **blind** | frozen observations only |
| **assisted** | the same frozen observations **plus** `alert.json` |

The manipulation is close to one file. The harness serialises `evidence.json` once and writes the
identical bytes into both arms' input directories, so equality is guaranteed by construction rather
than observed after the fact; the manifest confirms matching hashes.

The prompts are otherwise matched, and both carry contamination controls — the blind arm is
forbidden from reading the assisted input directory, the assisted arm from reading the blind
analysis. Notably, the assisted prompt contains an explicit debiasing instruction:

> "Treat the detector category as an accusation, not truth."

One caveat: the prompts are not textually identical beyond the alert reference. The blind arm is
told "You have not been told what the detector suspects," the assisted arm receives the debiasing
sentence above. The manipulation is therefore *alert file plus framing*, not the file alone.

### 2.5 Mechanical ground truth

Ground truth for the *machine condition* is derived without a model: if the signal is present on
the same targets in both observations, the case is `CONFIRMED_CONDITION`. Its scope is stated
explicitly in every record:

> "Confirms the machine condition only; it does not prove the cause or authorize a repair."

### 2.6 Abstention over guessing

Targets whose cause is not independently provable from frozen facts are classified
`UNADJUDICATED`, with the reason recorded. Unadjudicated targets are not scored and are not counted
correct. Coverage is exact-match: *"No nearby finding earns credit. Coverage must exactly match the
frozen target set."*

### 2.7 Matched execution environment

Both arms are invoked identically: `--ephemeral --ignore-user-config` (no user configuration can
drift between arms), `--sandbox read-only` (modification is impossible, not merely forbidden), and
the same `--output-schema`. This rules out configuration drift as an explanation for arm
differences, though it does not establish which model served either arm (§4.1).

### 2.8 Safety

Proposed repairs are recorded as `DENY_UNADJUDICATED` and `repair_authorized: false`.
`gate_simulation.mode` is `simulation-only` with `no_repair_authority: true`. All 11 cases report
`production_effects: 0`.

## 3. Preliminary observations

11 completed cases. 35 persistent targets, 32 assessed. Two signal types. Total study cost
1,433,768 tokens.

### 3.1 Case verdicts agreed

10/10 scoreable cases produced matching case verdicts, including both `MIXED` verdicts. One case
(`961db7a5`, the first run) recorded null verdicts and is excluded from verdict statistics.

### 3.2 The cost effect is signal-dependent

We report **uncached input**, **output** and **reasoning** tokens. Raw totals are confounded by
prompt caching — blind carried substantially more cached input (e.g. 104,960 vs 29,184 in
`8ecffa64`), which inflates a naive comparison by roughly a factor of two.

| Group | n | Uncached input | Output | Reasoning | Wall clock |
|---|---|---|---|---|---|
| **signal_A** | 7 | **−24.6%** | −25.2% | **−39.7%** | −31.0% |
| **signal_B** | 4 | **+1.2%** | +3.2% | −10.1% | −2.8% |
| All | 11 | −18.9% | −19.2% | −35.7% | −25.5% |

The `signal_B` null is the tightest result in the dataset: per-case uncached deltas of
+1.0%, +1.2%, +1.4%, +1.4%, with identical cached-input totals (13,056) in both arms across all
four cases.

Interpretation: shallow cases (2–4 targets, ~29k tokens either arm, ~20s) offer no search space to
prune, so the alert contributes nothing. Deep cases (74k–136k tokens blind) are where it acts.

One deep case, `0fcf1b44`, runs the other way at **+29.9%** uncached — the alert made it work more.

### 3.3 Divergence beneath agreement

Case-level agreement conceals per-target divergence:

- **Classification:** 28/32 agree (87.5%)
- **Proposed action:** 21/32 agree (65.6%)

Every observed disagreement is directional.

**Classification** — all four flips occur within one case, `8ecffa64`, and all flip the same way:
blind `MISLABELED_OR_INSUFFICIENT_EVIDENCE` → assisted `LEGITIMATE_BLOCKER`. Blind was sceptical of
the evidence on every target; assisted confirmed the alert on every target. `8ecffa64` also shows
the largest cost reduction in the study.

**Proposed action** — eight disagreements across three cases:

```
0fcf1b44 (x3)   blind: reconcile_route_or_worktree  ->  assisted: reconcile_signal_A
605e504c (x2)   blind: reconcile_route_or_worktree  ->  assisted: reconcile_signal_A
ee206895 (x3)   blind: inspect_only                 ->  assisted: reconcile_signal_A
```

In every case the assisted arm proposed `reconcile_signal_A` — the alert's own signal category
— where blind proposed something else. In `ee206895`, blind chose the conservative `inspect_only`
and the assisted arm proposed action instead.

The pattern is consistent with anchoring: the assisted arm may be cheaper partly because it adopts
the alert's framing rather than re-deriving independently.

This is notable because the assisted arm was *explicitly instructed* to "treat the detector category
as an accusation, not truth" (§2.4). If the divergence is anchoring, the instruction did not prevent
it — which would be the more useful result, since it suggests prompt-level debiasing is insufficient
and the effect must be measured rather than instructed away.

We emphasise this remains a *hypothesis*; see §4.

## 4. Limitations

These are disqualifying for a causal claim and we state them plainly.

**4.1 No model or configuration is recorded per arm.** `measurements` contains only `elapsed_ms`,
`token_usage` and `output_sha256`. Nothing identifies which model, settings, or temperature each arm
used. We cannot demonstrate the arms were matched on anything but input. This alone prevents the
cost comparison from supporting a causal claim, and it cannot be retrofitted to the existing 11 cases.

**4.2 One trial per arm per case.** With a stochastic analyst, a single blind run and a single
assisted run cannot separate treatment effect from run-to-run variance. The tight `signal_B`
clustering suggests low variance in that regime; variance in the deep regime is unmeasured.

**4.3 Ground-truth accuracy is n=1.** Exactly one target was adjudicated
(`605e504c/mh_e3f24242` → `STALE_CONTRADICTION`); both arms were correct. We can show the arms
*diverge*. We cannot show either is *wrong*.

**4.4 The anchoring observation is a single case.** The four classification flips are four targets
inside one analysis run, not four independent observations.

**4.5 Scope.** One orchestration system, one operator, two signal types, cases spanning 2026-08-13
to 2026-08-17. No claim generalises beyond this deployment.

**4.6 Arm order was fixed, not merely unrecorded.** In the code that produced these 11 cases, the
blind arm always ran first and the assisted arm always second. Order is therefore perfectly
confounded with treatment, and any order effect — including provider-side caching warmed by the
first run — is indistinguishable from the alert's effect. This is the most serious confound after
§4.1. It has since been corrected: arm order is now derived from the case-id hash, balanced across
cases and reproducible within one.

**4.7 Selection.** Cases are opened by a persistence detector, not sampled. The population is
"signals that persisted," not "signals."

## 5. What would make this a finding

In dependency order:

1. **Record model, configuration and seed per arm.** Without this nothing downstream is
   interpretable.
2. **Repeat each arm ≥3 times per case** to obtain variance and error bars.
3. **Randomise arm order.**
4. **Complete the queued cases.** 11 further cases are held at `awaiting_blind_validation`; n=22
   would roughly double the evidence and particularly help `signal_B` (n=4).
5. **Adjudicate targets.** The step from "the arms differ" to "one is better" requires ground truth
   on cause, which currently exists for one target.
6. **Add signal types**, to test whether depth — rather than signal identity — predicts the effect.

## 6. Relation to existing work

Agent security and evaluation frameworks (OWASP Top 10 for Agentic Applications; OWASP MCP Top 10;
IETF `draft-han-bmwg-agent-security-benchmark`) largely specify *what* to measure. Verifiable-audit
proposals such as VAL (Verifiable Authorization Lineage) address whether an agent's actions can be
independently verified after the fact.

This harness is complementary to both and occupies a different position: it measures whether the
*inputs* supplied to an agent change the *judgments* it produces, using a control arm. We are not
aware of an agent-evaluation harness in this space that runs a blind control over frozen,
hash-manifested evidence.

## 7. Reproducibility

Every case retains its frozen inputs with per-file SHA-256, both analysis outputs with
`output_sha256`, mechanical ground truth, and the comparison record. A third party holding a case
directory can verify that both arms received identical evidence and can re-derive the reported
comparison without trusting the operator.

The gap between this and full reproducibility is §4.1: for these 11 cases the analyst configuration
is not captured, and it is not recoverable — the event stream (`thread.started`, `turn.started`,
`item.started`, `item.completed`, `turn.completed`) contains no model or configuration field.

Subsequent cases record a `run` block per arm carrying the analyst version, whether a model was
pinned, the argv and prompt hashes, and the arm order.

## 8. Conclusion

We contribute a harness for controlled evaluation of alert-assisted agent analysis: blind control
arm, frozen hash-manifested evidence, mechanically-derived ground truth, explicit abstention, and a
provably effect-free shadow.

Applied to 11 cases it produced two observations worth testing properly: that the benefit of
assistance is concentrated in deep cases and absent in shallow ones, and that identical case-level
verdicts can conceal a directional shift in per-target judgment toward confirming the alert and
toward acting rather than inspecting.

Both remain hypotheses. The instrument is the result.

---

## Appendix A — Signal naming

The two signal types are reported as `signal_A` and `signal_B` rather than by their names in the
source deployment. The distinction that matters analytically is depth, not identity:

- **`signal_A`** — a deep condition spanning multiple records per target; 74k–136k tokens for the
  blind arm; 3–5 targets per case.
- **`signal_B`** — a shallow reachability condition; ~29k tokens either arm; 2–4 targets per case.

No result depends on the underlying names. The mapping is held by the authors.
