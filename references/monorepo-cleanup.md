# Monorepo and workspace cleanup

Use this reference when the repository contains multiple package-manager workspaces or multiple Knip workspaces.

The goal is to keep cleanup scoped without treating one workspace as isolated when its dependencies, dependents, configuration, or public API cross workspace boundaries.

## 1. Discover workspace boundaries

Before classifying findings, identify how the repository defines workspaces.

Common sources include:

- `package.json#workspaces`;
- `pnpm-workspace.yaml`;
- package-manager or build-tool configuration;
- Knip `workspaces` configuration.

For each affected workspace, inspect at least:

- its `package.json`;
- package name and private/published status;
- `main`, `module`, `types`, `exports`, and `bin` metadata;
- local scripts;
- dependencies and devDependencies;
- framework or tooling configuration;
- relationships to other workspaces.

Do not assume the repository root and an individual workspace have the same entry points, validation commands, or dependency ownership.

## 2. Use focused Knip runs carefully

Knip supports `--workspace` / `-W` filters, for example:

```sh
knip --workspace packages/parser
```

A focused run is useful for reducing noise, but it is not necessarily an isolated analysis. Knip may include related ancestor, dependency, and dependent workspaces.

Use a focused run for the first pass when the task targets a specific package. Use a full repository run before finalizing cleanup when cross-workspace references could matter.

Do not interpret "not reported in this filtered run" as proof that an item is safe across the monorepo.

## 3. Determine dependency ownership

An unused dependency finding needs workspace context.

Before removing a dependency, determine:

- which manifest declares it;
- whether scripts or configuration in that workspace use it;
- whether the root workspace intentionally owns shared tooling;
- whether another workspace relies on root-level tooling or configuration;
- whether a workspace protocol, catalog, override, or shared dependency policy is involved.

Do not remove a root dependency merely because one child workspace does not import it.

For dependencies declared in a child workspace, verify that the dependency is not used through:

- package scripts;
- test runners;
- bundlers or compilers;
- linters or formatters;
- code generation;
- framework plugins;
- executable names rather than package imports.

## 4. Respect package API boundaries

Treat each publishable workspace as a package boundary.

Before removing an export, type, or file, inspect that workspace's public package metadata and entry points. A symbol can have no in-repository consumer and still be part of a supported external API.

Use **REVIEW** when:

- the workspace is publishable and the symbol is publicly exported;
- the file is referenced by an `exports` subpath;
- the workspace provides a CLI or executable;
- compatibility with external consumers cannot be ruled out.

A private application workspace can usually be evaluated more aggressively than a published library, but dynamic loading and framework conventions still apply.

## 5. Follow cross-workspace references

When a finding appears in one workspace, check whether another workspace:

- imports it by package name;
- imports a subpath;
- depends on generated output;
- references its types;
- invokes its CLI;
- consumes files through build or deployment configuration.

Do not rely only on relative imports inside the reported workspace.

A refactor in workspace A can expose dead code in workspace B, and removing an export from B can break A even when a narrowly scoped search misses the relationship.

## 6. Classify configuration findings per workspace

Knip configuration can differ by workspace. When intentional files are reported as unused, check whether the relevant workspace needs explicit `entry`, `project`, plugin, or ignore configuration.

In Knip configuration for a workspace-based repository, root-level assumptions may not apply to child workspaces. Prefer a workspace-specific configuration fix when the code is intentional.

Examples that often need workspace-aware configuration include:

- package-specific CLI entry points;
- framework-specific files in only one app;
- package-local generated sources;
- examples or fixtures belonging to one workspace;
- custom build or release scripts.

Keep these as **CONFIGURATION** findings until the runtime role is understood.

## 7. Scope changes to affected workspaces

For a targeted cleanup or PR review:

1. identify changed or affected workspaces;
2. run Knip with the narrowest useful workspace scope;
3. correlate findings with cross-workspace relationships;
4. change only findings that belong in the requested scope;
5. run broader validation when package boundaries are affected.

Do not opportunistically clean unrelated packages just because a full Knip run reports them.

## 8. Validate locally and across boundaries

Validation should expand with the blast radius of the cleanup.

For an internal change in one private workspace, start with that workspace's lint, typecheck, test, and build commands when available.

For dependency, export, or package-boundary changes, also consider:

- dependent workspace tests or builds;
- repository-level typechecking;
- integration tests;
- package/build validation at the root;
- a final full Knip run.

Use existing repository commands rather than inventing generic workspace commands.

If a targeted workspace check passes but a dependent workspace fails, treat the cleanup as unsafe until the relationship is resolved.

## Suggested report

```text
Workspace scope:
- affected: packages/parser
- dependent workspaces: apps/cli

Finding:
- packages/parser/src/legacy.ts: parseLegacy

Risk: SAFE
Workspace evidence:
- parser is private
- symbol is not in parser package exports
- no cross-workspace import found
- parser and cli validation pass

Action:
- remove unused internal export

Final validation:
- affected workspace checks: passed
- dependent workspace checks: passed
- full Knip run: targeted finding resolved
```

When the ownership or cross-workspace relationship is uncertain, choose **REVIEW** rather than treating a workspace-filtered result as conclusive.
