// Tests for the harness itself.
//
// Every number this repository produces rests on four properties holding
// silently, every run: both arms received identical evidence, arm order was
// balanced rather than fixed, the prompt recorded is the prompt sent, and N
// trials are N runs. If any of them broke, the results would be wrong and
// nothing would say so -- `examples/demo.mjs` would still print.
//
// These existed nowhere until now, which is why they are written after two
// changes to `runCase` rather than before.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { freezeCase, mechanicalGroundTruth, verifyCase } from "../harness/freeze.mjs";
import { blindRunsFirst, armOrderFor, runCase, PROMPTS } from "../harness/run.mjs";
import * as synthetic from "../adapters/synthetic.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const assess = (id, classification, action) => ({
  target_id: id,
  classification,
  evidence: [{ claim: "present in both frozen observations", support: "test" }],
  proposed_next_step: { action, why: "test", risk: "low" },
});

// --- property 1: both arms get identical evidence ------------------------

test("freezing writes one set of bytes to both arms, and verify confirms it", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "harness-freeze-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-freeze");

  await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });
  const verified = await verifyCase(dir);

  assert.equal(verified.manifest_intact, true);
  assert.equal(verified.arms_received_identical_evidence, true);

  const blind = await readFile(join(dir, "blind-input", "evidence.json"), "utf8");
  const assisted = await readFile(join(dir, "assisted-input", "evidence.json"), "utf8");
  assert.equal(sha256(blind), sha256(assisted), "equality must be byte-level, not structural");
});

test("a single altered byte in one arm is caught, not averaged away", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "harness-tamper-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-tamper");
  await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });

  const path = join(dir, "assisted-input", "evidence.json");
  const original = await readFile(path, "utf8");
  await writeFile(path, `${original} `); // one trailing space

  const verified = await verifyCase(dir);
  assert.equal(verified.manifest_intact, false,
    "an arm reading different bytes must fail verification, or every comparison after it is meaningless");
});

test("only the assisted arm is given the alert", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "harness-alert-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-alert");
  await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });

  await readFile(join(dir, "assisted-input", "alert.json"), "utf8");
  await assert.rejects(() => readFile(join(dir, "blind-input", "alert.json"), "utf8"),
    "the blind arm holding an alert would make it not blind");
});

// --- property 2: arm order is balanced, not fixed -------------------------

test("arm order splits a corpus evenly rather than landing where a hash falls", () => {
  // A fixed order confounds treatment with order. A per-id hash reproduces but
  // does not balance: PAPER.md records 7-4 on an 11-case corpus that way.
  for (const size of [2, 3, 10, 11, 50]) {
    const corpus = Array.from({ length: size }, (unused, i) => `case-${i}`);
    const blindFirst = corpus.filter((id) => blindRunsFirst(id, corpus)).length;
    assert.ok(Math.abs(blindFirst - (size - blindFirst)) <= 1,
      `corpus of ${size} split ${blindFirst}/${size - blindFirst}; must be even to within one`);
  }
});

test("arm order is a pure function of the case ids", () => {
  const corpus = ["a", "b", "c", "d", "e"];
  const first = corpus.map((id) => blindRunsFirst(id, corpus));
  const again = [...corpus].reverse().map((id) => blindRunsFirst(id, corpus)).reverse();
  assert.deepEqual(first, again, "order must not depend on the sequence the ids are asked about");
  assert.deepEqual(armOrderFor("a", corpus), armOrderFor("a", [...corpus].reverse()));
});

// --- property 3: the prompt recorded is the prompt sent -------------------

test("prompt_sha256 records what the analyst actually received", async (context) => {
  // The reason PROMPTS is injectable rather than composed inside the analyst:
  // composing there would record the digest of a prompt the model never saw.
  const dir = await mkdtemp(join(tmpdir(), "harness-prompt-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-prompt");
  const inputs = await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });

  const seen = {};
  const analyst = async (inputDir, mode, prompt) => {
    seen[mode] = prompt;
    return {
      analysis: {
        case_verdict: "TRUE", action_authorized: false,
        target_assessments: c.evidence.required_target_ids.map((id) => assess(id, "LEGITIMATE_BLOCKER", "inspect_only")),
      },
      usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
    };
  };

  const custom = {
    blind: () => "CUSTOM BLIND PROMPT",
    assisted: () => "CUSTOM ASSISTED PROMPT",
  };
  const result = await runCase({
    caseDir: dir, caseId: "test-prompt", inputs, evidence: c.evidence,
    groundTruth: mechanicalGroundTruth(c.signal, c.observations, c.targetsPerObservation),
    adapter: synthetic, analyst, prompts: custom, model: "test/pinned", corpus: ["test-prompt"], trials: 1,
  });

  assert.equal(seen.blind, "CUSTOM BLIND PROMPT", "the injected prompt must reach the analyst");
  assert.equal(seen.assisted, "CUSTOM ASSISTED PROMPT");

  const recorded = JSON.stringify(result);
  assert.match(recorded, new RegExp(sha256("CUSTOM BLIND PROMPT")),
    "the recorded digest must be of the prompt that was sent");
  assert.doesNotMatch(recorded, new RegExp(sha256(PROMPTS.blind(dir))),
    "the default prompt was not used and must not be what was recorded");
});

test("omitting prompts uses the defaults, so existing callers are unaffected", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "harness-default-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-default");
  const inputs = await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });

  const seen = {};
  await runCase({
    caseDir: dir, caseId: "test-default", inputs, evidence: c.evidence,
    groundTruth: mechanicalGroundTruth(c.signal, c.observations, c.targetsPerObservation),
    adapter: synthetic, model: "test/pinned", corpus: ["test-default"], trials: 1,
    analyst: async (inputDir, mode, prompt) => {
      seen[mode] = prompt;
      return {
        analysis: {
          case_verdict: "TRUE", action_authorized: false,
          target_assessments: c.evidence.required_target_ids.map((id) => assess(id, "LEGITIMATE_BLOCKER", "inspect_only")),
        },
        usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
      };
    },
  });
  assert.ok(seen.blind.includes("blind arm of a controlled ablation"));
  assert.ok(seen.assisted.includes("alert-assisted arm"));
});

// --- property 4: N trials are N runs -------------------------------------

test("each trial is a separate call and a separate record", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "harness-trials-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-trials");
  const inputs = await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });

  let calls = 0;
  await runCase({
    caseDir: dir, caseId: "test-trials", inputs, evidence: c.evidence,
    groundTruth: mechanicalGroundTruth(c.signal, c.observations, c.targetsPerObservation),
    adapter: synthetic, model: "test/pinned", corpus: ["test-trials"], trials: 3,
    analyst: async () => {
      calls += 1;
      return {
        analysis: {
          case_verdict: "TRUE", action_authorized: false,
          target_assessments: c.evidence.required_target_ids.map((id) => assess(id, "LEGITIMATE_BLOCKER", "inspect_only")),
        },
        usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
      };
    },
  });

  assert.equal(calls, 6, "3 trials x 2 arms must be 6 calls, not 1 result reused");
  for (const n of [1, 2, 3]) {
    for (const mode of ["blind", "assisted"]) {
      await readFile(join(dir, `${mode}-analysis-trial${n}.json`), "utf8");
    }
  }
});

// --- the safety rail the code claims, tested ------------------------------

test("an unpinned model is refused, because pinning is the default not an opt-in", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "harness-pin-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const c = synthetic.generateCase("test-pin");
  const inputs = await freezeCase(dir, { evidence: c.evidence, alert: c.alert, requiredTargets: c.evidence.required_target_ids });

  await assert.rejects(
    () => runCase({
      caseDir: dir, caseId: "test-pin", inputs, evidence: c.evidence, groundTruth: null,
      adapter: synthetic, analyst: async () => ({ analysis: {}, usage: {} }),
      corpus: ["test-pin"], trials: 1,
    }),
    /model/i,
    "two arms cannot be shown matched on anything if the model is unrecorded",
  );
});
