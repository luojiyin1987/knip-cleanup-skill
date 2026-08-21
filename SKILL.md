---
name: knip-cleanup
description: Safely clean up unused files, exports, types, and dependencies in JavaScript and TypeScript projects with Knip. Classify findings before changing code, prefer configuration fixes for false positives, validate changes, and rerun Knip until the result is stable.
---

# Knip Cleanup

Use this skill when a JavaScript or TypeScript project needs dead-code cleanup with [Knip](https://knip.dev), especially when an agent must decide whether a finding is safe to fix, needs human review, or indicates missing Knip configuration.

## Goals

- Use Knip as the source of static-analysis findings instead of reimplementing its analysis.
- Separate likely dead code from findings that may be caused by dynamic runtime behavior or missing configuration.
- Apply the smallest reasonable cleanup first.
- Never treat a successful `knip --fix` run as sufficient validation.
- Keep changes easy to review and revert.

## Workflow

### 1. Inspect the project

Before running Knip, inspect enough of the repository to understand how it is built and validated.

Identify:

- package manager from lockfiles and `packageManager` metadata;
- workspace or monorepo layout;
- whether Knip is already installed or configured;
- package entry points, `bin` entries, scripts, framework conventions, generated files, fixtures, and plugin directories;
- available validation commands such as lint, typecheck, test, and build.

Do not add Knip to the project unless the task explicitly allows dependency changes. Prefer an existing local Knip installation. If Knip is unavailable, explain what is missing instead of silently changing the project.

### 2. Run Knip without fixing

Run Knip in report-only mode first. Prefer the project's package manager, for example:

```sh
pnpm exec knip
npm exec knip
yarn knip
bunx knip
```

If the official Knip MCP server is available, `knip-run` may be used instead.

Never start with `--fix` or `--allow-remove-files` before reviewing the findings.

### 3. Classify findings

Classify each relevant finding as one of:

- **SAFE**: strong evidence that the item is internal and unused;
- **REVIEW**: runtime, public API, side-effect, or convention-based usage cannot be ruled out;
- **CONFIGURATION**: the code appears intentional and Knip likely needs better project configuration.

Use [references/risk-classification.md](references/risk-classification.md) for the decision rules.

When evidence is incomplete, lower confidence instead of guessing.

### 4. Propose a minimal cleanup

Prefer small, reversible batches. A reasonable order is:

1. clearly unused dependencies;
2. clearly unused internal exports and types;
3. other high-confidence internal findings;
4. unused files only after stronger review.

Do not automatically remove:

- public package exports;
- CLI or binary entry points;
- modules loaded through dynamic import, reflection, file-system discovery, or plugin registration;
- side-effect-only modules;
- framework convention files;
- generated files or fixtures that are intentionally retained.

For false positives, prefer improving Knip configuration over deleting intentional code.

### 5. Apply fixes conservatively

If automated fixing is appropriate, scope it by issue type rather than fixing everything at once. Examples:

```sh
knip --fix-type dependencies
knip --fix-type exports,types
```

Treat file deletion as a separate high-risk step. Do not use `--allow-remove-files` unless unused files have been reviewed and deleting them is explicitly within scope.

Review all modified manifests and lockfiles when dependencies change.

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

### 7. Rerun Knip

Run Knip again after cleanup. Removing one unused item can expose additional dead code, so repeat the scan/classify/fix/validate cycle when useful.

Stop when:

- the requested cleanup scope is complete;
- remaining findings are REVIEW or CONFIGURATION items;
- further changes would exceed the requested scope;
- validation fails and the failure cannot be safely resolved within scope.

## Reporting

Summarize:

- what Knip reported;
- which findings were classified SAFE, REVIEW, or CONFIGURATION;
- what changed;
- which validation commands ran and whether they passed;
- what the final Knip run reports;
- any remaining risks or findings that need review.

Do not claim that code is safe to delete solely because Knip reports it as unused.
