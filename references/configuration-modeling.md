# Knip configuration modeling

Use this reference when a finding appears to be intentional code that Knip does not currently model correctly.

The goal is not to make the report quiet. The goal is to represent the repository's real execution and project boundaries as accurately and narrowly as possible.

A configuration change should answer:

> What real repository behavior or boundary is missing from Knip's current model?

Do not start from an ignore rule. Start from repository evidence.

## 1. Confirm that the finding is actually configuration-related

Before recommending a Knip configuration change, establish a concrete reason the candidate should be considered reachable or intentionally analyzed.

Useful evidence includes:

- a package entry point, `bin`, `main`, or `exports` path;
- a `package.json` script;
- a GitHub Actions or other CI workflow command;
- a Deno, Node.js, Bun, shell, or task-runner command that executes the file;
- a Docker or container entrypoint;
- deployment, cron, migration, code-generation, or operational configuration;
- a framework/plugin convention that can be tied to the specific candidate;
- another repository-specific runtime or tooling path.

If runtime reachability is confirmed but Knip still reports the candidate as unused, `CONFIGURATION / HIGH` is usually appropriate.

If a runtime mechanism exists but whether the candidate participates is unresolved, keep the finding in `REVIEW` rather than using configuration to hide uncertainty. Follow [dynamic-runtime-usage.md](dynamic-runtime-usage.md).

Do not classify code as `CONFIGURATION` merely because it lives in a special-looking directory.

## 2. Check what Knip already discovers automatically

Before adding configuration, inspect whether Knip should already discover the relevant path.

Knip can discover entry files from several sources, including:

- default entry file patterns;
- `main`, `bin`, and `exports` in `package.json`;
- package scripts;
- enabled plugins and their config/entry files;
- supported dynamic imports and runtime APIs;
- CI workflow `run` commands parsed by Knip's script parser.

For example, the presence of a GitHub Actions workflow does **not** automatically mean that every script it invokes needs a manual `entry` rule. First inspect the workflow command and determine whether Knip already parsed it into the module graph.

A disagreement between repository evidence and Knip output should trigger investigation of the missing graph edge, not an immediate ignore.

## 3. Choose the narrowest correct modeling primitive

Use the following decision order.

| Repository fact | Preferred Knip modeling direction |
| --- | --- |
| file is a real executable/runtime/tooling root | `entry` |
| files belong to or do not belong to the analyzed codebase | `project` |
| plugin/framework integration has a supported Knip plugin | plugin configuration or its discovered entries |
| one analyzed file should remain analyzed but should not appear only as an unused-file issue | `ignoreFiles` |
| a dependency package name should be excluded from dependency reporting for a justified exception | `ignoreDependencies` |
| an external binary should be excluded from unlisted-binary reporting for a justified exception | `ignoreBinaries` |
| a specific issue cannot yet be modeled more accurately | the narrowest relevant `ignore*`, with rationale |
| broad suppression seems easiest | do not use broad `ignore` until better modeling has been ruled out |

Prefer representing reachability and project boundaries over suppressing reports.

## 4. Use `entry` for actual roots

An entry file is a starting point for Knip's module graph.

Use `entry` when repository evidence shows that a file is invoked directly rather than reached by another source import.

Typical examples include:

- CLI roots;
- maintenance scripts;
- migration runners;
- code generators;
- deployment scripts;
- scripts invoked directly by CI or external tooling;
- Deno scripts executed directly from a workflow or operational command.

For example:

```yaml
# .github/workflows/stats.yml
- run: deno run --allow-read .github/scripts/task.ts
```

and:

```ts
// .github/scripts/task.ts
import { TaskInput } from './type.ts';
```

If repository evidence proves that `task.ts` is executed by the workflow, but Knip still reports both files as unused, investigate whether the workflow command was parsed successfully.

If Knip is missing that execution root, a narrow configuration candidate may be:

```json
{
  "entry": [".github/scripts/task.ts"]
}
```

or a narrow pattern covering the actual directly executed scripts.

Do not add `type.ts` separately merely because it was also reported unused if `task.ts` imports it. Correctly modeling the root should allow normal module resolution to make downstream files reachable.

This is important because a missing entry can cause a chain of apparently unrelated unused files, exports, types, and dependencies.

## 5. Do not overuse `entry`

More entry files are not always better.

Over-broad `entry` patterns can hide useful unused-export findings because entry exports are treated differently from ordinary internal modules.

Prefer the smallest set of files that are genuinely execution roots.

Do not solve a large unused-file report by making every reported file an entry.

Instead ask:

1. Which files are truly invoked directly?
2. Which files should become reachable from those roots?
3. Which files are not actually part of the source boundary?
4. Which findings remain after those relationships are represented correctly?

## 6. Use `project` for analysis boundaries

`project` describes which source files belong to Knip's analyzed project set.

Conceptually:

```text
unused files
= project files
- entry files
- files resolved from reachable entry files
```

Use `project` to model what belongs to the codebase, including narrow negations when files should not be in the analyzed source set.

Appropriate cases include:

- excluding build outputs;
- excluding generated artifacts that are outside the intended source boundary;
- including non-default source directories that should be analyzed;
- defining workspace-specific source boundaries.

Do not use a broad `ignore` pattern when the real issue is that the file should never have been inside the project boundary.

For monorepos, follow [monorepo-cleanup.md](monorepo-cleanup.md) and inspect workspace-specific Knip configuration. Do not assume root-level `entry` or `project` settings apply correctly to every workspace.

## 7. Understand what ignore options do

Ignore options suppress selected reports. They do not all represent reachability.

### `ignoreFiles`

`ignoreFiles` suppresses the **unused files** issue for matching files.

It does not mean the file becomes an execution root, and it does not repair a missing graph edge.

Use it only when the file should remain analyzed but the unused-file report itself is intentionally not actionable.

Do not use `ignoreFiles` as a substitute for `entry` when a script is actually executed.

### `ignoreDependencies`

`ignoreDependencies` suppresses dependency reports for matching package names.

It does not make source files reachable and should not be recommended for an externally executed script merely because that script is involved in a false-positive chain.

Use it only for a justified dependency-reporting exception after dependency ownership and usage have been investigated.

### `ignoreBinaries`

`ignoreBinaries` suppresses reports for external binaries that Knip considers unlisted.

Use it for justified binary-report exceptions, not for ordinary unused dependencies or source reachability.

### `ignore`

Broad `ignore` suppresses issues for matching files and can hide multiple useful findings.

Treat it as a last resort after entry, project, plugin, workspace, and targeted issue-specific options have been considered.

Do not add an ignore merely to achieve a zero-finding report.

## 8. Inspect existing configuration before overriding defaults

Explicit Knip `entry` and `project` configuration can replace defaults rather than simply append to them.

Before adding or changing either option:

- inspect the existing Knip configuration;
- inspect workspace-specific configuration in monorepos;
- identify default or plugin-discovered roots currently relied upon;
- preserve other required execution roots explicitly when an override would replace them;
- avoid broad wildcard additions that make unrelated modules look intentionally reachable.

A configuration change that fixes one false positive but removes another legitimate entry from the model is not correct.

## 9. Treat external invocation sources as evidence

When a file appears unused, inspect relevant repository-controlled invocation sources before deletion or configuration advice.

Typical evidence sources include:

- `.github/workflows/**/*.{yml,yaml}`;
- local action definitions under `.github/**/action.{yml,yaml}`;
- `package.json` scripts;
- shell scripts and task-runner files;
- Deno configuration and Deno commands;
- Dockerfiles and compose/container configuration;
- deployment manifests and platform configuration;
- cron or scheduled-job definitions;
- migration runners;
- code-generation configuration;
- documentation that contains operational commands when those commands are part of the maintained deployment/runbook process.

This is an investigation checklist, not a convention database.

The existence of one of these files does not prove that a particular finding is reachable. Trace the concrete command or reference to the candidate.

## 10. Distinguish modeling from suppression

Use this mental model:

```text
real executable root missing
-> add/correct entry

wrong source boundary
-> adjust project

supported tool/framework not represented
-> inspect plugin/configuration

intentional issue-specific exception
-> narrow ignore*

uncertain runtime behavior
-> REVIEW, not ignore
```

A configuration recommendation is strong when it explains **why** the finding exists and restores the missing model relationship.

A weak recommendation merely makes the finding disappear.

## 11. Validate configuration changes as experiments

When the task allows modification, treat a configuration fix as a narrow experiment.

Before editing:

1. preserve the current Knip findings relevant to the candidate;
2. record the concrete runtime/tooling evidence;
3. identify the smallest configuration change that should model that evidence.

Then:

1. apply only that configuration change;
2. rerun Knip;
3. confirm the target false positive or false-positive chain is resolved for the expected reason;
4. confirm downstream imports/dependencies remain analyzed rather than being broadly hidden;
5. check that unrelated useful findings did not disappear unexpectedly;
6. inspect the diff and keep the change only if the model became more accurate.

If a large portion of the report disappears after a narrow-looking configuration edit, investigate why before accepting it.

Do not treat "Knip is quiet" as sufficient validation.

## 12. Analysis-only mode reports the candidate but does not edit

In analysis-only mode, follow [analysis-only-mode.md](analysis-only-mode.md).

You may report a concrete configuration recommendation such as:

```text
Finding: .github/scripts/task.ts
Risk: CONFIGURATION
Confidence: HIGH
Evidence: workflow job executes `deno run ... .github/scripts/task.ts`
Current model gap: task.ts is not reachable in the current Knip graph
Recommendation: test a narrow `entry` for the directly executed script
Expected effect: task.ts becomes an entry and type.ts becomes reachable through its import
Action: no change in analysis-only mode
```

Do not edit Knip configuration merely to verify the hypothesis when the task is read-only.

## 13. Configuration evidence and confidence

High confidence in a `CONFIGURATION` finding requires evidence about both sides:

- repository evidence establishes intentional usage or project membership;
- the proposed configuration option matches the missing relationship or reporting exception.

Examples:

### `CONFIGURATION / HIGH`

- a workflow directly invokes a script;
- the exact command/path is confirmed;
- Knip does not currently make that script reachable;
- a narrow entry-model correction fits the observed gap.

### `CONFIGURATION / MEDIUM`

- repository evidence strongly suggests intentional use;
- the exact missing Knip model edge or correct configuration primitive is still uncertain.

### `REVIEW / MEDIUM`

- a dynamic or operational mechanism exists;
- whether this candidate participates is unresolved;
- no configuration change should be recommended as if reachability were proven.

Confidence measures confidence in the classification and recommendation, not a probability that the code is safe to delete.

## 14. Non-negotiable safeguards

- Do not use an ignore rule to hide an unresolved runtime question.
- Do not use `ignoreDependencies` to fix source-file reachability.
- Do not use `ignoreFiles` as a substitute for a real entry point.
- Do not add every reported file as an entry.
- Do not assume GitHub Actions or package scripts require manual entry configuration before checking Knip's automatic discovery.
- Do not override `entry` or `project` without considering the defaults and existing workspace/plugin configuration that may be replaced.
- Do not accept a configuration change solely because the total finding count decreased.
- Do not change configuration in analysis-only mode.
- Do not delete intentional code to make Knip quiet.
