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
export const resolveTarget = (observations, targetId) => {
  const docs = observations.map((o) => (o.documents || []).find((d) => d.id === targetId)).filter(Boolean);
  if (docs.length === observations.length && observations.length > 0) return { kind: "document", records: docs };
  const procs = observations.map((o) => (o.processors || []).find((p) => p.id === targetId)).filter(Boolean);
  if (procs.length === observations.length && observations.length > 0) return { kind: "processor", records: procs };
  return { kind: null, records: [] };
};

// --- adapter interface: 2 of 3 -------------------------------------------
// Rules may only assert what a record contradicts about ITSELF. No rule here
// infers cause, and no rule authorizes an action.
const DOCUMENT_RULES = [
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
