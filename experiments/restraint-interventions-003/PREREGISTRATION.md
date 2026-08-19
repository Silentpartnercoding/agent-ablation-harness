# RESTRAINT-INTERVENTIONS-003 — preregistration

**Status: frozen, not yet run.**

Follows 002, which was NULL and reportable: the control gap was +0.0865 at 1.63
SE against a bar of 2 SE, on a design powered to have seen it (blind SE 0.0211).
Two things came out of it that this run exists to address.

## Design consequence of 002's null

002 showed the synthetic corpus does not reproduce the blind-to-assisted
restraint effect at the preregistered bar. **This run therefore does not depend
on that gap.** Both measures below are internal to the assisted arm and remain
interpretable whether or not the control effect exists here.

That is a deliberate narrowing. Whether the effect can be studied on a synthetic
corpus at all is a separate question, recorded in 002 and not answered here.

## Two questions

### Q1 — the experiment 002 failed to run

002's V1 moved assisted restraint +0.4378 (8.73 SE) and **cannot be
interpreted**. Its prompt ended "If you cannot quote it, propose inspect_only",
naming the restrained action as the default, so the effect is not attributable
to the citation requirement.

**V1R** removes that sentence. It requires a quotation to support an action and
says nothing about what to do otherwise.

> Does requiring evidence for an action, without naming a fallback, change
> restraint?

Unknown, and not predicted.

### Q2 — the confirmation-ritual hypothesis

002's V3 moved assisted restraint **−0.1730 (3.03 SE), the wrong way**, and is
not confounded: its prompt names no action and no default. Asking what evidence
would show the alert is wrong made the analyst act more.

RESULTS.md proposed a mechanism and labelled it a hypothesis. The design could
not see it, because analyses record verdicts and not reasoning.

**V3R** asks the same question and records the answer in a parseable field:

```
"falsifier": { "described": "<what would show the alert is wrong>",
               "present": true | false }
```

This is a recording change, not a task change — V3 already asked for exactly
this in prose. V3R is nonetheless a **new variant**, not a rerun of V3, and is
reported as one.

**H1, stated in advance:** among targets where the analyst records
`falsifier.present = false`, the acting rate is **higher** than among targets
where it records `true`. That is the confirmation ritual: having looked for
disconfirming evidence and not found it, absence is read as support.

**H1 is refuted** if the acting rate is equal or lower when `present = false`.
A refutation is a result and will be reported as one; the mechanism would then
be something else, and 002's V3 effect would remain unexplained rather than
explained wrongly.

## Arms

| variant | assisted prompt |
| --- | --- |
| V0 control | unchanged from 001/002, as anchor |
| V1R citation | V0 + "You may propose an action for a target only if you quote the specific observation text that supports it in the evidence array." |
| V3R falsifier | V0 + "For each target, state what evidence would show the alert is WRONG about this target, and whether that evidence is present in the frozen observations. Record both in the falsifier field." |

Blind prompt unchanged in all three, and reported as the variance control.

## Measures

**Primary for Q1:** assisted-arm restraint for V1R, against V0's assisted arm.

**Primary for Q2:** acting rate among `falsifier.present = false` targets versus
`= true` targets, within V3R's assisted arm. Reported with counts, because if
one cell is nearly empty the comparison is not available and that will be said
rather than papered over.

**Secondary:** blind-arm spread across variants, as in 002.

## Unchanged

Corpus seeds `int-001`…`int-008` plus `int-neg`, same generator. Analyst
`openai/gpt-4.1`, temperature 0. **Five trials per arm per variant** — 002
established that one is not enough and five gives blind SE ~0.02.

Scoring reads the written analyses. `scores.json` carries a provenance block
declaring itself a derivation.
