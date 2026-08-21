# Verification

A cleanup is not complete just because Knip can apply it or stops reporting the same issue.

Use the repository's existing checks to verify behavior after changes. Follow [execution-policy.md](execution-policy.md) for the action gate, batch boundaries, and recovery rules that apply before and around verification.

## Verification order

Choose only commands that the project actually supports. A typical sequence is:

1. inspect the cleanup batch diff;
2. update the dependency installation or lockfile if manifests changed;
3. lint;
4. typecheck;
5. run relevant tests;
6. build or package the affected workspace;
7. rerun Knip.

For example:

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec knip
```

Do not copy this command list blindly. Inspect package scripts, workspace tooling, CI configuration, and repository documentation first.

When practical, establish relevant pre-change failures before editing so post-change failures can be interpreted correctly.

## Validate one cleanup batch at a time

Verification should follow the same small semantic batches used for execution.

Do not accumulate many unrelated cleanup changes and then rely on one final test run. Small batches make failures easier to attribute and make unsafe changes easier to narrow without disturbing unrelated work.

Before validation, inspect the diff and confirm that the batch did not modify files outside the intended scope.

## Dependency changes

When removing dependencies:

- use the project's package manager;
- update the lockfile consistently;
- review manifest and lockfile changes;
- check scripts and configuration for executable or plugin usage that may not look like a normal import;
- reinstall or run the package manager's consistency check when appropriate;
- validate the owning workspace and dependent repository tooling when applicable.

## Export and type changes

When removing exports or exported types:

- check package entry points and export maps;
- consider external consumers for published packages;
- run typechecking and API/build steps when available;
- validate dependent workspaces in a monorepo when the package boundary changed;
- treat public API removal as REVIEW unless explicitly requested.

Passing repository validation does not prove that published external consumers do not exist.

## File deletion

File deletion needs stronger verification than removing an internal export.

Before deleting a Knip-reported unused file, check that it is not:

- an entry point;
- loaded dynamically;
- discovered by filename or directory convention;
- referenced from configuration, scripts, deployment manifests, or documentation-driven tooling;
- intentionally retained as a fixture, example, template, migration, snapshot, operational script, or generated artifact.

After deletion, run the broadest relevant validation available in the repository.

Do not treat a successful narrow test as sufficient validation for a file whose runtime discovery boundary is broader.

## Knip configuration changes

When resolving a CONFIGURATION finding:

- keep the Knip configuration change narrow;
- rerun Knip after the configuration change;
- confirm the intended finding is resolved;
- check that broad ignore patterns or project globs did not suppress unrelated useful findings.

A quieter Knip report is not automatically a better configuration.

## Failure handling

Do not continue to the next cleanup batch while the current batch has unexplained validation failures.

If validation fails:

1. determine whether the failure was already present before the cleanup when that can be established;
2. determine whether the failure is caused or exposed by the current cleanup batch;
3. revert or narrow the unsafe cleanup when appropriate;
4. undo only cleanup-owned changes and preserve unrelated pre-existing user changes;
5. do not hide the failure with ignores, test exclusions, or unrelated configuration changes;
6. report unrelated or indeterminate failures separately.

Do not use `git reset --hard`, forced checkout, automatic stashing, or another destructive repository-wide recovery operation when unrelated user work may exist.

If cleanup-owned changes cannot be separated safely from pre-existing edits, stop and report the overlap rather than overwriting the user's work.

## Validation changes confidence, not risk semantics

Validation is evidence and may raise or lower confidence, but it does not automatically change the meaning of the risk category.

Examples:

- successful validation can help raise `SAFE / MEDIUM` to `SAFE / HIGH` when other material evidence is complete;
- a failed build invalidates the evidence for `SAFE / HIGH` until understood;
- successful tests do not turn a public `REVIEW` API into a `SAFE` API;
- successful tests do not prove the absence of external consumers or untested dynamic loading.

Reclassify only when new evidence actually changes the risk decision.

## Final Knip run

Always rerun Knip after successful cleanup when feasible.

The final report should distinguish:

- resolved findings;
- newly exposed findings that require a new classification/execution decision;
- REVIEW findings intentionally left unchanged;
- CONFIGURATION findings intentionally left unchanged or resolved through configuration;
- SAFE findings blocked by insufficient confidence or execution policy;
- findings outside the requested scope.

Inspect the final diff and confirm the complete change set remains within scope before reporting completion.
