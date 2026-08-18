# A Blind-Control Harness for Measuring Alert-Assisted Agent Analysis

**Status:** Preprint draft — instrument description with preliminary, underpowered observations.
**Data:** `data/per-case.csv`, `data/aggregate.json`, `data/adjudication.json`
**Version:** draft-02

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

Ground truth was subsequently derived for 34 of the 35 targets by a frozen deterministic predicate,
and the whole corpus was re-analysed by a second, independently-configured analyst. Against that
ground truth the directional finding **replicates across both analysts**: assistance raised
labelling accuracy (+12.9pp and +2.9pp) and reduced restraint, the assisted arm proposing action
rather than inspection on records whose blocker the evidence corroborates (+15.0pp and +18.2pp).
The restraint effect is the more robust of the two. A constructed negative control — a record
accused by the alert that the frozen evidence shows no defect in — was rejected by both arms, so
the effect concerns what to do about genuinely blocked records, not credulity toward the alarm as
such.

These observations remain **hypothesis-generating, not confirmatory**. For this corpus the harness
did not record model identity per arm, ran one trial per arm per case, and ran the arms in a fixed
order; none of that can be retrofitted to data already collected. We state these limitations
precisely and specify what each would require. The contribution we claim is the instrument.

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

That establishes the condition, not the cause, and so cannot say whether an analyst was *right*
about any individual target. Per-target ground truth is supplied separately, by a frozen
deterministic predicate over the same frozen fields (Appendix B). Five rules, each asserting only
what a record contradicts **about itself**; no rule infers cause, and a rule must fire in *every*
frozen observation or the target abstains. The predicate is code, not a model, and it was frozen
before scoring. Its per-target output for this corpus is `data/adjudication.json`.

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

At the point this was written it was a reading of four targets in one run, with no ground truth
to check it against. §3.4 supplies that ground truth and §3.6 bounds what it means; §4.4 states
what is still missing.

### 3.4 Scored against ground truth: the direction holds

Sections 3.1–3.3 could show only that the arms *differ*. With the per-target predicate of §2.5 in
place, 34 of the 35 targets carry a mechanically-derived classification, and the arms can be
scored. One target abstains: its classification was not stable across every frozen observation, so
the predicate declines to decide it.

| rule | classification | targets |
|---|---|---|
| `rule_A1` | STALE_CONTRADICTION | 2 |
| `rule_A2` | LEGITIMATE_BLOCKER | 22 |
| `rule_A3` | FALSE_OR_TRANSIENT | 0 live |
| `rule_B1` | STALE_CONTRADICTION | 0 |
| `rule_B2` | LEGITIMATE_BLOCKER | 10 |
| — | UNADJUDICATED (abstained) | 1 |

Two measures, answering different questions:

- **Accuracy** — did the arm label the target the way the frozen predicate does.
- **Restraint** — on a `signal_A` target whose blocker the record *corroborates*, the defensible
  moves are `inspect_only` and `no_action`. Anything else is acting where inspection was
  warranted. `signal_B` targets are excluded: restoring an unreachable resource is the ordinary
  response there, not an escalation.

| analyst / arm | cases | accuracy | acted where inspection was warranted |
|---|---|---|---|
| analyst 1 / blind | 10 | 27/31 (87.1%) | 17/20 (85.0%) |
| analyst 1 / assisted | 10 | 31/31 (100%) | 20/20 (100%) |
| | | **+12.9pp** | **+15.0pp** |
| analyst 2 / blind | 11 | 30/34 (88.2%) | 12/22 (54.5%) |
| analyst 2 / assisted | 11 | 31/34 (91.2%) | 16/22 (72.7%) |
| | | **+2.9pp** | **+18.2pp** |

The alert improves labelling and reduces restraint, and **both effects replicate in direction
across two analysts**. They are not equally robust: the restraint effect is comparable in size on
both (+15.0 and +18.2pp), while the accuracy gain is much weaker on the second analyst (+12.9 vs
+2.9pp). The anchoring hypothesis of §3.3 is therefore no longer a reading of four targets in one
run; it is a directional effect measured against ground truth on two analysts. It is still small
in absolute terms — see §4.4.

`signal_B` scores 100% in all four arms and discriminates nothing. All signal is in `signal_A`.

A caution about reading sub-corpora: at an interim n=5 the second analyst appeared to *reverse* the
restraint effect (−23.1pp). That did not survive the full 11 cases.

### 3.5 A second analyst

The corpus was re-analysed end to end by a second analyst — `claude-opus-5` via the `claude` CLI
2.1.223 — on the same frozen inputs, the same output schema, and **byte-identical prompts**. Both
arm prompts were extracted to a shared module and verified character-for-character against the
revision that produced the original corpus (blind 572 characters, alert-assisted 562). Per-run
provenance is recorded: CLI version, model, whether the model was pinned, arm order, and argv and
prompt digests.

Two differences are recorded rather than smoothed over. This CLI does not resolve the 2020-12
meta-schema by URL, so `$schema` is dropped while every constraint is kept — the dropped dialect
and the original schema digest are in each run record. And it reports no reasoning-token count, so
that metric does not cross analysts.

The second analyst does **not** de-confound the first; see §4.6 and §4.9.

### 3.6 Negative control: the arms rejected a false accusation

Every case in the corpus exists because the detector believed something. Such a corpus can measure
agreement with a *correct* alarm and nothing else — an analyst that reads the evidence and one that
ratifies the accusation produce the same answer on every case in it.

A constructed case supplies the missing condition: verbatim frozen records, with one settled
target — no blocker, no outstanding remedy — added to the accused set. The correct answer is to
reject the accusation.

**Both arms rejected it**, classifying it `FALSE_OR_TRANSIENT` and proposing no action. The
alert-assisted arm reasoned that the accused condition was *"positively absent, not merely
unevidenced."*

So on this control the alert did not override clear contradicting evidence. That materially bounds
the interpretation of §3.4: the restraint effect concerns what to do about records that really are
blocked, not credulity toward the alarm as such. One constructed control is one observation, not a
rate.

The case is marked synthetic in every artifact, carries a `synthetic-` id prefix, and is admitted
to a run only by an explicit flag, so no scan for live cases can pool it with real traffic.

## 4. Limitations

These are disqualifying for a causal claim and we state them plainly.

**4.1 No model or configuration is recorded per arm.** `measurements` contains only `elapsed_ms`,
`token_usage` and `output_sha256`. Nothing identifies which model, settings, or temperature each arm
used. We cannot demonstrate the arms were matched on anything but input. This alone prevents the
cost comparison from supporting a causal claim, and it cannot be retrofitted to the existing 11 cases.

**4.2 One trial per arm per case.** With a stochastic analyst, a single blind run and a single
assisted run cannot separate treatment effect from run-to-run variance. The tight `signal_B`
clustering suggests low variance in that regime; variance in the deep regime is unmeasured.

**4.3 Ground truth is a predicate, not an oracle.** *Superseded in part.* An earlier draft recorded
one hand-adjudicated target; 34 of 35 are now adjudicated mechanically (§2.5, §3.4), which is what
makes §3.4 possible at all. What remains is that the predicate is a frozen rule set over the same
frozen fields the analysts read. It asserts only what a record contradicts about itself; it does
not observe the world. Where a record is internally consistent and wrong, the predicate is wrong
with it, and both arms are scored against that error identically.

**4.4 The effect is directional, replicated, and small.** *Superseded in part.* The anchoring
observation is no longer four targets inside one run: it is scored against ground truth on two
analysts and holds in direction on both (§3.4). But the absolute quantities are small. The larger
restraint delta, +18.2pp, is 4 targets out of 22. The accuracy delta on the second analyst, +2.9pp,
is a single target. Effects this size on a corpus this size are consistent with a real shift and
also with noise, which is precisely why §5.2 and §5.4 come before any confirmatory claim.

**4.5 Scope.** One orchestration system, one operator, two signal types, cases spanning 2026-08-13
to 2026-08-17. Two analysts, which addresses analyst identity but not deployment, operator or
signal diversity. No claim generalises beyond this deployment.

**4.6 Arm order was fixed, not merely unrecorded.** In the code that produced these 11 cases, the
blind arm always ran first and the assisted arm always second. Order is therefore perfectly
confounded with treatment, and any order effect — including provider-side caching warmed by the
first run — is indistinguishable from the alert's effect. This is the most serious confound after
§4.1. It has since been corrected, and the first correction was itself wrong: deriving order from
each case-id hash independently is deterministic but not balanced, and on this corpus produced 7
blind-first to 4. Order is now assigned by ranking the corpus by hash and splitting the ranking,
which is reproducible per case and even to within one across the corpus. Neither correction applies
to the 11 cases already collected.

**4.7 Selection.** Cases are opened by a persistence detector, not sampled. The population is
"signals that persisted," not "signals." The negative control of §3.6 addresses a different problem
— that every case had a *correct* alarm — and does not correct this one.

**4.8 One adjudication rule was revised after seeing analyst output.** The first version of the
`signal_B` rule classified an enrolled-but-unreachable resource as a `STALE_CONTRADICTION`. Both
analysts independently rejected that on all ten such targets, and they were right: an enrolled
resource that is down is a corroborated blocker, not a record contradicting itself. The rule was
rewritten. The consequence for interpretation is that **`signal_B` agreement is partly circular and
is not independent evidence.** The `signal_A` rules were derived from the frozen field table and
one hand-adjudicated target before any analyst output was read, so `signal_A` is the clean subset —
which is also where all the signal is (§3.4).

**4.9 The second analyst does not de-confound the first.** Its arm order was assigned by the
per-case-id hash described in §4.6, which came out 7 blind-first to 4 rather than balanced. The
corrected assignment applies to runs from here on, not to anything already collected. The second
analyst therefore establishes that the direction is not an artifact of one analyst; it does not
establish that the direction is not an artifact of order.

**4.10 A defect this corpus concealed.** Every `signal_B` target is a resource, but the adjudicator
resolved targets only against the record collection. All ten were returned `UNADJUDICATED` with the
reason *"not present in every frozen observation"* — which was false. They were present, under a
key nobody searched. Those ten were silently unscoreable for the whole study, and nothing in the
output indicated it, because a wrongly-abstaining instrument and a properly-cautious one produce
identical records. We report this because abstention-by-default makes the failure mode invisible by
construction, and any harness built this way inherits it. The harness now requires an adapter to
report which collections it searched, and refuses to state an absence it did not verify.

## 5. What would make this a finding

In dependency order. Items marked **[harness]** are implemented and apply to runs from here on;
none of them repairs the 11 cases already collected.

1. **Record model and configuration per arm.** Without this nothing downstream is interpretable.
   **[harness]** Pinning is now the default rather than opt-in, and the runner refuses to start on
   an unrecorded model unless the caller explicitly puts that on the record. This mattered: pinning
   had been gated behind a flag that nothing set, so the default path recorded an unpinned model
   and silently reproduced §4.1 — the exact defect the flag existed to prevent.
2. **Repeat each arm ≥3 times per case** to obtain variance and error bars. **[harness]** Three
   trials per arm is the default, each scored against the same frozen adjudication. Trials are
   additive — an existing case is topped up rather than re-run, and no finished trial is discarded.
3. **Randomise arm order.** **[harness]** Assigned by ranking the corpus by hash and splitting the
   ranking: reproducible per case, even to within one across the corpus. See §4.6 for the first
   attempt, which was deterministic without being balanced.
4. **Complete the queued cases.** 11 further cases are held at `awaiting_blind_validation`; n=22
   would roughly double the evidence and particularly help `signal_B` (n=4). This is the binding
   constraint on everything above: three trials over eleven queued cases is sixty-six analyst
   calls, which exhausted an analyst quota and stalled the study for two days. Cases per invocation
   are now capped, and a runner that meets a quota outage aborts and requeues rather than marking
   cases failed and retiring them permanently.
5. **Adjudicate targets.** **Done** — 34 of 35 (§2.5, §3.4). What this bought is §3.4; what it did
   not buy is §4.3.
6. **A second analyst.** **Done** — §3.5. Establishes the direction is not an artifact of one
   analyst; does not address order (§4.9).
7. **A negative control.** **Done** — §3.6. One constructed case is one observation. A *rate* of
   false-accusation rejection needs a population of them.
8. **Add signal types**, to test whether depth — rather than signal identity — predicts the effect.
   Untouched, and now the clearest gap: `signal_B` discriminates nothing, so the depth hypothesis
   currently rests on a two-point contrast.

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

Subsequent cases record a `run` block per arm carrying the analyst version, the model and whether
it was pinned, the argv and prompt hashes, the trial number, and the arm order together with
whether that order was balanced across a corpus. Per-trial scores are retained alongside the
primary trial, so a reader can see the spread rather than a single draw.

The per-target adjudication (§2.5) is likewise reproducible without trusting the operator: it is a
frozen predicate over fields already present in the frozen evidence, so a third party holding a
case directory can re-derive every classification in `data/adjudication.json` and check it against
what each arm said.

## 8. Conclusion

We contribute a harness for controlled evaluation of alert-assisted agent analysis: blind control
arm, frozen hash-manifested evidence, mechanically-derived ground truth, explicit abstention, and a
provably effect-free shadow.

Applied to 11 cases it produced two observations worth testing properly: that the benefit of
assistance is concentrated in deep cases and absent in shallow ones, and that identical case-level
verdicts can conceal a directional shift in per-target judgment toward confirming the alert and
toward acting rather than inspecting.

The second of those has since been scored against ground truth on 34 of 35 targets and re-run by a
second analyst, and it holds in direction on both: assistance raised accuracy and reduced restraint
(§3.4). A constructed negative control bounds what that means — the assisted arm rejected a false
accusation, so the effect is about what to do with genuinely blocked records rather than credulity
toward the alarm (§3.6). The quantities remain small, one adjudication rule is circular, and arm
order is still confounded in the collected data (§4.4, §4.8, §4.9).

So: a replicated direction, not a confirmed effect. The instrument remains the result — and the
most useful thing it produced is the list of its own defects in §4, three of which (§4.6's first
correction, §4.9, §4.10) were invisible until something was measured against them.

---

## Appendix A — Signal naming

The two signal types are reported as `signal_A` and `signal_B` rather than by their names in the
source deployment. The distinction that matters analytically is depth, not identity:

- **`signal_A`** — a deep condition spanning multiple records per target; 74k–136k tokens for the
  blind arm; 3–5 targets per case.
- **`signal_B`** — a shallow reachability condition; ~29k tokens either arm; 2–4 targets per case.

No result depends on the underlying names. The mapping is held by the authors.

## Appendix B — The adjudication predicate

Five rules, reported by structure rather than by the source deployment's field names. Each asserts
only what a record contradicts **about itself**; none infers cause; none authorizes an action. A
rule must fire in *every* frozen observation for the target to be classified at all — a
classification that holds in one observation and not another is not persistent, and a
non-persistent classification is not evidence.

| rule | applies to | classification | fires when |
|---|---|---|---|
| `rule_A1` | `signal_A` targets | STALE_CONTRADICTION | the recorded blocker asserts an artifact is missing while the same frozen record carries that artifact and complete passing remedy evidence for it |
| `rule_A2` | `signal_A` targets | LEGITIMATE_BLOCKER | a blocker is recorded and the same record carries no artifact and no remedy evidence, so nothing contradicts it |
| `rule_A3` | `signal_A` targets | FALSE_OR_TRANSIENT | the record is settled in a passing terminal state with no blocker and no outstanding remedy, so the accused condition is positively absent rather than merely unevidenced |
| `rule_B1` | `signal_B` targets | STALE_CONTRADICTION | the resource is reported unreachable while the same observation shows it holding a claim on live work |
| `rule_B2` | `signal_B` targets | LEGITIMATE_BLOCKER | the resource is reported unreachable in every frozen observation and nothing shows it executing |

`rule_A3` exists to make the negative control of §3.6 adjudicable: without a classification for "the
accusation is wrong", a false accusation can only return `UNADJUDICATED`, which scores nothing and
tests nothing. It is deliberately narrow — the absence of a recorded defect on a record nobody
finished examining is not evidence of health — and it fires on no live target in this corpus.

`rule_B1` and `rule_B2` carry the caveat in §4.8: the pair was rewritten after both analysts
rejected an earlier version, so `signal_B` agreement is not independent evidence.

The equivalent rules for a fabricated domain, runnable with no credentials, are in
`adapters/synthetic.mjs`.
