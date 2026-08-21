# Verification

A cleanup is not complete just because Knip can apply it or stops reporting the same issue.

Use the repository's existing checks to verify behavior after changes.

## Verification order

Choose only commands that the project actually supports. A typical sequence is:

1. update the dependency installation or lockfile if manifests changed;
2. lint;
3. typecheck;
4. run relevant tests;
5. build or package the affected workspace;
6. rerun Knip.

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

## Dependency changes

When removing dependencies:

- use the project's package manager;
- update the lockfile consistently;
- review manifest and lockfile changes;
- check scripts and configuration for executable or plugin usage that may not look like a normal import;
- reinstall or run the package manager's consistency check when appropriate.

## Export and type changes

When removing exports or exported types:

- check package entry points and export maps;
- consider external consumers for published packages;
- run typechecking and API/build steps when available;
- treat public API removal as REVIEW unless explicitly requested.

## File deletion

File deletion needs stronger verification than removing an internal export.

Before deleting a Knip-reported unused file, check that it is not:

- an entry point;
- loaded dynamically;
- discovered by filename or directory convention;
- referenced from configuration, scripts, deployment manifests, or documentation-driven tooling;
- intentionally retained as a fixture, example, template, migration, or generated artifact.

After deletion, run the broadest relevant validation available in the repository.

## Failure handling

If validation fails:

1. determine whether the failure is caused by the cleanup;
2. revert or narrow the unsafe cleanup when appropriate;
3. do not hide the failure with ignores or unrelated configuration changes;
4. report unrelated pre-existing failures separately when they can be established as pre-existing.

Do not continue deleting additional findings while the current cleanup batch has unexplained validation failures.

## Final Knip run

Always rerun Knip after successful cleanup when feasible.

The final report should distinguish:

- resolved findings;
- newly exposed findings;
- REVIEW findings intentionally left unchanged;
- CONFIGURATION findings intentionally left unchanged;
- findings outside the requested scope.
