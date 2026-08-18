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

  const manifest = await buildManifest(caseDir);
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

export const buildManifest = async (caseDir) => {
  const paths = await walk(caseDir);
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
  const current = await buildManifest(caseDir);
  const mismatches = [];
  for (const { path, sha256: hash } of current) {
    if (!recorded.has(path)) mismatches.push({ path, issue: "not in manifest" });
    else if (recorded.get(path) !== hash) mismatches.push({ path, issue: "hash mismatch" });
  }
  for (const path of recorded.keys()) {
    if (!current.find((f) => f.path === path)) mismatches.push({ path, issue: "missing on disk" });
  }
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
