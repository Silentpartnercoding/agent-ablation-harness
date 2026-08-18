# Data

Derived results from the study in `PAPER.md`. The raw case corpus is not published
(`docs/BOUNDARY.md`); these are the aggregates the paper reports, in the pseudonyms
of its Appendices A and B.

| file | what it holds |
|---|---|
| `per-case.csv` | one row per case: verdicts, token and wall-clock measurements, per-target agreement, coverage, and adjudication scores |
| `aggregate.json` | pooled cost deltas by signal type, plus ground-truth and per-analyst summaries |
| `adjudication.json` | per-target ground truth from the frozen predicate, and both analysts scored against it |

## Reading `per-case.csv`

Every measurement column describes **analyst 1** — the analyst that produced the
original corpus (`blind_*`, `assisted_*`, `adjudicated_targets`, `blind_correct`,
`assisted_correct`). Analyst 2 ran the same 11 cases separately and its results are
in `adjudication.json` only; it reports no reasoning-token count, so those columns
would not have been comparable (PAPER.md §3.5).

Two rows read oddly and should:

- **`961db7a5`** — the first run. It recorded null verdicts and predates analyst 1's
  recorded runs, so it carries ground truth and an analyst 2 result but nothing to
  score for analyst 1: `NOT_SCORED_NO_ANALYST_1_RUN`. It is excluded from verdict
  statistics in §3.1.
- **`6f8b45cc`** — `n_targets` is 3 but `adjudicated_targets` is 2. The third target
  abstained: its classification was not stable across every frozen observation, so
  the predicate declined to decide it. Abstained targets are never counted correct
  and never counted against an arm.

`adjudicated_targets` counts targets the predicate decided, not targets the analyst
assessed. Coverage (`coverage_blind`, `coverage_assisted`) is a separate, exact-match
check: the analysis must name every required target exactly once and name nothing
else. A nearby finding earns no credit.

## Caveats that travel with these numbers

- Ground truth is a frozen predicate over frozen fields, not an oracle (§4.3).
- The `signal_B` rules were revised after seeing analyst output, so `signal_B`
  agreement is not independent evidence. `signal_A` is the clean subset (§4.8).
- Arm order is confounded with treatment throughout this corpus (§4.6, §4.9).
- These are 11 cases with one trial per arm. The deltas are directional, not
  confirmatory (§4.4).
