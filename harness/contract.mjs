// Generic scoring contract for two-arm ablation over frozen evidence.
//
// Nothing here knows what a "target" is. Domain meaning arrives through an
// adapter supplying three things: a target resolver, classification rules per
// target kind, and an allowed-action map. See adapters/README.md.

export const targetAssessmentMap = (analysis) =>
  new Map((analysis?.target_assessments || []).map((row) => [row.target_id, row]));

// Exact-match coverage. A nearby finding earns no credit: the analysis must
// name every required target exactly once, in order, and name nothing else.
export const validateTargetCoverage = (analysis, requiredTargets) => {
  const actual = (analysis?.target_assessments || []).map((row) => row.target_id);
  const duplicates = actual.filter((id, i) => actual.indexOf(id) !== i);
  const missing = requiredTargets.filter((id) => !actual.includes(id));
  const extra = actual.filter((id) => !requiredTargets.includes(id));
  const ordered = JSON.stringify(actual) === JSON.stringify(requiredTargets);
  return {
    valid: !duplicates.length && !missing.length && !extra.length && ordered,
    actual, missing, extra, duplicates, ordered,
  };
};

// Abstain unless every frozen observation fires the same rule. A classification
// that holds in one observation and not another is not persistent, and a
// non-persistent classification is not evidence.
export const classifyRecords = (records, rules, observations = []) => {
  const perRecord = records.map((record, i) =>
    rules.find((rule) => rule.test(record, observations[i])) || null);
  const first = perRecord[0];
  if (!first || perRecord.some((rule) => rule?.id !== first.id)) return null;
  return first;
};

// Adjudication over frozen facts only. Anything a rule cannot decide is
// UNADJUDICATED — never guessed, never counted correct.
export const deterministicAdjudication = (groundTruth, evidence, adapter) => {
  const observations = evidence.observations || [];
  const targets = [];
  for (const targetId of groundTruth.persistent_targets || []) {
    const { kind, records, searched = null } = adapter.resolveTarget(observations, targetId);
    if (!kind) {
      // Do not assert an absence that was never checked. The obvious reason to
      // write here — "not present in every frozen observation" — is a claim
      // about the evidence, but all the harness actually observed is that the
      // adapter did not resolve the target. In the study behind PAPER.md those
      // two came apart: the adapter looked in one collection of records and the
      // targets of one whole signal type lived in another. Every one of them was
      // returned UNADJUDICATED with a reason that was false, and they were
      // silently unscoreable for the entire study before anyone noticed.
      //
      // So the reason is built from what the adapter says it searched, and an
      // adapter that says nothing gets a sentence that claims nothing.
      targets.push({
        target_id: targetId, target_kind: null, classification: "UNADJUDICATED",
        searched_collections: searched,
        reason: Array.isArray(searched) && searched.length
          ? `Target was not resolved in every frozen observation under any collection the adapter searched (${searched.join(", ")}).`
          : "The adapter did not resolve this target and did not report where it looked. Its absence from the evidence is therefore not established — only its non-resolution.",
      });
      continue;
    }
    const rule = classifyRecords(records, adapter.rulesFor(kind), observations);
    targets.push(rule
      ? { target_id: targetId, target_kind: kind, classification: rule.classification, rule_id: rule.id, reason: rule.reason }
      : {
          target_id: targetId, target_kind: kind, classification: "UNADJUDICATED",
          reason: "Frozen facts confirm the record persisted but do not independently prove its cause or correct remedy.",
        });
  }
  return { schema: "blind-arm-adjudication/v1", targets };
};

export const scoreAgainstAdjudication = (analysis, coverage, adjudication, adapter) => {
  const byTarget = targetAssessmentMap(analysis);
  const scored = adjudication.targets.filter((r) => r.classification !== "UNADJUDICATED");
  const correct = scored.filter(
    (r) => byTarget.get(r.target_id)?.classification === r.classification).length;
  const actionPairs = adjudication.targets.map((r) => {
    const assessment = byTarget.get(r.target_id);
    if (r.classification === "UNADJUDICATED") {
      return { target_id: r.target_id, status: "DENY_UNADJUDICATED", allowed: false };
    }
    const action = assessment?.proposed_next_step?.action;
    const allowed = assessment?.classification === r.classification
      && adapter.allowedActions(r.classification, r.target_kind).has(action);
    return {
      target_id: r.target_id, action, expected_classification: r.classification,
      allowed, status: allowed ? "SIMULATED_ALLOW" : "DENY_MISMATCH",
    };
  });
  return {
    target_contract_passed: coverage.valid,
    adjudicated_targets: scored.length,
    correct_adjudicated_targets: correct,
    accuracy: scored.length ? correct / scored.length : null,
    status: scored.length ? "PARTIALLY_SCORED" : "AWAITING_ADJUDICATION",
    action_pairs: actionPairs,
    all_action_pairs_allowed: actionPairs.length > 0 && actionPairs.every((r) => r.allowed),
  };
};

// The harness proposes; it never acts. This records that invariant per case.
export const gateSimulation = (groundTruth, blind, assisted) => {
  const required = groundTruth.persistent_targets || [];
  const blindCoverage = validateTargetCoverage(blind, required);
  const assistedCoverage = validateTargetCoverage(assisted, required);
  return {
    mode: "simulation-only",
    exact_action_allowed: false,
    target_contract_passed: blindCoverage.valid && assistedCoverage.valid,
    blind_target_coverage: blindCoverage,
    assisted_target_coverage: assistedCoverage,
    no_action_authority: blind?.action_authorized === false && assisted?.action_authorized === false,
    confirmed_targets: [...required],
    production_effects: 0,
    note: "Analyses never authorize action. Per-target proposals require separate adjudication.",
  };
};
