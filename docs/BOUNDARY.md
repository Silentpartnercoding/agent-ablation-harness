# What this repository does and does not contain

This harness was developed against a private multi-agent orchestration system.
That system is not published, and this repository does not contain, reveal, or
depend on it.

**Contained here** — the generic instrument:
- two-arm ablation over frozen evidence
- serialise-once freezing, so byte-equality between arms holds by construction
- hash manifests and independent verification
- mechanical ground truth from signal persistence
- abstention vocabulary and exact-match coverage scoring
- arm-order randomisation and run provenance
- a synthetic adapter over fabricated data

**Not contained here** — and deliberately so:
- the observation schema of any real system
- domain classification rules for any real system
- any real system's action vocabulary
- any orchestration, scheduling, or coordination logic
- the raw case corpus from the study in `PAPER.md`

The adapter boundary is what makes this separation clean: everything
system-specific lives behind three functions, and none of those three are
published for the private deployment.
