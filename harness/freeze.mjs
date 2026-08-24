// Freezing and verification.
//
// The property this exists to guarantee: both arms receive byte-identical
// evidence. It is guaranteed by construction — the evidence is serialised once
// and the same bytes written to both arms — and verifiable after the fact from
// the manifest, by a third party who trusts nobody.

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export const freezeCase = async (caseDir, { evidence, alert, requiredTargets }) => {
  const blind = join(caseDir, "blind-input");
  const assisted = join(caseDir, "assisted-input");
  await mkdir(blind, { recursive: true });
  await mkdir(assisted, { recursive: true });

  // Serialise ONCE. Both arms get the same bytes; equality is not a coincidence
  // to be checked later, it is a property of how the files are produced.
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  await writeFile(join(blind, "evidence.json"), serialized);
  await writeFile(join(assisted, "evidence.json"), serialized);

  // The alert is the manipulation, and the ONLY content difference between arms.
  await writeFile(join(assisted, "alert.json"), `${JSON.stringify(alert, null, 2)}\n`);

  // Manifest the files this function wrote, not whatever the directory happens
  // to contain. Walking it meant a case re-run over a dirty directory silently
  // froze the previous run's analysis outputs as though they were inputs, and
  // those digests went stale the moment the new run overwrote them — a tamper
  // report with no tampering behind it.
  const manifest = await buildManifest(caseDir, INPUT_PATHS);
  await writeFile(join(caseDir, "manifest.json"), `${JSON.stringify({
    schema: "blind-arm-case/v1",
    created_at: new Date().toISOString(),
    status: "frozen",
    required_targets: [...requiredTargets].sort(),
    production_effects: 0,
    files: manifest,
  }, null, 2)}\n`);
  return { blind, assisted };
};

const walk = async (dir, base = dir, out = []) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else if (entry.name !== "manifest.json") out.push(relative(base, full));
  }
  return out.sort();
};

// The three files a freeze writes. The manifest describes exactly these.
export const INPUT_PATHS = [
  "assisted-input/alert.json",
  "assisted-input/evidence.json",
  "blind-input/evidence.json",
];

export const buildManifest = async (caseDir, paths = null) => {
  paths = paths ?? (await walk(caseDir));
  const rows = [];
  for (const p of paths) rows.push({ path: p, sha256: sha256(await readFile(join(caseDir, p))) });
  return rows;
};

// Independent verification. Answers two questions without trusting the operator:
//   1. Do the recorded hashes still match the bytes on disk?
//   2. Did both arms actually receive identical evidence?
export const verifyCase = async (caseDir) => {
  const manifest = JSON.parse(await readFile(join(caseDir, "manifest.json"), "utf8"));
  const recorded = new Map(manifest.files.map((f) => [f.path, f.sha256]));
  const mismatches = [];

  // Check what the manifest recorded, against what is on disk now. Verifying by
  // re-walking the directory made this check impossible to pass after a run:
  // every analysis output was reported "not in manifest", so the property the
  // manifest exists to prove was unverifiable at exactly the moment a third
  // party would want to prove it.
  for (const [path, hash] of recorded) {
    let current;
    try {
      current = sha256(await readFile(join(caseDir, path)));
    } catch {
      mismatches.push({ path, issue: "missing on disk" });
      continue;
    }
    if (current !== hash) mismatches.push({ path, issue: "hash mismatch" });
  }

  // An unexpected file inside an arm's input directory is a real problem: it
  // changes what an arm was given. Outputs elsewhere in the case directory are
  // the run's own product and are not evidence of tampering.
  const onDisk = await walk(caseDir);
  const unexpectedInputs = onDisk.filter(
    (p) => (p.startsWith("blind-input/") || p.startsWith("assisted-input/")) && !recorded.has(p),
  );
  for (const path of unexpectedInputs) mismatches.push({ path, issue: "unexpected file in arm input" });
  const blindEvidence = recorded.get("blind-input/evidence.json");
  const assistedEvidence = recorded.get("assisted-input/evidence.json");
  return {
    manifest_intact: mismatches.length === 0,
    mismatches,
    // The claim that makes the comparison meaningful.
    arms_received_identical_evidence: Boolean(blindEvidence) && blindEvidence === assistedEvidence,
    blind_evidence_sha256: blindEvidence || null,
    assisted_evidence_sha256: assistedEvidence || null,
  };
};

// Ground truth without a model in the loop: a condition is confirmed when the
// same targets carry the signal in every frozen observation.
export const mechanicalGroundTruth = (signal, observations, targetsPerObservation) => {
  const sets = targetsPerObservation.map((t) => new Set(t));
  const persistent = [...(sets[0] || [])].filter((id) => sets.every((s) => s.has(id))).sort();
  return {
    schema: "blind-arm-ground-truth/v1",
    signal,
    observation_counts: targetsPerObservation.map((t) => t.length),
    observation_targets: targetsPerObservation.map((t) => [...t].sort()),
    persistent_targets: persistent,
    signal_present_in_all: persistent.length > 0 && sets.length > 1,
    classification: persistent.length > 0 && sets.length > 1 ? "CONFIRMED_CONDITION" : "NOT_CONFIRMED",
    scope_limit: "Confirms the machine condition only; it does not prove the cause or authorize a remedy.",
    production_effects: 0,
  };
};
