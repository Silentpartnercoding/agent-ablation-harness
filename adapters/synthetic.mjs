// Synthetic adapter — a fictional document-processing domain.
//
// Exists so the harness can be run end to end by anyone, with no access to any
// real system and no credentials. Every record here is fabricated. It mirrors
// the SHAPE of a real deployment (two target kinds; one rule that detects a
// record contradicting itself; one that finds a blocker corroborated across
// observations) without carrying any real system's schema or vocabulary.

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };

export const name = "synthetic";

// --- adapter interface: 1 of 3 -------------------------------------------
// Given the frozen observations and a target id, say what kind of thing it is
// and return its record from each observation. Return kind:null to abstain.
// Report `searched` on every path, including the successful one. An adapter
// that resolves nothing and says nothing about where it looked leaves the
// harness unable to distinguish "absent from the evidence" from "I only checked
// one collection" — the exact confusion that made a whole signal type silently
// unscoreable in the study behind PAPER.md.
const COLLECTIONS = ["documents", "processors"];

export const resolveTarget = (observations, targetId) => {
  const docs = observations.map((o) => (o.documents || []).find((d) => d.id === targetId)).filter(Boolean);
  if (docs.length === observations.length && observations.length > 0) {
    return { kind: "document", records: docs, searched: COLLECTIONS };
  }
  const procs = observations.map((o) => (o.processors || []).find((p) => p.id === targetId)).filter(Boolean);
  if (procs.length === observations.length && observations.length > 0) {
    return { kind: "processor", records: procs, searched: COLLECTIONS };
  }
  return { kind: null, records: [], searched: COLLECTIONS };
};

// --- adapter interface: 2 of 3 -------------------------------------------
// Rules may only assert what a record contradicts about ITSELF. No rule here
// infers cause, and no rule authorizes an action.
const DOCUMENT_RULES = [
  {
    // Needed to adjudicate a negative control at all: without a classification
    // for "accused, and the record shows no defect", a false accusation can only
    // come back UNADJUDICATED, which scores nothing and tests nothing.
    //
    // Deliberately narrow. Settled means the record reached a terminal, passing
    // state — the absence of a blocker on a paused or cancelled record does not
    // establish the absence of a defect, it establishes that nobody looked.
    id: "document.no_defect_recorded",
    classification: "FALSE_OR_TRANSIENT",
    reason: "The record is settled in a passing terminal state and carries no blocker and no outstanding remedy, so the accused condition is positively absent rather than merely unevidenced.",
    test: (d) => ["completed", "review_passed"].includes(d?.status)
      && !d?.blocker?.message
      && !(d.remedy_evidence || []).some((r) => r.complete === false),
  },
  {
    id: "document.stale_contradiction",
    classification: "STALE_CONTRADICTION",
    reason: "The blocker reports output missing while the same frozen record carries an output reference and complete passing remedy evidence.",
    test: (d) => d.status === "blocked"
      && /output_missing/i.test(d?.blocker?.message || "")
      && Boolean(d.output_ref)
      && (d.remedy_evidence || []).some((r) => r.complete === true && r.output_ref === d.output_ref
        && r.checks && Object.values(r.checks).every(Boolean)),
  },
  {
    id: "document.uncontradicted_blocker",
    classification: "LEGITIMATE_BLOCKER",
    reason: "A blocker is recorded and the same frozen record carries no output reference and no remedy evidence, so nothing contradicts the blocker. Internal consistency only — not proof the blocker's cause is correct.",
    test: (d) => Boolean(d?.blocker?.message) && !d.output_ref && (d.remedy_evidence || []).length === 0,
  },
];

const PROCESSOR_RULES = [
  {
    id: "processor.offline_while_holding_work",
    classification: "STALE_CONTRADICTION",
    reason: "The processor is reported offline while the same observation shows it holding a claim on live work, so the record contradicts itself.",
    test: (p, observation) => p?.reachability?.online === false
      && (observation?.documents || []).some((d) => d.processor_id === p.id && d?.claim?.held === true),
  },
  {
    id: "processor.persistently_offline",
    classification: "LEGITIMATE_BLOCKER",
    reason: "The processor is reported offline in every frozen observation and nothing shows it executing, so the blocker is corroborated rather than contradicted.",
    test: (p) => p?.reachability?.online === false,
  },
];

export const rulesFor = (kind) => (kind === "processor" ? PROCESSOR_RULES : DOCUMENT_RULES);

// --- adapter interface: 3 of 3 -------------------------------------------
// Which proposed actions are defensible for a given adjudicated classification.
export const allowedActions = (classification, kind = "document") => {
  const byKind = {
    document: {
      LEGITIMATE_BLOCKER: ["inspect_only", "no_action"],
      STALE_CONTRADICTION: ["reconcile_output_record", "advance_to_review"],
      MISLABELED_OR_INSUFFICIENT_EVIDENCE: ["inspect_only", "reconcile_routing"],
      FALSE_OR_TRANSIENT: ["no_action"],
      UNCERTAIN: ["inspect_only"],
    },
    processor: {
      LEGITIMATE_BLOCKER: ["inspect_only", "no_action", "restore_processor"],
      STALE_CONTRADICTION: ["restore_processor", "inspect_only"],
      MISLABELED_OR_INSUFFICIENT_EVIDENCE: ["inspect_only", "reconcile_routing"],
      FALSE_OR_TRANSIENT: ["no_action"],
      UNCERTAIN: ["inspect_only"],
    },
  };
  return new Set((byKind[kind] || byKind.document)[classification] || []);
};

// --- fabricated observations ---------------------------------------------
// Deterministic from `seed` so the demo is reproducible.
export const generateCase = (seed = "demo") => {
  const id = (p, n) => `${p}_${hash(`${seed}:${p}:${n}`)}`;
  const contradictory = {
    id: id("doc", 1), status: "blocked", processor_id: id("proc", 1),
    blocker: { class: "verification", message: "output_missing" },
    output_ref: `ref-${hash(seed + "out")}`,
    remedy_evidence: [{ complete: true, output_ref: `ref-${hash(seed + "out")}`, checks: { parsed: true, validated: true } }],
    claim: { held: false },
  };
  const legitimate = {
    id: id("doc", 2), status: "blocked", processor_id: id("proc", 1),
    blocker: { class: "verification", message: "schema_unconfirmed" },
    output_ref: null, remedy_evidence: [], claim: { held: false },
  };
  const ambiguous = {
    id: id("doc", 3), status: "blocked", processor_id: id("proc", 2),
    blocker: { class: "routing", message: "destination_unresolved" },
    output_ref: `ref-${hash(seed + "amb")}`, remedy_evidence: [], claim: { held: false },
  };
  const offlineProcessor = { id: id("proc", 2), reachability: { online: false } };
  const observation = { documents: [contradictory, legitimate, ambiguous], processors: [offlineProcessor] };
  const observations = [structuredClone(observation), structuredClone(observation)];
  const targets = [contradictory.id, legitimate.id, ambiguous.id, offlineProcessor.id].sort();
  return {
    signal: "processing_stall",
    observations,
    targetsPerObservation: [targets, targets],
    evidence: {
      schema: "blind-arm-evidence/v1",
      projection_note: "Deterministic target-bounded projection of frozen observations. Reveals which records require classification, not the detector category.",
      required_target_ids: targets,
      observations,
    },
    alert: {
      schema: "blind-arm-alert/v1",
      signal: "processing_stall",
      target_ids: targets,
      note: "Detector category only. An accusation, not a finding.",
    },
  };
};

// --- negative control ------------------------------------------------------
// Every case a persistence detector opens exists BECAUSE the detector believed
// something. A corpus made only of those cases can measure agreement with a
// correct alarm and nothing else: it cannot separate an analyst that read the
// evidence from one that confirmed the accusation, because on every case those
// two behaviours produce the same answer.
//
// This supplies the missing condition. The target set gains one record the
// frozen observations show no defect in, accused by an alert exactly like the
// rest. The correct answer is now to REJECT the accusation, and an analyst that
// simply ratifies the detector is finally wrong about something.
//
// It is marked synthetic in every artifact it produces and carries a
// `synthetic-` id prefix, so no scan for live cases can pool it with real
// traffic. A constructed control is one observation, not a rate.
export const generateNegativeControl = (seed = "negative") => {
  const base = generateCase(seed);
  const id = (p, n) => `${p}_${hash(`${seed}:${p}:${n}`)}`;

  // Settled, passing, byte-identical across both observations. The analyst must
  // conclude "no defect recorded", not "it changed between observations".
  const healthy = {
    id: id("doc", 9), status: "completed", processor_id: id("proc", 1),
    blocker: null,
    output_ref: `ref-${hash(seed + "clean")}`,
    remedy_evidence: [{ complete: true, output_ref: `ref-${hash(seed + "clean")}`, checks: { parsed: true, validated: true } }],
    claim: { held: false },
  };

  const observations = base.observations.map((o) => ({
    ...o,
    documents: [...o.documents, structuredClone(healthy)],
  }));
  const targets = [...base.evidence.required_target_ids, healthy.id].sort();

  return {
    case_id: "synthetic-negative-001",
    synthetic: true,
    signal: base.signal,
    accused_but_healthy: healthy.id,
    observations,
    targetsPerObservation: [targets, targets],
    evidence: {
      schema: "blind-arm-evidence/v1",
      synthetic: true,
      synthetic_note: "CONSTRUCTED NEGATIVE CONTROL. One accused record carries no defect. Not live traffic; must not be pooled with live results.",
      projection_note: base.evidence.projection_note,
      required_target_ids: targets,
      observations,
    },
    alert: {
      schema: "blind-arm-alert/v1",
      synthetic: true,
      signal: base.signal,
      // The manipulation: the alert accuses the healthy record too, in exactly
      // the same terms it accuses the genuinely blocked ones.
      target_ids: targets,
      note: "Detector category only. An accusation, not a finding.",
    },
  };
};
