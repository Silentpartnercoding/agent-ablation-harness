#!/usr/bin/env node
// End-to-end demonstration on fabricated data. No credentials, no network,
// no real system. Run:  node examples/demo.mjs
//
// The analyst below is a STUB with scripted outputs — it is NOT a model and its
// answers are NOT a result. It exists so the harness mechanics are observable:
// freezing, hash verification, exact-match coverage, abstention, balanced arm
// order, repeated trials, divergence detection, and the negative control.
// Swap it for a real analyst to run an actual ablation.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freezeCase, mechanicalGroundTruth, verifyCase } from "../harness/freeze.mjs";
import { armOrderFor, runCase } from "../harness/run.mjs";
import * as synthetic from "../adapters/synthetic.mjs";

const c = synthetic.generateCase("demo");
const negative = synthetic.generateNegativeControl("negative");
const caseId = "case-demo-0001";
// Arm order balances across a corpus, so the corpus is an input. Passing one
// case id at a time reproduces but does not balance — see armOrderFor.
const corpus = [caseId, negative.case_id];

const caseDir = await mkdtemp(join(tmpdir(), "blind-arm-"));
const inputs = await freezeCase(caseDir, {
  evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids,
});
const v = await verifyCase(caseDir);
console.log("FREEZE + VERIFY");
console.log(`  manifest intact ............. ${v.manifest_intact}`);
console.log(`  arms got identical evidence . ${v.arms_received_identical_evidence}`);
console.log(`  evidence sha256 ............. ${v.blind_evidence_sha256?.slice(0, 16)}…\n`);

const truth = mechanicalGroundTruth(c.signal, c.observations, c.targetsPerObservation);
console.log("MECHANICAL GROUND TRUTH");
console.log(`  classification .............. ${truth.classification}`);
console.log(`  persistent targets .......... ${truth.persistent_targets.length}\n`);

// --- STUB ANALYST: scripted, not a model ---------------------------------
const assess = (id, classification, action) => ({
  target_id: id, classification,
  evidence: [{ claim: "Present in both frozen observations.", support: "stub" }],
  proposed_next_step: { action, why: "stub", risk: "low" },
});
const stubAnalyst = async (_dir, mode) => {
  const [d1, d2, d3, p1] = c.evidence.required_target_ids;
  const conservative = mode === "blind";
  return {
    analysis: {
      case_verdict: "TRUE",
      action_authorized: false,
      target_assessments: [d1, d2, d3, p1].map((id) => {
        const isProcessor = id.startsWith("proc");
        if (isProcessor) return assess(id, "LEGITIMATE_BLOCKER", "inspect_only");
        // Scripted divergence: the blind stub inspects; the assisted stub acts.
        return conservative
          ? assess(id, "LEGITIMATE_BLOCKER", "inspect_only")
          : assess(id, "LEGITIMATE_BLOCKER", "reconcile_output_record");
      }),
    },
    usage: { input_tokens: conservative ? 90000 : 50000, cached_input_tokens: conservative ? 60000 : 28000, output_tokens: conservative ? 1700 : 1000 },
  };
};

const result = await runCase({
  caseDir, caseId, inputs, groundTruth: truth, evidence: c.evidence,
  adapter: synthetic, analyst: stubAnalyst, analystId: "stub/scripted-v1",
  corpus,
  // A scripted stub has no model. Saying so explicitly is the point: the runner
  // refuses to proceed on an unrecorded model unless the caller states it.
  allowUnpinnedModel: true,
});

console.log("TWO-ARM RUN");
console.log(`  arm order ................... ${result.arm_order.join(" then ")}`);
console.log(`  order balanced over corpus .. ${result.arm_order_balanced}`);
console.log(`  trials per arm .............. ${result.trials}`);
console.log(`  same case verdict ........... ${result.comparison.same_case_verdict}`);
console.log(`  blind coverage passed ....... ${result.comparison.blind.target_contract_passed}`);
console.log(`  assisted coverage passed .... ${result.comparison.assisted.target_contract_passed}`);
console.log(`  scoring status .............. ${result.comparison.blind.status}`);
console.log(`  adjudicated targets ......... ${result.comparison.blind.adjudicated_targets} of ${truth.persistent_targets.length}`);
console.log(`  production effects .......... ${result.gate_simulation.production_effects}\n`);

console.log("PER-TRIAL SCORES (variance lives here; a scripted stub has none by construction)");
for (const r of result.repeats) {
  console.log(`  trial ${r.trial}:  blind ${r.blind.correct_adjudicated_targets}/${r.blind.adjudicated_targets}`
    + `   assisted ${r.assisted.correct_adjudicated_targets}/${r.assisted.adjudicated_targets}`
    + `   divergences ${r.divergences.length}`);
}
console.log();

console.log("DIVERGENCES DETECTED (identical verdict, different judgment)");
for (const d of result.comparison.divergences) {
  console.log(`  ${d.target_id}  ${d.kind}:  blind=${d.blind}  assisted=${d.assisted}`);
}
if (!result.comparison.divergences.length) console.log("  none");

console.log("\nAdjudication (abstention is the default, never a guess):");
for (const t of result.adjudication.targets) {
  console.log(`  ${t.target_id}  ${t.classification}${t.rule_id ? `  [${t.rule_id}]` : ""}`);
}
await rm(caseDir, { recursive: true, force: true });

// --- NEGATIVE CONTROL ------------------------------------------------------
// Every live case exists because the detector believed something, so the live
// corpus can only measure agreement with a CORRECT alarm. Here one accused
// record carries no defect, and the correct answer is to reject the accusation.
const negDir = await mkdtemp(join(tmpdir(), "blind-arm-neg-"));
const negInputs = await freezeCase(negDir, {
  evidence: negative.evidence, alert: negative.alert,
  requiredTargets: negative.evidence.required_target_ids,
});
const negTruth = mechanicalGroundTruth(negative.signal, negative.observations, negative.targetsPerObservation);
const negAdjudication = await runCase({
  caseDir: negDir, caseId: negative.case_id, inputs: negInputs,
  groundTruth: negTruth, evidence: negative.evidence, adapter: synthetic,
  corpus, allowUnpinnedModel: true, trials: 1, analystId: "stub/credulous-v1",
  // A stub that ratifies whatever it is shown — the failure mode the control
  // exists to catch. A real analyst that reads the evidence rejects the
  // accusation instead, and this control is where that difference shows up.
  analyst: async (_dir, mode) => ({
    analysis: {
      case_verdict: "TRUE",
      action_authorized: false,
      target_assessments: negative.evidence.required_target_ids.map((id) =>
        assess(id, "LEGITIMATE_BLOCKER", mode === "blind" ? "inspect_only" : "reconcile_output_record")),
    },
    usage: null,
  }),
});

const accused = negAdjudication.adjudication.targets.find((t) => t.target_id === negative.accused_but_healthy);
const negCredulous = negAdjudication.blind.target_assessments
  .find((t) => t.target_id === negative.accused_but_healthy)?.classification;
console.log("\nNEGATIVE CONTROL (the detector is WRONG about one accused record)");
console.log(`  case ........................ ${negAdjudication.case_id} (synthetic)`);
console.log(`  accused-but-healthy record .. ${negative.accused_but_healthy}`);
console.log(`  frozen predicate says ....... ${accused?.classification}  [${accused?.rule_id}]`);
console.log(`  credulous stub scored ....... blind ${negAdjudication.comparison.blind.correct_adjudicated_targets}`
  + `/${negAdjudication.comparison.blind.adjudicated_targets}`
  + `   assisted ${negAdjudication.comparison.assisted.correct_adjudicated_targets}`
  + `/${negAdjudication.comparison.assisted.adjudicated_targets}`);
console.log(`  it labelled the healthy record ..... ${negCredulous}`);
console.log("  A live-only corpus contains no record whose correct answer is");
console.log("  'reject'. This one does, so ratifying the alert now costs a point");
console.log("  that no amount of live traffic could ever have charged.");
await rm(negDir, { recursive: true, force: true });
