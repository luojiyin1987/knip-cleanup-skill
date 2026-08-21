---
name: knip-cleanup
description: Safely clean up unused files, exports, types, and dependencies in JavaScript and TypeScript projects with Knip. Interpret each finding before changing code, classify risk, record evidence and confidence, apply scoped execution rules, validate changes, and rerun Knip until the result is stable.
---

# Knip Cleanup

Use this skill when a JavaScript or TypeScript project needs dead-code cleanup with [Knip](https://knip.dev), especially when an agent must decide whether a finding is safe to fix, needs human review, or indicates missing Knip configuration.

## Goals

- Use Knip as the source of static-analysis findings instead of reimplementing its analysis.
- Preserve the semantics of each Knip issue type before deciding what kind of cleanup is possible.
- Separate likely dead code from findings that may be caused by dynamic runtime behavior or missing configuration.
- Make non-trivial decisions evidence-based and explainable.
- Translate analysis into small, explicitly gated cleanup actions.
- Never treat a successful `knip --fix` run as sufficient validation.
- Keep changes easy to review and revert without disturbing unrelated user work.

## Choose the review scope

Determine whether the task is a general repository cleanup or is scoped to a pull request, feature branch, or commit range.

For general cleanup, follow the workflow below across the requested repository scope.

For PR or branch review, first follow [references/git-aware-review.md](references/git-aware-review.md). Use Git context to prioritize and attribute findings, but keep the SAFE, REVIEW, and CONFIGURATION risk classification independent from whether a finding is related to the diff.

If the repository contains multiple workspaces, also follow [references/monorepo-cleanup.md](references/monorepo-cleanup.md). Treat workspace ownership, package boundaries, and cross-workspace consumers as part of the evidence for every non-trivial cleanup.

When a finding may be affected by dynamic imports, filesystem discovery, runtime registration, side effects, framework conventions, or another non-static entry path, follow [references/dynamic-runtime-usage.md](references/dynamic-runtime-usage.md). Investigate whether the specific candidate can participate in that runtime mechanism instead of assuming that all findings in a dynamically loaded project are equally risky.

For worked examples that apply the full classification, evidence, execution, validation, and rerun loop, see [references/end-to-end-scenarios.md](references/end-to-end-scenarios.md). The scenarios illustrate the normative references; they do not override them.

If the user requests analysis, inspection, classification, or reporting **without modifications**, follow [references/analysis-only-mode.md](references/analysis-only-mode.md). Treat the repository as read-only, use only an existing Knip installation or approved external interface, stop before any cleanup action, and verify that final repository state matches the initial state when Git is available.

Do not broaden a PR-scoped cleanup into unrelated repository-wide debt unless the task explicitly requests it.

## Workflow

### 1. Inspect the project

Before running Knip, inspect enough of the repository to understand how it is built and validated.

Identify:

- package manager from lockfiles and `packageManager` metadata;
- workspace or monorepo layout;
- whether Knip is already installed or configured;
- package entry points, `bin` entries, scripts, framework conventions, generated files, fixtures, and plugin directories;
- available validation commands such as lint, typecheck, test, and build;
- existing uncommitted changes when Git is available.

For a monorepo, identify the manifest and public API boundary of each affected workspace instead of treating the root as the only package boundary.

Do not add Knip to the project unless the task explicitly allows dependency changes. Prefer an existing local Knip installation. If Knip is unavailable, explain what is missing instead of silently changing the project.

In analysis-only mode, do not install, add, or temporarily fetch Knip. Do not use `npm install`, `pnpm add`, `yarn add`, `bun add`, or a package runner that would download Knip. If no existing installation or approved Knip interface is available, report that limitation and continue only with evidence that can be collected read-only.

Do not discard, reset, stash, or overwrite unrelated user changes merely to prepare a cleanup.

### 2. Run Knip without fixing

Run Knip in report-only mode first, but only after establishing that the command will use an existing installation.

When a local installation has been confirmed, use the project's package manager as appropriate, for example:

```sh
pnpm exec knip
npm exec knip
yarn knip
bunx knip
```

Do not use `npx`, `npm exec`, `bunx`, or another package runner to obtain Knip from a registry when it is not already available locally. This is especially strict in analysis-only mode.

If the official Knip MCP server is available, `knip-run` may be used instead.

For a targeted monorepo task, a Knip workspace filter may be useful for the first pass, but do not treat a filtered run as proof that cross-workspace consumers do not exist.

Never start with `--fix` or `--allow-remove-files` before reviewing the findings. In analysis-only mode, do not run any Knip fix or file-removal option at all.

### 3. Interpret findings, classify risk, and record confidence

Before assigning cleanup risk, follow [references/finding-semantics.md](references/finding-semantics.md). Preserve what the Knip issue type actually establishes.

In particular:

- `files` is a reachability finding, not deletion permission;
- `dependencies` / `devDependencies` means no recognized dependency reference was found, not that every non-import use has been ruled out;
- `exports` means no external reference to the export surface was found, not that the declaration is dead;
- `types` means no external reference to the exported type surface was found, not that the type declaration has no internal consumers;
- `unlisted`, `binaries`, and `unresolved` are diagnostic findings and must not be treated as ordinary dead-code removal candidates.

For every non-trivial `exports` or `types` finding where the proposed action depends on declaration liveness, record:

```text
External consumers: none | found | unknown
Internal consumers: none | found | unknown
```

Inspect the declaring file itself. Do not infer internal non-use from an import search.

If internal consumers exist, the likely action is to **remove the export modifier**, not delete the declaration. Delete a declaration only after internal consumers, public exposure, runtime reachability, and relevant initializer or top-level side effects have been ruled out.

Classify each relevant finding as one of:

- **SAFE**: strong evidence that the item is internal and unused at the proposed action boundary;
- **REVIEW**: runtime, public API, side-effect, or convention-based usage cannot be ruled out, or compatibility review is required;
- **CONFIGURATION**: the code appears intentional and Knip likely needs better project configuration.

Use [references/risk-classification.md](references/risk-classification.md) for the risk decision rules.

For findings with possible runtime discovery or convention-based reachability, use [references/dynamic-runtime-usage.md](references/dynamic-runtime-usage.md) to trace the concrete runtime path. Confirmed intentional runtime reachability usually supports `CONFIGURATION` when Knip is missing that path; unresolved candidate reachability supports `REVIEW`; a dynamic mechanism that has been reasonably ruled out for the candidate does not by itself block normal `SAFE` evaluation.

For each non-trivial finding, record the relevant supporting evidence, counter-evidence, and material unknowns, then assign **HIGH**, **MEDIUM**, or **LOW** confidence using [references/confidence-evidence.md](references/confidence-evidence.md).

Confidence measures how strongly the evidence supports the classification. It is not the probability that deletion is safe. For example, `REVIEW / HIGH` means there is strong evidence that the finding requires review.

Do not assign `SAFE / HIGH` to a group solely because the items share one Knip issue type. Either establish that the required evidence applies to every named member or split out exceptions and unknowns.

In a monorepo, evidence must include relevant cross-workspace usage and package metadata when those can affect the finding.

### 4. Decide execution eligibility and propose a minimal cleanup

Before changing files, follow [references/execution-policy.md](references/execution-policy.md).

By default, only `SAFE / HIGH` findings are eligible for an automatic code cleanup, and even those must satisfy the finding-type execution rules. `SAFE / MEDIUM` findings need more evidence or review before modification. `REVIEW` findings stay unchanged unless the requested task explicitly authorizes the reviewed behavior or API change. `CONFIGURATION` findings should normally lead to a narrow Knip configuration correction rather than code deletion.

In analysis-only mode, execution eligibility is hypothetical only. Report what would be eligible in a later cleanup task, then stop before changing source files, configuration, manifests, lockfiles, dependency state, generated files, or Git state.

Prefer small, reversible batches. A reasonable order is:

1. eligible unused dependencies;
2. eligible internal export surfaces and types;
3. eligible declarations whose implementation liveness has also been established;
4. other high-confidence internal findings;
5. unused files only after the stricter file-deletion gate is satisfied.

Do not automatically remove:

- public package exports;
- CLI or binary entry points;
- modules loaded through dynamic import, reflection, file-system discovery, or plugin registration;
- side-effect-only modules;
- framework convention files;
- generated files or fixtures that are intentionally retained;
- root or shared dependencies merely because one workspace does not use them.

For false positives, prefer improving Knip configuration over deleting intentional code. In analysis-only mode, recommend the configuration correction but do not apply it.

### 5. Apply fixes conservatively

Skip this entire step in analysis-only mode.

For cleanup tasks that authorize modification, execute one small semantic batch at a time and keep the change within the requested scope.

If Knip auto-fix is appropriate, scope it by issue type rather than fixing everything at once. Examples:

```sh
knip --fix-type dependencies
knip --fix-type exports,types
```

Do not default to unrestricted `knip --fix`. If a scoped command would still modify unrelated findings, apply the intended cleanup more narrowly instead of accepting a broad diff.

Treat file deletion as a separate high-risk step. Do not use `--allow-remove-files` until the candidate files satisfy the execution policy and deletion is explicitly within scope.

Review all modified manifests and lockfiles when dependencies change. In a monorepo, confirm that the dependency is owned by the manifest being changed and is not shared through repository-level tooling or policy.

Inspect the resulting diff after every meaningful batch. Do not overwrite or fold unrelated pre-existing user changes into the cleanup.

If new evidence contradicts the classification during cleanup, reclassify or lower confidence before continuing.

### 6. Validate the project

Run the relevant project checks after each meaningful cleanup batch. Follow [references/verification.md](references/verification.md).

At minimum, use the checks that already exist in the repository. Typical checks include:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not invent validation commands that the project does not support.

For monorepos, start with affected workspace checks when useful, then expand validation to dependent workspaces or repository-level checks when exports, dependencies, or package boundaries changed.

Passing validation strengthens evidence but does not prove that external consumers or untested runtime discovery do not exist. Failed or unexplained validation blocks the next cleanup batch until understood.

If a cleanup must be reverted, revert or narrow only changes introduced by that cleanup batch. Never use a destructive repository-wide reset when unrelated user work may exist.

In analysis-only mode, run validation commands only when they are relevant to the requested analysis and are known not to rewrite project files or dependency state. The final repository-state check remains authoritative.

### 7. Rerun Knip

For cleanup tasks, run Knip again after cleanup. Removing one unused item can expose additional dead code, so repeat the scan/interpret/classify/decide/fix/validate cycle when useful.

For a monorepo cleanup that used a focused workspace scan, run a broader or full-project Knip check before finalizing when cross-workspace references could matter.

Treat newly exposed findings as a new batch with their own semantics, classification, evidence, and execution decision rather than silently extending the previous cleanup.

In analysis-only mode, no rerun-after-fix is needed because no fix should occur. Verify repository state and stop after classification and recommendations.

Stop when:

- the requested cleanup scope is complete;
- remaining findings are REVIEW or CONFIGURATION items;
- remaining SAFE findings do not meet the execution threshold;
- further changes would exceed the requested scope;
- validation fails and the failure cannot be safely resolved within scope;
- cleanup-owned edits cannot be separated safely from pre-existing user changes;
- analysis-only classification and recommendations are complete.

## Reporting

Summarize:

- what Knip reported, preserving the issue types;
- each relevant finding's risk classification and confidence when non-trivial;
- the strongest supporting evidence, counter-evidence, and material unknowns;
- for export/type findings, relevant external and internal consumer evidence when it affects the action;
- relevant dynamic runtime or convention-based reachability evidence when it affects classification;
- for PR/branch review, which findings are PR-ASSOCIATED, PRE-EXISTING, or UNCERTAIN when that attribution can be supported;
- for monorepos, which workspaces were affected and which cross-workspace checks were considered;
- which findings were eligible, blocked, or intentionally left for review/configuration;
- the precise recommended/executed action, such as `remove dependency`, `delete unused file`, `remove export modifier`, `delete unused declaration`, or `keep and review`;
- what execution batches changed;
- which validation commands ran and whether they passed;
- what the final Knip run reports;
- any remaining risks or findings that need review.

For analysis-only work, also report:

- that analysis-only mode was used;
- whether Knip was available without installation;
- that no cleanup or configuration change was performed;
- the initial and final repository state when Git is available;
- whether the repository-state invariant remained unchanged.

Do not claim that code is safe to delete solely because Knip reports it as unused.
Do not equate an unused export with an unused declaration.
Do not delete a declaration without checking same-file consumers and relevant side effects.
Do not claim that a finding was introduced by a PR solely because its file appears in the diff.
Do not claim that a workspace-local finding is safe without considering relevant package boundaries and cross-workspace consumers.
Do not interpret HIGH confidence as permission to delete a REVIEW or CONFIGURATION finding.
Do not use cleanup recovery as a reason to discard unrelated user work.
Do not modify the repository during analysis-only work, even for a `SAFE / HIGH` finding.
