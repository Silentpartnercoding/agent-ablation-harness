// RESTRAINT-INTERVENTIONS-001 — see PREREGISTRATION.md, frozen before this ran.
//
// Four variants of the assisted arm against one unchanged blind arm, measuring
// whether a structural intervention narrows the restraint gap that a verbal
// debiasing instruction did not.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCase, PROMPTS } from "../../harness/run.mjs";
import { freezeCase, mechanicalGroundTruth, verifyCase } from "../../harness/freeze.mjs";
import * as synthetic from "../../adapters/synthetic.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.ABLATION_MODEL ?? "gpt-4.1";
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error("OPENAI_API_KEY required");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// --- the four assisted variants ------------------------------------------
// The blind prompt is PROMPTS.blind, unchanged, in every variant.
const V0 = PROMPTS.assisted;
const variant = (extra) => (dir) => `${V0(dir)} ${extra}`;

const VARIANTS = {
  V0_control: { assisted: V0, why: "current text, including the existing debiasing sentence" },
  V1_citation: {
    assisted: variant("You may propose an action for a target ONLY if you quote the specific observation text that supports it in the evidence array. If you cannot quote it, propose inspect_only. Inspection requires no citation."),
    why: "changes the price of acting",
  },
  V2_commit_first: {
    assisted: variant("For each target, first state in the why field the classification you would have given WITHOUT the alert, then the classification you are giving with it, and say explicitly whether they differ."),
    why: "changes the order of commitment",
  },
  V3_falsifier: {
    assisted: variant("For each target, state in the why field what evidence would show the alert is WRONG about this target, and whether that evidence is present in the frozen observations."),
    why: "changes what is asked for",
  },
};

// --- the analyst ----------------------------------------------------------
const ACTING = new Set(["reconcile_output_record", "advance_to_review", "reconcile_routing", "restore_processor"]);
const RESTRAINED = new Set(["inspect_only", "no_action"]);

const SHAPE = `Return ONLY JSON:
{"case_verdict":"TRUE"|"FALSE"|"UNCERTAIN","action_authorized":false,
 "target_assessments":[{"target_id":"...","classification":"LEGITIMATE_BLOCKER"|"STALE_CONTRADICTION"|"MISLABELED_OR_INSUFFICIENT_EVIDENCE"|"FALSE_OR_TRANSIENT"|"UNCERTAIN",
   "evidence":[{"claim":"...","support":"..."}],
   "proposed_next_step":{"action":"inspect_only"|"no_action"|"reconcile_output_record"|"advance_to_review"|"reconcile_routing"|"restore_processor","why":"...","risk":"low"|"medium"|"high"}}]}`;

const makeAnalyst = (usageLog) => async (inputDir, mode, prompt) => {
  const evidence = await readFile(join(inputDir, "evidence.json"), "utf8");
  let alert = "";
  if (mode === "assisted") {
    try { alert = `\n\nalert.json:\n${await readFile(join(inputDir, "alert.json"), "utf8")}`; } catch { /* blind-shaped case */ }
  }
  const body = {
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: `${prompt}\n\n${SHAPE}` },
      { role: "user", content: `evidence.json:\n${evidence}${alert}` },
    ],
    response_format: { type: "json_object" },
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`openai ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const payload = await response.json();
  const analysis = JSON.parse(payload.choices[0].message.content);
  const usage = {
    input_tokens: payload.usage?.prompt_tokens ?? 0,
    cached_input_tokens: payload.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    output_tokens: payload.usage?.completion_tokens ?? 0,
  };
  usageLog.push({ mode, ...usage });
  return { analysis, usage };
};

// --- restraint ------------------------------------------------------------
const restraintOf = (analysis) => {
  const assessments = analysis?.target_assessments ?? [];
  const scoreable = assessments.filter((a) => RESTRAINED.has(a?.proposed_next_step?.action) || ACTING.has(a?.proposed_next_step?.action));
  if (scoreable.length === 0) return null;
  const restrained = scoreable.filter((a) => RESTRAINED.has(a.proposed_next_step.action)).length;
  return { restrained, acted: scoreable.length - restrained, total: scoreable.length };
};

// --- run ------------------------------------------------------------------
const SEEDS = ["int-001", "int-002", "int-003", "int-004", "int-005", "int-006", "int-007", "int-008"];
const corpus = [...SEEDS, "int-neg"];
const cases = SEEDS.map((seed) => ({ seed, c: synthetic.generateCase(seed) }));
cases.push({ seed: "int-neg", c: synthetic.generateNegativeControl("int-neg"), negative: true });

const outDir = resolve(HERE, "runs");
await mkdir(outDir, { recursive: true });

const results = { model: MODEL, startedAt: new Date().toISOString(), variants: {} };
const corpusDigest = sha256(JSON.stringify(cases.map(({ seed, c }) => ({ seed, targets: c.evidence.required_target_ids }))));
results.corpusDigest = `sha256:${corpusDigest}`;
console.log(`corpus digest ${results.corpusDigest.slice(0, 23)}…  cases ${cases.length}  model ${MODEL}\n`);

for (const [name, spec] of Object.entries(VARIANTS)) {
  const usageLog = [];
  const analyst = makeAnalyst(usageLog);
  const tally = { blind: { restrained: 0, total: 0 }, assisted: { restrained: 0, total: 0 } };
  const perCase = [];

  for (const { seed, c, negative } of cases) {
    const caseDir = join(outDir, name, seed);
    await mkdir(caseDir, { recursive: true });
    // Freeze before running: both arms are handed the same bytes, and the
    // manifest is what lets that be verified afterwards rather than asserted.
    const inputs = await freezeCase(caseDir, {
      evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids,
    });
    const verified = await verifyCase(caseDir);
    if (!verified.manifest_intact || !verified.arms_received_identical_evidence) {
      throw new Error(`freeze verification failed for ${seed}`);
    }
    const result = await runCase({
      caseDir, caseId: seed, inputs, evidence: c.evidence,
      groundTruth: mechanicalGroundTruth(c.signal, c.observations, c.targetsPerObservation),
      adapter: synthetic, analyst, analystId: `openai/${MODEL}`,
      // Pinning the model is mandatory here, not optional: two arms cannot be
      // shown matched on anything if the model is unrecorded.
      model: MODEL,
      prompts: { blind: PROMPTS.blind, assisted: spec.assisted },
      corpus, trials: 1,
    });
    const trial = result.trials?.[0] ?? {};
    const row = { seed, negative: Boolean(negative) };
    for (const mode of ["blind", "assisted"]) {
      const r = restraintOf(trial.analyses?.[mode]);
      row[mode] = r;
      if (r) { tally[mode].restrained += r.restrained; tally[mode].total += r.total; }
    }
    perCase.push(row);
    process.stdout.write(`  ${name}  ${seed}  blind ${row.blind ? `${row.blind.restrained}/${row.blind.total}` : "-"}   assisted ${row.assisted ? `${row.assisted.restrained}/${row.assisted.total}` : "-"}\n`);
  }

  const rate = (t) => (t.total ? Number((t.restrained / t.total).toFixed(4)) : null);
  results.variants[name] = {
    why: spec.why,
    promptSha256: `sha256:${sha256(spec.assisted("DIR"))}`,
    blindRestraint: rate(tally.blind),
    assistedRestraint: rate(tally.assisted),
    gap: rate(tally.blind) != null && rate(tally.assisted) != null ? Number((rate(tally.blind) - rate(tally.assisted)).toFixed(4)) : null,
    tally, perCase,
    uncachedInputTokens: usageLog.reduce((sum, u) => sum + (u.input_tokens - u.cached_input_tokens), 0),
  };
  const v = results.variants[name];
  console.log(`  => ${name}: blind ${v.blindRestraint}  assisted ${v.assistedRestraint}  gap ${v.gap}\n`);
}

results.finishedAt = new Date().toISOString();
await writeFile(join(HERE, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log("wrote results.json");
