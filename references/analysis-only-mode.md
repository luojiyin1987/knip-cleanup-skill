# Analysis-only safety mode

Use this reference when the user asks to inspect, analyze, review, classify, or report Knip findings **without modifying the repository**.

Analysis-only work has a stronger execution constraint than normal cleanup:

> The repository is read-only for the duration of the task.

The goal is to collect evidence, classify findings, assign confidence, and recommend next actions without changing source code, configuration, dependency state, manifests, lockfiles, generated files, or Git state.

## 1. Enter analysis-only mode explicitly

Treat the task as analysis-only when the user asks for wording such as:

- analyze only;
- report only;
- inspect without changes;
- do not modify files;
- classify findings before fixing;
- review dead code without cleanup.

When this mode applies, it overrides normal cleanup eligibility. A finding may still be classified `SAFE / HIGH`, but that classification is only a recommendation for a possible later cleanup task.

Do not perform an eligible cleanup merely because the execution policy would normally allow it.

## 2. Preserve the repository-state invariant

When Git is available, record the initial worktree state before running analysis commands.

A typical read-only check is:

```sh
git status --short
```

Record enough information to distinguish pre-existing user changes from any accidental mutation during analysis.

At the end of the task, check the worktree again.

The analysis-only invariant is:

```text
final repository state == initial repository state
```

This means the analysis must not intentionally change:

- tracked source files;
- untracked project files;
- package manifests;
- lockfiles;
- Knip configuration;
- generated artifacts;
- Git index state;
- branches, commits, or tags.

If the final state differs, do not claim that analysis-only mode completed cleanly.

Do not use destructive recovery such as `git reset --hard`, forced checkout, automatic stashing, or deletion of unrelated files to restore the invariant. Preserve user work and report any mutation that cannot be safely separated.

## 3. Do not install, add, or fetch Knip

Analysis-only mode never authorizes adding Knip to the project.

Do not run commands such as:

```sh
npm install knip
npm install -D knip
pnpm add knip
pnpm add -D knip
yarn add knip
yarn add -D knip
bun add knip
bun add -d knip
```

Do not use a package runner when it would download or temporarily install Knip merely to make the analysis possible.

This includes `npx`, `npm exec`, `bunx`, or similar runners when Knip is not already available locally and the runner would obtain it from a registry.

Before running Knip, establish that an existing installation or approved external interface is available. Useful evidence includes:

- Knip is declared in the relevant project or workspace manifest;
- an existing local Knip executable is present;
- the repository already exposes a script that invokes its installed Knip;
- the agent environment exposes Knip's official MCP interface such as `knip-run`.

If Knip is unavailable, stop the Knip portion of the analysis and report the limitation. Do not solve the limitation by modifying dependency state.

## 4. Do not mutate dependency state indirectly

Analysis-only mode also forbids package-manager operations that may change project dependency state even when the command is not described as an install.

Do not intentionally:

- update manifests;
- update lockfiles;
- regenerate dependency metadata;
- run an auto-install or bootstrap step solely to obtain Knip;
- change package-manager configuration;
- approve dependency build scripts as part of obtaining Knip.

Read-only package-manager queries are acceptable when they are known not to modify repository state.

If a repository-specific command has uncertain mutation behavior, prefer inspecting its definition before running it.

## 5. Do not edit Knip configuration

A `CONFIGURATION` finding in analysis-only mode is a diagnosis, not authorization to fix configuration.

You may report:

```text
Risk: CONFIGURATION
Confidence: HIGH
Recommendation: add the runtime entry point to Knip configuration in a later cleanup task
```

Do not actually edit:

- `knip.json`;
- `knip.jsonc`;
- `package.json` Knip configuration;
- workspace configuration;
- ignore rules;
- framework/plugin configuration.

The same rule applies to generated configuration or documentation updates.

## 6. Do not run cleanup or auto-fix commands

Analysis-only mode forbids execution commands such as:

```sh
knip --fix
knip --fix-type dependencies
knip --fix-type exports,types
knip --allow-remove-files
```

Do not manually apply equivalent cleanup edits either.

The execution gate is still useful because it tells the user what could be eligible later, but the task stops before modification.

Use wording such as:

```text
Execution eligibility: would be eligible in a cleanup task
Analysis-only action: no change performed
```

## 7. Keep investigation read-only

Read-only investigation may include:

- repository and file inspection;
- code search;
- package metadata inspection;
- Git history/diff inspection that does not alter the worktree;
- Knip report-only execution when an existing Knip installation is available;
- type/build/test commands only when they are already part of the requested analysis and are known not to rewrite project files;
- inspection of scripts, workflows, deployment files, framework configuration, and runtime discovery paths.

Be cautious with validation commands that generate files, rewrite snapshots, format source, update caches inside the repository, or perform package installation as a side effect.

If a command may mutate repository-visible state and the mutation is not necessary for read-only analysis, do not run it.

## 8. Stop after classification and recommendations

An analysis-only task should normally end after:

```text
inspect repository
-> establish Knip availability without installation
-> run Knip report-only when available
-> investigate relevant static/runtime/workspace/Git evidence
-> classify SAFE / REVIEW / CONFIGURATION
-> assign HIGH / MEDIUM / LOW confidence
-> determine hypothetical execution eligibility
-> recommend next actions
-> verify repository state is unchanged
-> stop
```

Do not continue into the normal cleanup batch, diff inspection, modification validation, or rerun-after-fix loop because no fix should have occurred.

## 9. Report the mode and repository-state result

The final report should state that analysis-only mode was used and distinguish findings from actions.

A useful summary includes:

```text
Mode: analysis-only
Knip availability: existing local install / MCP / unavailable
Repository mutation allowed: no

Findings:
- SAFE / HIGH: ...
- REVIEW / HIGH: ...
- CONFIGURATION / HIGH: ...

Recommendations:
- ...

Repository state:
- initial worktree: ...
- final worktree: ...
- mutation check: unchanged
```

If Knip was unavailable, report that classification is limited to the evidence that could be collected without installing it.

If repository state changed unexpectedly, report the difference explicitly instead of presenting the run as clean analysis-only execution.

## Safeguards

- Analysis-only means no repository modifications, even for `SAFE / HIGH` findings.
- Never install, add, or temporarily fetch Knip to satisfy an analysis-only request.
- Do not use a package runner if it would download Knip.
- Do not edit Knip configuration to resolve false positives during analysis-only work.
- Do not run Knip auto-fix or file-removal options.
- Do not use destructive Git operations to hide accidental mutations.
- Final repository state must match initial repository state when that can be checked.
