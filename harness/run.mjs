// Two-arm runner.
//
// The analyst is injected. Anything with the signature
//   async (inputDir, mode, prompt) -> analysis object
// can be tested: a CLI agent, an API call, or a stub.

import { readFile, writeFile } from "node:fs/promises";
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

// Arm order must be BOTH deterministic (so a case reproduces) and balanced (so
// order is not confounded with treatment, including any provider-side cache
// warmed by whichever arm runs first).
//
// Hashing a single case id gives the first property only. The assignment is
// fixed per id, so across any particular set of cases it lands wherever it
// lands: on the 11-case corpus in PAPER.md, sha256(id) % 2 came out 7 blind-
// first to 4. Better than a fixed order, still not balance.
//
// Ranking the corpus by hash and splitting the ranking gives both. The order is
// still a pure function of the case ids, and the split is exactly even to
// within one. It costs one thing: you must know the id set up front.
export const blindRunsFirst = (caseId, corpus) => {
  const ranked = [...new Set(corpus)].sort((a, b) => {
    const ha = sha256(a);
    const hb = sha256(b);
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  return ranked.indexOf(caseId) < Math.ceil(ranked.length / 2);
};

// Pass the whole corpus whenever you have it. Without it this falls back to
// per-id parity, which reproduces but does not balance — so it says so, in the
// returned value, rather than letting a caller believe otherwise.
export const armOrderFor = (caseId, corpus = null) => {
  const balanced = Array.isArray(corpus) && corpus.includes(caseId);
  const blindFirst = balanced
    ? blindRunsFirst(caseId, corpus)
    : parseInt(sha256(caseId).slice(0, 2), 16) % 2 === 0;
  const order = blindFirst ? ["blind", "assisted"] : ["assisted", "blind"];
  order.balanced = balanced;
  return order;
};

// One trial per arm per case cannot separate a treatment effect from run-to-run
// variance: with a stochastic analyst, a single blind run and a single assisted
// run differ for two reasons at once and the run records cannot say which.
// Three trials is the default for that reason, not for cost.
const DEFAULT_TRIALS = 3;

export const runCase = async ({
  caseDir, caseId, inputs, groundTruth, evidence, adapter, analyst,
  analystId = null,
  // The corpus of case ids this case belongs to. Supply it: without it arm order
  // reproduces but does not balance (see armOrderFor).
  corpus = null,
  trials = DEFAULT_TRIALS,
  // The analyst model, recorded per arm. Pinning is the DEFAULT here, not an
  // opt-in, because an opt-in that nothing sets is not a control: it silently
  // produces exactly the unrecorded-model defect it was added to prevent.
  model = null,
  allowUnpinnedModel = false,
}) => {
  if (!model && !allowUnpinnedModel) {
    throw new Error(
      "No analyst model given. Two arms cannot be shown to have been matched on "
      + "a model that was never recorded. Pass `model`, or pass "
      + "`allowUnpinnedModel: true` to state on the record that this run is unpinned.",
    );
  }
  const verification = await verifyCase(caseDir);
  if (!verification.arms_received_identical_evidence) {
    throw new Error("Arms did not receive identical evidence; the comparison would be meaningless.");
  }

  const order = armOrderFor(caseId, corpus);
  const adjudication = deterministicAdjudication(groundTruth, evidence, adapter);
  const required = groundTruth.persistent_targets || [];
  const scoreArm = (analysis) =>
    scoreAgainstAdjudication(analysis, validateTargetCoverage(analysis, required), adjudication, adapter);

  // Trials are additive. A case that already holds finished trials is topped up
  // to the target, never re-run from scratch: a completed trial is data, and
  // discarding it to satisfy a loop counter would be discarding evidence.
  const completed = await priorTrials(caseDir);
  if (completed.length > trials) {
    throw new Error(
      `Case already holds ${completed.length} trials; asking for ${trials} would discard `
      + "completed trials. Raise `trials`, or read the existing comparison.",
    );
  }

  const runTrial = async (n) => {
    const trial = { trial: n, analyses: {}, measurements: {} };
    for (const [index, mode] of order.entries()) {
      const dir = mode === "blind" ? inputs.blind : inputs.assisted;
      const prompt = PROMPTS[mode](dir);
      const started = Date.now();
      const { analysis, usage } = await analyst(dir, mode, prompt);
      await writeFile(join(caseDir, `${mode}-analysis-trial${n}.json`), `${JSON.stringify(analysis, null, 2)}\n`);
      trial.analyses[mode] = analysis;
      trial.measurements[mode] = {
        elapsed_ms: Date.now() - started,
        token_usage: usage ?? null,
        output_sha256: sha256(JSON.stringify(analysis)),
        run: {
          schema: "blind-arm-run/v2",
          analyst_id: analystId,
          model,
          // Recorded, not inferred. A reader can tell a pinned run from an
          // acknowledged-unpinned one without trusting the operator's memory.
          model_pinned: Boolean(model),
          trial: n,
          arm_order: index + 1,
          arm_order_balanced: order.balanced === true,
          prompt_sha256: sha256(prompt),
          started_at: new Date(started).toISOString(),
        },
      };
    }
    return trial;
  };

  const all = [...completed];
  while (all.length < trials) all.push(await runTrial(all.length + 1));

  // Trial 1 is the primary. It is also restored to the canonical filenames, so
  // what is on disk matches what comparison.json reports, and readers written
  // against the single-trial shape keep working unchanged.
  const primary = all[0];
  const blind = primary.analyses.blind;
  const assisted = primary.analyses.assisted;
  for (const mode of ["blind", "assisted"]) {
    await writeFile(join(caseDir, `${mode}-analysis.json`), `${JSON.stringify(primary.analyses[mode], null, 2)}\n`);
  }

  const comparison = {
    same_case_verdict: blind.case_verdict === assisted.case_verdict,
    blind: scoreArm(blind),
    assisted: scoreArm(assisted),
    rule: "No nearby finding earns credit. Coverage must exactly match the frozen target set; only adjudicated targets receive an accuracy score.",
    divergences: diff(blind, assisted),
  };

  const result = {
    schema: "blind-arm-comparison/v2",
    case_id: caseId,
    completed_at: new Date().toISOString(),
    arm_order: [...order],
    arm_order_balanced: order.balanced === true,
    verification,
    ground_truth: groundTruth,
    adjudication,
    blind, assisted,
    measurements: { blind: primary.measurements.blind, assisted: primary.measurements.assisted },
    trials: all.length,
    // Every trial, scored against the same frozen adjudication. Variance lives
    // here; the primary fields above are one draw from it.
    repeats: all.map((t) => ({
      trial: t.trial,
      measurements: t.measurements,
      blind: scoreArm(t.analyses.blind),
      assisted: scoreArm(t.analyses.assisted),
      same_case_verdict: t.analyses.blind.case_verdict === t.analyses.assisted.case_verdict,
      divergences: diff(t.analyses.blind, t.analyses.assisted),
    })),
    comparison,
    gate_simulation: gateSimulation(groundTruth, blind, assisted),
  };
  await writeFile(join(caseDir, "comparison.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
};

// Finished trials already on disk, in order, stopping at the first gap. Their
// measurements come from the previous comparison so a topped-up case reports
// the same numbers it reported before.
const priorTrials = async (caseDir) => {
  let previous = null;
  try {
    previous = JSON.parse(await readFile(join(caseDir, "comparison.json"), "utf8"));
  } catch { return []; }
  const out = [];
  for (let n = 1; ; n += 1) {
    const analyses = {};
    for (const mode of ["blind", "assisted"]) {
      try {
        analyses[mode] = JSON.parse(await readFile(join(caseDir, `${mode}-analysis-trial${n}.json`), "utf8"));
      } catch { return out; }
    }
    const recorded = (previous.repeats || []).find((r) => r.trial === n);
    if (!recorded) return out;
    out.push({ trial: n, analyses, measurements: recorded.measurements });
  }
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
