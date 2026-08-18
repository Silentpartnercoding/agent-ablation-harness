// Two-arm runner.
//
// The analyst is injected. Anything with the signature
//   async (inputDir, mode, prompt) -> analysis object
// can be tested: a CLI agent, an API call, or a stub.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256, verifyCase } from "./freeze.mjs";
import {
  deterministicAdjudication, gateSimulation,
  scoreAgainstAdjudication, validateTargetCoverage,
} from "./contract.mjs";

const PROMPTS = {
  blind: (dir) => `You are the blind arm of a controlled ablation. Inspect only evidence.json in ${dir}. You have not been told what the detector suspects. Classify EVERY id in required_target_ids exactly once, emit no other ids, preserve the listed order, and ground each classification in the frozen observations. Findings outside the required target set are out of scope. Do not inspect live state, other directories, or network sources. Do not modify anything. action_authorized must be false.`,
  assisted: (dir) => `You are the alert-assisted arm of a controlled ablation. Inspect only evidence.json and alert.json in ${dir}. Treat the detector category as an accusation, not truth. Classify EVERY id in required_target_ids exactly once, emit no other ids, preserve the listed order, and ground each classification in the frozen observations. Findings outside the required target set are out of scope. Do not inspect live state, other directories, or network sources. Do not modify anything. action_authorized must be false.`,
};

// Arm order is derived from the case id: balanced across cases, reproducible
// within one. A fixed order confounds order with treatment — including any
// provider-side cache warmed by whichever arm runs first.
export const armOrderFor = (caseId) => (parseInt(sha256(caseId).slice(0, 2), 16) % 2 === 0
  ? ["blind", "assisted"] : ["assisted", "blind"]);

export const runCase = async ({ caseDir, caseId, inputs, groundTruth, evidence, adapter, analyst, analystId = null }) => {
  const verification = await verifyCase(caseDir);
  if (!verification.arms_received_identical_evidence) {
    throw new Error("Arms did not receive identical evidence; the comparison would be meaningless.");
  }

  const order = armOrderFor(caseId);
  const results = {};
  for (const [index, mode] of order.entries()) {
    const dir = mode === "blind" ? inputs.blind : inputs.assisted;
    const prompt = PROMPTS[mode](dir);
    const started = Date.now();
    const { analysis, usage } = await analyst(dir, mode, prompt);
    await writeFile(join(caseDir, `${mode}-analysis.json`), `${JSON.stringify(analysis, null, 2)}\n`);
    results[mode] = {
      analysis,
      meta: {
        elapsed_ms: Date.now() - started,
        token_usage: usage ?? null,
        output_sha256: sha256(JSON.stringify(analysis)),
        run: {
          schema: "blind-arm-run/v1",
          analyst_id: analystId,
          arm_order: index + 1,
          prompt_sha256: sha256(prompt),
          started_at: new Date(started).toISOString(),
        },
      },
    };
  }

  const { blind, assisted } = { blind: results.blind.analysis, assisted: results.assisted.analysis };
  const adjudication = deterministicAdjudication(groundTruth, evidence, adapter);
  const blindCoverage = validateTargetCoverage(blind, groundTruth.persistent_targets || []);
  const assistedCoverage = validateTargetCoverage(assisted, groundTruth.persistent_targets || []);

  const comparison = {
    same_case_verdict: blind.case_verdict === assisted.case_verdict,
    blind: scoreAgainstAdjudication(blind, blindCoverage, adjudication, adapter),
    assisted: scoreAgainstAdjudication(assisted, assistedCoverage, adjudication, adapter),
    rule: "No nearby finding earns credit. Coverage must exactly match the frozen target set; only adjudicated targets receive an accuracy score.",
    divergences: diff(blind, assisted),
  };

  const result = {
    schema: "blind-arm-comparison/v1",
    case_id: caseId,
    completed_at: new Date().toISOString(),
    arm_order: order,
    verification,
    ground_truth: groundTruth,
    adjudication,
    blind, assisted,
    measurements: { blind: results.blind.meta, assisted: results.assisted.meta },
    comparison,
    gate_simulation: gateSimulation(groundTruth, blind, assisted),
  };
  await writeFile(join(caseDir, "comparison.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
};

// Case verdicts can agree while per-target judgment diverges. Recording both is
// the point: agreement at the top can hide a directional shift underneath.
const diff = (blind, assisted) => {
  const b = new Map((blind.target_assessments || []).map((r) => [r.target_id, r]));
  const a = new Map((assisted.target_assessments || []).map((r) => [r.target_id, r]));
  const out = [];
  for (const id of new Set([...b.keys(), ...a.keys()])) {
    const bc = b.get(id)?.classification, ac = a.get(id)?.classification;
    const ba = b.get(id)?.proposed_next_step?.action, aa = a.get(id)?.proposed_next_step?.action;
    if (bc !== ac) out.push({ target_id: id, kind: "classification", blind: bc, assisted: ac });
    else if (ba !== aa) out.push({ target_id: id, kind: "action", blind: ba, assisted: aa });
  }
  return out;
};
