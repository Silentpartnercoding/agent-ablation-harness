# Agent Ablation Harness

A harness for measuring whether **assistance given to an agent changes the judgment it
produces** — by running the same frozen evidence past two arms, one of which never sees the hint.

Agent evaluations usually measure whether an agent reached a correct conclusion. They rarely
measure whether the *inputs supplied to it* moved that conclusion, because the un-hinted
counterfactual is never run. Without it, cost savings and judgment degradation appear in the data
as the same thing: fewer tokens.

```
                     ┌── blind arm ────────► analysis A
frozen evidence ─────┤   (evidence only)
   (hash-manifested) │
                     └── assisted arm ─────► analysis B
                         (evidence + alert)

                     compare: verdict · per-target classification · proposed action · cost
```

## What it guarantees

- **Both arms receive byte-identical evidence.** The evidence is serialised once and the same
  bytes written to both arms — equality is a property of construction, not a coincidence checked
  afterwards. A third party can verify it from the manifest without trusting the operator.
- **Ground truth without a model in the loop.** A condition is confirmed when the same targets
  carry the signal across every frozen observation. No model adjudicates its own test.
- **Abstention is the default.** Anything the rules cannot decide is `UNADJUDICATED` — never
  guessed, never counted correct.
- **Exact-match coverage.** A nearby finding earns no credit.
- **No action authority.** `production_effects: 0` is asserted and recorded per case.
- **Order is not confounded with treatment.** Arm order is derived by ranking the corpus by hash
  and splitting the ranking: reproducible per case *and* balanced to within one across the corpus.
  (Hashing each id independently gives only the first property — on the corpus in `PAPER.md` it
  came out 7 blind-first to 4. Determinism is not balance.)
- **Repeated trials.** Three per arm per case by default, each scored against the same frozen
  adjudication, so a treatment effect can be told apart from run-to-run variance. Trials are
  additive: a case is topped up, never re-run, and no finished trial is discarded.
- **Runs are provenanced, and the model is pinned by default.** Analyst id, model, arm order and
  whether it was balanced, prompt hash, trial number and timing are recorded per arm. The runner
  refuses to start on an unrecorded model unless the caller explicitly puts that on the record —
  an opt-in that nothing sets is not a control.
- **A negative control ships with it.** Every case a detector opens exists because the detector
  believed something, so a live-only corpus cannot separate reading the evidence from ratifying
  the alarm. `generateNegativeControl` accuses a record that carries no defect, where the correct
  answer is to reject the accusation.

## Try it

No credentials, no network, no real system:

```bash
node examples/demo.mjs
```

Runs a fabricated case end to end — freeze, verify, adjudicate, two arms across three trials,
compare — and then runs the negative control past a deliberately credulous analyst to show what it
catches. The analysts in the demo are **stubs with scripted outputs**, not models; they exist so
the mechanics are observable. Swap them for a real analyst to run an actual ablation.

## Layout

```
harness/contract.mjs   coverage, adjudication, scoring, gate simulation
harness/freeze.mjs     freezing, manifests, independent verification
harness/run.mjs        two-arm runner, arm-order randomisation, divergence detection
adapters/synthetic.mjs worked example on fabricated data, plus the negative control
adapters/README.md     the three-function adapter interface
PAPER.md               a study conducted with this harness
data/                  derived results from that study, with a key in data/README.md
docs/BOUNDARY.md       what this repository deliberately does not contain
```

## Using it on your own system

Implement three functions — `resolveTarget`, `rulesFor`, `allowedActions` — and inject an analyst
with the signature `async (inputDir, mode, prompt) -> { analysis, usage }`. See
[`adapters/README.md`](adapters/README.md).

The adapter for the system a study is *about* need not be published; see
[`docs/BOUNDARY.md`](docs/BOUNDARY.md).

## Status

The harness is complete and runnable. `PAPER.md` reports a first application: 11 cases, two signal
types, two analysts, and a mechanically-derived ground truth covering 34 of 35 targets. Its central
observation — that assistance shifts per-target judgment toward confirming the alert and toward
acting rather than inspecting — replicates in direction across both analysts, and remains
**preliminary and underpowered**; §4 states every limitation that still stands.

Five of the limitations that study named are fixed in this harness rather than merely described:
fixed arm order, unbalanced arm order, thin run provenance, single-trial runs, and the absence of a
negative control. §4.1 and §4.6 are permanent for that corpus — they cannot be retrofitted to data
already collected, which is the whole reason they are worth fixing before the next one.

Licensed under Apache-2.0.
