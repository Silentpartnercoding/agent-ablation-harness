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
- **Order is not confounded with treatment.** Arm order is derived from the case id: balanced
  across cases, reproducible within one.
- **Runs are provenanced.** Analyst id, arm order, prompt hash, and timing are recorded per arm.

## Try it

No credentials, no network, no real system:

```bash
node examples/demo.mjs
```

Runs a fabricated case end to end — freeze, verify, adjudicate, two arms, compare. The analyst in
the demo is a **stub with scripted outputs**, not a model; it exists so the mechanics are
observable. Swap it for a real analyst to run an actual ablation.

## Layout

```
harness/contract.mjs   coverage, adjudication, scoring, gate simulation
harness/freeze.mjs     freezing, manifests, independent verification
harness/run.mjs        two-arm runner, arm-order randomisation, divergence detection
adapters/synthetic.mjs worked example on fabricated data
adapters/README.md     the three-function adapter interface
PAPER.md               a study conducted with this harness
data/                  derived results from that study
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
types, with observations that are explicitly **preliminary and underpowered** — see its §4, which
states every disqualifying limitation, including two that this harness now fixes (fixed arm order,
missing run provenance).

Licensed under Apache-2.0.
