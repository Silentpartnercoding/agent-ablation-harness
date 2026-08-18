# Adapter interface

The harness carries no domain knowledge. An adapter supplies three functions.

### `resolveTarget(observations, targetId) -> { kind, records, searched }`
Given the frozen observations and a target id, return what kind of thing it is
and its record from each observation. Return `{ kind: null, records: [] }` to
abstain — the harness records `UNADJUDICATED` rather than guessing.

`searched` is the list of collections you actually looked in. Return it on every
path, including successful ones.

**Search every collection a target can live in, and say which ones you searched.**
This is the single easiest way to invalidate a study, and it fails silently. In
the study behind `PAPER.md` the adapter resolved targets against one collection
of records; the targets of one entire signal type lived in another. All of them
came back `UNADJUDICATED` — carrying the reason *"not present in every frozen
observation"*, which was false; they were present, under a key nobody looked at.
They were unscoreable for the whole study, and nothing in the output said so,
because an abstention looks exactly like principled caution.

Reporting `searched` is what lets the harness describe a non-resolution honestly
instead of asserting an absence it never checked. If a target you expect to be
adjudicated comes back `UNADJUDICATED`, read `searched_collections` in the
adjudication record first.

### `rulesFor(kind) -> Rule[]`
```js
{ id: string, classification: string, reason: string, test: (record, observation) => boolean }
```
A rule may only assert what a record contradicts **about itself**. Rules must not
infer cause and must not authorize action. A classification is accepted only when
*every* frozen observation fires the *same* rule; otherwise the harness abstains.

### `allowedActions(classification, kind) -> Set<string>`
Which proposed actions are defensible for an adjudicated classification. Used for
simulation only — the harness never executes an action.

## Writing your own

`synthetic.mjs` is a complete worked example on fabricated data. Copy it, replace
the domain, keep the discipline:

- abstention is the default, not the fallback
- rules read frozen records only — never live state
- no rule authorizes an action
- resolve every collection, and report which ones you searched

`synthetic.mjs` also carries a rule that classifies an accused record the
observations show **no** defect in. You need one: without a classification for
"the accusation is wrong", a negative control can only come back `UNADJUDICATED`,
which scores nothing and therefore tests nothing. Keep it narrow — the absence of
a recorded defect on a record nobody finished examining is not evidence of health.

The adapter for the system a study is *about* need not be published. Keeping it
private discloses nothing about the harness, and publishing the harness discloses
nothing about that system.
