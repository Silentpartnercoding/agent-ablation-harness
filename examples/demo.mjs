#!/usr/bin/env node
// End-to-end demonstration on fabricated data. No credentials, no network,
// no real system. Run:  node examples/demo.mjs
//
// The analyst below is a STUB with scripted outputs — it is NOT a model and its
// answers are NOT a result. It exists so the harness mechanics are observable:
// freezing, hash verification, exact-match coverage, abstention, and divergence
// detection. Swap it for a real analyst to run an actual ablation.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freezeCase, mechanicalGroundTruth, verifyCase } from "../harness/freeze.mjs";
import { runCase } from "../harness/run.mjs";
import * as synthetic from "../adapters/synthetic.mjs";

const c = synthetic.generateCase("demo");
const caseDir = await mkdtemp(join(tmpdir(), "blind-arm-"));
const caseId = "case-demo-0001";

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
});

console.log("TWO-ARM RUN");
console.log(`  arm order ................... ${result.arm_order.join(" then ")}`);
console.log(`  same case verdict ........... ${result.comparison.same_case_verdict}`);
console.log(`  blind coverage passed ....... ${result.comparison.blind.target_contract_passed}`);
console.log(`  assisted coverage passed .... ${result.comparison.assisted.target_contract_passed}`);
console.log(`  scoring status .............. ${result.comparison.blind.status}`);
console.log(`  adjudicated targets ......... ${result.comparison.blind.adjudicated_targets} of ${truth.persistent_targets.length}`);
console.log(`  production effects .......... ${result.gate_simulation.production_effects}\n`);

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
