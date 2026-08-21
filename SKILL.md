---
name: knip-cleanup
description: Safely investigate and clean up unused JavaScript and TypeScript code with Knip. Prefer repository and CLI evidence over heuristic rules, classify findings before changing code, keep cleanup scoped, validate each batch, and rerun Knip.
---

# Knip Cleanup

Use this skill when a JavaScript or TypeScript project needs dead-code analysis or cleanup with [Knip](https://knip.dev).

## Core contract

1. **Knip is the primary analyzer.** Do not reimplement its static analysis.
2. **Run report-only first.** Never start with unrestricted `--fix` or file removal.
3. **Prefer existing repository/CLI evidence over additional Skill rules.** Search the repository, inspect package-manager metadata, Git state, and existing project commands before inventing framework heuristics.
4. **A Knip finding is evidence, not deletion permission.** Interpret the finding at the correct action boundary: file, dependency declaration, export surface, or implementation.
5. **Only `SAFE / HIGH` findings are eligible for automatic cleanup.** Eligibility is still subject to the requested scope and finding-specific blast radius.
6. **Analysis-only means zero repository mutation.** Do not install tools, edit files, change dependency state, or apply configuration fixes.
7. **Change in small semantic batches.** Inspect the diff, run relevant existing validation, then rerun Knip.
8. **Preserve user work.** Never use destructive Git recovery to make cleanup easier.

## 1. Establish scope and mode

Determine whether the task is:

- general repository cleanup;
- analysis/report only;
- PR or branch review;
- monorepo/workspace scoped.

Use these references only when the situation requires them:

- analysis only: [references/analysis-only-mode.md](references/analysis-only-mode.md)
- PR/branch attribution: [references/git-aware-review.md](references/git-aware-review.md)
- monorepo boundaries: [references/monorepo-cleanup.md](references/monorepo-cleanup.md)
- dynamic/runtime reachability: [references/dynamic-runtime-usage.md](references/dynamic-runtime-usage.md)
- Knip configuration mismatch: [references/configuration-modeling.md](references/configuration-modeling.md)

Do not broaden the requested scope merely because Knip reports more repository debt.

## 2. Inspect the repository and available evidence

Before Knip, identify:

- package manager and workspace layout;
- whether Knip is already available;
- existing validation commands;
- package/public entry points when relevant;
- current Git worktree state when Git is available.

Prefer concrete evidence from tools already present in the environment or repository. Typical evidence sources include:

- repository search such as `rg` for imports, scripts, configuration references, registrations, and external invocation paths;
- package-manager ownership/dependency information such as `npm explain` / `npm why` or `pnpm why` when a dependency finding needs context;
- `git status`, `git diff`, and repository history for worktree protection or attribution;
- the repository's own lint, typecheck, test, build, or validation commands;
- existing graph/debug tooling when it is already available and materially helps resolve ambiguity.

Do not install additional analyzers merely to increase confidence unless the task explicitly authorizes dependency/tool changes. In analysis-only mode, this is prohibited.

Repository evidence beats filename folklore. A special-looking directory, framework name, or dynamic mechanism elsewhere in the repository is not enough by itself to classify a specific finding.

## 3. Run Knip report-only

Use an existing Knip installation or approved Knip interface. Confirm that a package runner will use an existing installation before invoking it.

Example when Knip is already installed locally:

```sh
pnpm exec knip
```

If Knip is unavailable, report the limitation instead of silently installing or fetching it.

For monorepos, a workspace-filtered run may be useful for focus, but it is not proof that cross-workspace consumers do not exist.

### Finding ledger for full or multi-finding analysis

When classifying a full Knip scan or a non-trivial set of findings, prefer the JSON reporter and use the bundled ledger script to make completeness mechanical rather than relying on the model to count findings correctly.

Capture the Knip JSON without modifying the target repository. For analysis-only work, keep temporary outputs outside the repository, for example under `/tmp`:

```sh
<existing-local-knip> --reporter json > /tmp/knip.json
node <skill-dir>/scripts/finding-ledger.mjs build /tmp/knip.json /tmp/knip-ledger.json
```

The ledger script does **not** decide whether code is dead. It only:

- assigns a deterministic `F0001`, `F0002`, ... identifier to every raw finding;
- preserves issue type, file, symbol/name, namespace, and source position when Knip reports them;
- records raw totals and per-issue counts;
- fingerprints the source Knip JSON;
- provides separate fields for classification, scope, execution state, exact action, unknowns, and notes.

Keep these dimensions separate:

```text
classification: UNCLASSIFIED | SAFE | REVIEW | CONFIGURATION
scope:          IN_SCOPE | OUT_OF_SCOPE
execution:      UNDECIDED | ELIGIBLE | BLOCKED | NOT_APPLICABLE
```

An `OUT_OF_SCOPE` finding may remain unclassified. Every `IN_SCOPE` finding must end as `SAFE`, `REVIEW`, or `CONFIGURATION`.

After classification, verify the ledger against the original Knip JSON:

```sh
node <skill-dir>/scripts/finding-ledger.mjs verify /tmp/knip.json /tmp/knip-ledger.json
```

Final verification must pass before claiming a complete multi-finding analysis. Verification fails when the source report changed, a finding is missing/duplicated/tampered with, status values are invalid, counts do not reconcile, or any in-scope finding remains unclassified.

For a narrowly scoped question about one or a few already-identified findings, a ledger is optional when completeness is not in doubt.

## 4. Interpret the finding before classifying it

Follow [references/finding-semantics.md](references/finding-semantics.md) when the action boundary is not obvious.

Keep these distinctions explicit:

- unused file -> reachability finding, not deletion permission;
- unused dependency -> declaration/use finding, not proof that every script/config/plugin path is absent;
- unused export -> export surface is unused, not necessarily the declaration;
- unused exported type -> exported type surface is unused, not necessarily the type declaration;
- unresolved/unlisted/binary diagnostics -> analysis/declaration problems, not ordinary dead-code deletion candidates.

For export/type findings, inspect the declaring file before deleting implementation code. If the declaration still has internal consumers, the appropriate action may only be **remove export modifier**.

## 5. Classify risk and confidence

Use three risk classes:

- **SAFE** — repository evidence supports the proposed cleanup action;
- **REVIEW** — material runtime, API, side-effect, compatibility, or ownership uncertainty remains;
- **CONFIGURATION** — repository evidence shows the code is intentional but Knip's model does not represent it correctly.

Assign **HIGH**, **MEDIUM**, or **LOW** confidence separately. See [references/risk-classification.md](references/risk-classification.md) and [references/confidence-evidence.md](references/confidence-evidence.md) when the decision is non-trivial.

Record the evidence that materially changes the decision and any unresolved unknowns. Do not create large checklists when a smaller amount of concrete evidence is decisive.

`HIGH` means confidence in the classification, not permission to delete. `REVIEW / HIGH` and `CONFIGURATION / HIGH` are valid outcomes.

## 6. Decide the smallest correct action

Follow [references/execution-policy.md](references/execution-policy.md) for higher-risk actions.

Default gate:

| Risk | Confidence | Default action |
| --- | --- | --- |
| SAFE | HIGH | eligible for a scoped change |
| SAFE | MEDIUM/LOW | gather evidence or review |
| REVIEW | any | keep unless explicitly authorized |
| CONFIGURATION | any | keep code; recommend/model the real Knip relationship |

Prefer precise actions:

- remove dependency;
- delete unused file;
- remove export modifier;
- delete unused declaration;
- correct Knip model;
- keep and review;
- no action in analysis-only mode.

In analysis-only mode, stop after recommendations. Even `SAFE / HIGH` findings remain unchanged.

For configuration findings, inspect current Knip documentation when specific option semantics matter instead of encoding a growing copy of Knip's manual in this Skill.

## 7. Execute and validate in small batches

For tasks that authorize modification:

1. make one small semantic change;
2. inspect the actual diff;
3. verify no unrelated user work was changed;
4. run the most relevant validation already supported by the repository;
5. rerun Knip;
6. treat newly exposed findings as a new decision batch.

Do not default to unrestricted `knip --fix`. Do not use `--allow-remove-files` until the specific file deletion has passed the execution gate.

Passing tests or builds strengthens evidence but does not prove there are no external consumers or unmodeled runtime paths. Stop on unexplained validation failures.

Follow [references/verification.md](references/verification.md) when recovery or validation scope is non-trivial.

## Reporting

Report enough to make the decision reviewable without reproducing every rule in the Skill:

- Knip findings in scope;
- risk and confidence for non-trivial findings;
- decisive repository/CLI evidence and material unknowns;
- exact recommended or executed action;
- blocked/review/configuration findings;
- validation performed;
- final Knip result after authorized cleanup.

When a finding ledger was used, include its raw/per-issue totals and final reconciliation. Do not claim a complete multi-finding analysis unless ledger verification passes with zero in-scope unclassified findings.

For analysis-only tasks, also report that no repository change was performed and whether the Git-visible final state matches the initial state.

## Non-negotiable safeguards

- Do not claim code is safe to delete solely because Knip reports it as unused.
- Do not equate an unused export with an unused declaration.
- Do not install or fetch Knip during analysis-only work.
- Do not hide uncertain reachability with broad ignores.
- Do not discard unrelated user work.
