# knip-cleanup-skill

A small coding-agent Skill for safely acting on [Knip](https://knip.dev) findings in JavaScript and TypeScript repositories.

Knip already does the static analysis. This Skill does not try to become another unused-code detector or a copy of Knip's documentation. It adds a thin decision and execution layer around the analyzer.

## Design principle

> Prefer existing repository/CLI evidence over additional Skill rules.

Use Knip to produce findings, then use evidence already available in the repository and developer environment to resolve ambiguity:

```text
Knip finding
    ↓
repository / CLI evidence
    ↓
risk + confidence + action boundary
    ↓
small authorized change
    ↓
git diff + existing validation
    ↓
Knip rerun
```

Typical evidence sources include repository search (`rg`), Git state/diffs, package-manager dependency information such as `npm explain` / `npm why` or `pnpm why`, and the project's existing lint/typecheck/test/build commands.

The Skill does **not** require extra analyzers. Optional graph/debug tools may be useful when already available, but they should not become mandatory dependencies or new layers of policy.

## Core contract

- Knip is the primary analyzer; do not reimplement it.
- Run Knip report-only before fixes.
- A finding is evidence, not deletion permission.
- Interpret the correct action boundary: file, dependency declaration, export surface, or implementation.
- `unused export` does not mean `unused declaration`.
- Only sufficiently supported `SAFE / HIGH` findings are eligible for automatic cleanup.
- Analysis-only means zero repository mutation.
- Work in small batches, inspect the diff, validate with existing project commands, and rerun Knip.
- Preserve unrelated user work.

Risk and confidence remain separate:

- **SAFE** — evidence supports the proposed cleanup action.
- **REVIEW** — material uncertainty or compatibility risk remains.
- **CONFIGURATION** — code appears intentional but Knip's model is missing the real relationship.

Confidence is **HIGH**, **MEDIUM**, or **LOW** confidence in that classification, not a probability that deletion is safe.

## Finding ledger

For full or multi-finding analyses, the bundled `scripts/finding-ledger.mjs` turns Knip's JSON reporter output into a deterministic ledger so completeness is enforced mechanically instead of relying on a model to count findings correctly.

Example:

```sh
<existing-local-knip> --reporter json > /tmp/knip.json
node <skill-dir>/scripts/finding-ledger.mjs build /tmp/knip.json /tmp/knip-ledger.json
```

Each finding receives a stable run-local ID such as `F0001` and keeps its issue type, file, name/symbol, namespace, and source position when available. The ledger also records the raw total, per-issue counts, and a fingerprint of the source Knip JSON.

The model or reviewer fills separate dimensions rather than collapsing them into one status:

```text
classification: UNCLASSIFIED | SAFE | REVIEW | CONFIGURATION
confidence:     UNASSESSED | HIGH | MEDIUM | LOW
scope:          IN_SCOPE | OUT_OF_SCOPE
execution:      UNDECIDED | ELIGIBLE | BLOCKED | NOT_APPLICABLE
```

Then verify against the original Knip output:

```sh
node <skill-dir>/scripts/finding-ledger.mjs verify /tmp/knip.json /tmp/knip-ledger.json
```

Verification fails if findings are missing, duplicated, altered, or based on a different source report. Each in-scope finding needs a classification, confidence, execution decision, and exact action. Only `SAFE / HIGH` findings can use `ELIGIBLE`. Out-of-scope findings remain accounted for and must have no action.

The ledger is deliberately **not** another analyzer. It does not infer dead code, inspect AST consumers, or decide risk. Knip and repository/CLI evidence remain responsible for facts; the model remains responsible for judgment.

The script uses only Node.js built-ins and adds no npm dependency. Its tests can be run directly:

```sh
node --test scripts/finding-ledger.test.mjs
```

For analysis-only work, keep Knip JSON and ledger files outside the target repository, such as under `/tmp`, so the enforcement mechanism does not violate the zero-mutation contract.

## References are conditional

`SKILL.md` contains the normal workflow. Load supporting references only when the situation requires them:

- [finding semantics](references/finding-semantics.md) — action-boundary questions such as export surface vs declaration
- [analysis-only mode](references/analysis-only-mode.md) — read-only tasks
- [Git-aware review](references/git-aware-review.md) — PR/branch attribution
- [monorepo cleanup](references/monorepo-cleanup.md) — workspace/package boundaries
- [dynamic runtime usage](references/dynamic-runtime-usage.md) — runtime discovery or side effects
- [configuration modeling](references/configuration-modeling.md) — repository behavior disagrees with Knip's model
- [risk classification](references/risk-classification.md) and [confidence evidence](references/confidence-evidence.md) — non-trivial decisions
- [execution policy](references/execution-policy.md) and [verification](references/verification.md) — higher-risk changes and validation

The references should capture stable Agent behavior, not duplicate evolving Knip option documentation. When exact Knip configuration semantics matter, consult current Knip documentation.

## Knip availability

Use an existing local Knip installation or approved interface. Do not silently add Knip to a repository. In analysis-only mode, do not install or temporarily fetch it through a package runner.

This repository does not wrap or replace Knip and has no runtime dependency on it.

## License

MIT
