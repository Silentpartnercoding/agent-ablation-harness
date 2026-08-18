# Adapter interface

The harness carries no domain knowledge. An adapter supplies three functions.

### `resolveTarget(observations, targetId) -> { kind, records }`
Given the frozen observations and a target id, return what kind of thing it is
and its record from each observation. Return `{ kind: null, records: [] }` to
abstain — the harness records `UNADJUDICATED` rather than guessing.

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

The adapter for the system a study is *about* need not be published. Keeping it
private discloses nothing about the harness, and publishing the harness discloses
nothing about that system.
