# Cleanup execution policy

Use this reference after Knip findings have been classified and their evidence has been evaluated.

The execution policy answers a different question from the risk and confidence model:

> Given the current classification, confidence, task scope, and repository state, what changes may the agent actually perform?

A finding being eligible for cleanup does not mean every automated Knip fix is appropriate. Execution must stay scoped, reversible, and validated.

## 1. Establish execution preconditions

Before changing files, confirm:

- the requested cleanup scope;
- the finding's risk classification and confidence;
- any relevant Git attribution;
- the owning package or workspace;
- the repository's available validation commands;
- the current worktree state when Git is available.

Inspect existing uncommitted changes before editing. Do not overwrite, discard, reset, or silently incorporate unrelated user changes.

Do not use destructive worktree operations such as `git reset --hard`, forced checkout, or automatic stashing merely to make cleanup easier.

When practical, run the most relevant pre-change validation or establish whether known failures already exist. If a later failure cannot be distinguished from the baseline, report the uncertainty instead of hiding it.

## 2. Apply the action gate

Risk and confidence determine the default execution gate.

| Risk | Confidence | Default execution policy |
| --- | --- | --- |
| SAFE | HIGH | eligible for a scoped automatic change, subject to the finding-type rules below |
| SAFE | MEDIUM | gather more evidence or request review before changing |
| SAFE | LOW | do not change automatically |
| REVIEW | any | leave unchanged unless the requested task explicitly authorizes the reviewed behavior/API change |
| CONFIGURATION | any | prefer a Knip configuration or documentation correction when the intended runtime usage is established |

`SAFE / HIGH` is an eligibility threshold, not a command to delete something.

Explicit user scope can authorize a higher-risk change, such as removing a public API, but do not relabel it `SAFE` merely because the action was authorized. Keep the evidence and risk classification honest.

## 3. Use finding-type execution rules

Different Knip issue types have different blast radii. Apply the stricter rule when a finding belongs to more than one category.

### Dependencies

A dependency removal may be executed automatically only when it is `SAFE / HIGH` and the relevant ownership checks are complete.

Before removal, confirm as applicable:

- no imports or requires use the package;
- package scripts do not invoke its binary;
- configuration does not reference it as a plugin, preset, loader, adapter, or executable;
- the manifest being changed actually owns the dependency;
- root/shared tooling in a monorepo does not rely on it;
- removal is not merely inferred from one workspace-filtered scan.

Use the repository's package manager so the manifest and lockfile stay consistent. Review both after the change.

Prefer removing dependencies from one owning manifest or one tightly related batch at a time.

### Internal exports and types

Unused internal exports and types are normal automatic-cleanup candidates when they are `SAFE / HIGH`.

Before changing them, confirm:

- they are not exposed through package entry points or export maps;
- re-export chains have been checked;
- cross-workspace consumers have been considered where applicable;
- removal does not silently become a breaking API change.

Prefer removing the unnecessary export surface before deleting implementation code that may still have internal side effects.

### Public API

Public exports, published types, package entry points, and compatibility-sensitive symbols remain `REVIEW` findings even if there are no repository consumers.

Do not automatically remove them under the normal cleanup policy.

If the task explicitly authorizes a breaking API change:

1. keep the finding classified as `REVIEW`;
2. record the explicit scope that authorizes the change;
3. update related exports, types, docs, or tests only when they are part of that same API change;
4. run the repository's API/build/consumer validation where available.

### Files

File deletion has the highest default execution threshold.

Delete a Knip-reported unused file automatically only when all of the following are true:

- risk is `SAFE`;
- confidence is `HIGH`;
- file deletion is within the requested cleanup scope;
- entry-point and package metadata checks are complete;
- dynamic loading, filesystem discovery, framework conventions, and side effects have been reasonably ruled out;
- relevant workspace and cross-workspace consumers have been checked;
- the file is not an intentional fixture, example, migration, template, snapshot, generated artifact, or operational script;
- the deletion can be validated with the broadest relevant checks available.

Do not mix file deletion into a broad automatic fix with lower-risk export or dependency cleanup.

Do not use `--allow-remove-files` until the candidate file list has been reviewed against these conditions.

### Knip configuration

For `CONFIGURATION` findings, do not delete intentional code to make Knip quiet.

A configuration change is appropriate when repository evidence establishes the intended entry point, project file, plugin, workspace, ignore rule, or other Knip configuration gap.

Keep configuration fixes narrow. Avoid broad ignore patterns that suppress unrelated findings merely to obtain a clean report.

After changing Knip configuration, rerun Knip and confirm that the expected finding is resolved without unintentionally hiding other useful findings.

## 4. Keep batches small and coherent

Apply changes in small semantic batches.

Good batch boundaries include:

- one dependency owner manifest;
- a small set of related internal exports exposed by the same refactor;
- one confirmed unused file;
- one narrow Knip configuration correction.

Avoid batches that combine unrelated findings simply because Knip can fix them with one command.

When using Knip auto-fix, prefer a scoped issue type such as:

```sh
knip --fix-type dependencies
knip --fix-type exports,types
```

Do not default to an unrestricted `knip --fix` run.

If a scoped Knip command would still modify unrelated findings outside the requested batch, do not use it blindly. Apply the intended change manually or narrow the execution method.

## 5. Inspect the resulting diff before validation

After each cleanup batch, review the actual changes before running broad validation.

Check for:

- unexpected files modified by an auto-fix;
- unrelated formatting churn;
- manifest or lockfile changes beyond the intended dependency operation;
- accidental public API changes;
- generated changes that require a repository-specific update step;
- modifications that overlap pre-existing user work.

If the diff is broader than the requested cleanup, narrow or undo only the cleanup-owned changes before continuing.

## 6. Validate every meaningful batch

Follow [verification.md](verification.md) after each meaningful change batch.

Choose validation based on blast radius rather than running the shortest possible command.

Typical expectations are:

- dependency removal: package-manager consistency, relevant tests/build, then Knip;
- internal export/type removal: typecheck, relevant tests/build, then Knip;
- file deletion: broad relevant validation, then Knip;
- public API change: API/build/consumer checks where available, then Knip;
- Knip configuration change: rerun Knip and verify the configuration did not hide unrelated findings.

In monorepos, validate dependent workspaces when the changed package boundary can affect them.

Passing validation allows the batch to proceed to final review. It does not retroactively turn a `REVIEW` finding into `SAFE`.

## 7. Stop on unexplained failure

Do not continue to the next cleanup batch while the current batch has an unexplained validation failure.

When validation fails:

1. determine whether the failure was already present before the cleanup when that can be established;
2. determine whether the current cleanup batch caused or exposed the failure;
3. if the cleanup is unsafe, revert or narrow only the changes introduced by that batch;
4. do not silence the failure with unrelated ignores, test exclusions, or configuration changes;
5. report pre-existing or indeterminate failures separately.

Never use a destructive repository-wide reset to recover from a cleanup failure when unrelated user changes may exist.

If cleanup-owned edits cannot be safely separated from pre-existing edits, stop and report the conflict rather than overwriting the user's work.

## 8. Reclassify when execution reveals new evidence

Execution can produce evidence that changes the original decision.

Examples:

- a build failure after deleting a supposedly unused file invalidates `SAFE / HIGH`;
- a package-manager script reveals a dependency binary is still used;
- a generated export map shows an apparently internal symbol is public;
- a dependent workspace fails after export removal;
- a narrow Knip configuration fix reveals additional real dead code.

Update risk or confidence before continuing. Do not preserve an earlier classification merely to finish the planned cleanup.

## 9. Finalize only after a stable rerun

Before reporting completion:

1. inspect the final diff;
2. confirm the changes remain within the requested scope;
3. run the appropriate final validation;
4. rerun Knip;
5. distinguish resolved findings from newly exposed or intentionally retained findings.

If repeated cleanup reveals additional `SAFE / HIGH` findings, treat them as a new batch rather than silently extending the previous one.

## Execution report shape

For each executed batch, record enough information to make the action reviewable:

```text
Batch: remove unused parser dependency
Finding: package.json -> legacy-parser
Risk: SAFE
Confidence: HIGH
Execution: dependency removal

Preconditions:
- dependency owned by packages/parser/package.json
- no imports, scripts, plugins, or root tooling reference it
- no unrelated worktree overlap found

Changes:
- removed legacy-parser from packages/parser/package.json
- updated lockfile with the repository package manager

Validation:
- parser typecheck: pass
- parser tests: pass
- parser build: pass
- final Knip run: finding resolved

Result: accepted
```

For a blocked action:

```text
Finding: src/plugins/legacy.ts
Risk: SAFE
Confidence: MEDIUM
Execution decision: blocked
Reason: filesystem plugin discovery has not been ruled out
Next step: inspect runtime plugin registration before deletion
```

## Non-negotiable safeguards

- Do not use Knip output alone as permission to modify code.
- Do not automatically modify findings below the required action threshold.
- Do not broaden cleanup beyond the requested scope for convenience.
- Do not combine unrelated cleanup with the active change batch.
- Do not hide failures to make the cleanup appear successful.
- Do not delete user work or unrelated local changes to recover from a failed cleanup.
- Do not treat successful validation as proof that external consumers do not exist.
