# knip-cleanup-skill

A small coding-agent skill for cleaning up unused JavaScript and TypeScript code with [Knip](https://knip.dev).

Knip already provides the static analysis. This skill adds the decision and execution workflow around it: classify findings, record evidence and confidence, apply scoped cleanup rules, avoid deleting intentional runtime or public API code, validate each change batch, and rerun Knip.

## What it does

The skill guides an agent through this loop:

```text
inspect project
  -> run Knip without fixing
  -> interpret finding semantics
  -> classify findings
  -> record evidence and confidence
  -> apply the execution gate
  -> make one small cleanup batch
  -> inspect diff and validate
  -> rerun Knip
```

Findings are grouped into three risk categories:

- **SAFE** — strong evidence of internal dead code;
- **REVIEW** — dynamic/runtime/public API usage cannot be ruled out or compatibility review is required;
- **CONFIGURATION** — the code appears intentional and Knip likely needs better configuration.

Confidence is recorded separately as **HIGH**, **MEDIUM**, or **LOW**. It describes how strongly the available evidence supports the classification, not the probability that deletion is safe. `REVIEW / HIGH` is valid when there is strong evidence that human or compatibility review is required.

The execution policy is a separate gate. By default, `SAFE / HIGH` is eligible for a scoped automatic cleanup, but the finding still has to satisfy type-specific rules. File deletion is stricter than internal export cleanup, and public API findings remain review actions unless explicitly authorized.

Knip issue types are interpreted before cleanup risk is assigned. An unused file is a reachability finding, an unused dependency is a dependency-declaration finding, and an unused export is evidence about the export surface rather than proof that the declaration itself is dead. For unused exports and exported types, internal consumers must be considered separately from external consumers before choosing between removing an export modifier and deleting a declaration.

For pull requests and feature branches, the skill can also correlate Knip findings with the Git diff. It keeps attribution separate from cleanup risk:

- **PR-ASSOCIATED** — the branch likely caused or exposed the finding;
- **PRE-EXISTING** — a trusted baseline shows the finding already existed;
- **UNCERTAIN** — available Git evidence is not enough to attribute it safely.

For monorepos, the skill treats workspace ownership and package boundaries as part of cleanup evidence. A workspace-filtered result is useful for focus, but it is not treated as proof that root tooling, dependent packages, or external package consumers are irrelevant.

For findings affected by dynamic imports, filesystem discovery, runtime registration, side effects, framework conventions, or non-import entry points, the skill investigates the concrete runtime path instead of treating every dynamic signal as automatically unsafe. Confirmed intentional runtime reachability points toward `CONFIGURATION`; unresolved candidate reachability points toward `REVIEW`; dynamic behavior that has been ruled out for the candidate can allow normal `SAFE` evaluation to continue.

For `CONFIGURATION` findings, the skill models the repository's actual execution roots and project boundaries before suppressing output. It distinguishes `entry` from `project`, uses issue-specific `ignore*` options only for justified exceptions, and treats broad `ignore` as a last resort. External invocation sources such as package scripts, GitHub Actions, Deno commands, shell scripts, Docker/deployment configuration, migrations, and code generators are evidence to inspect, not automatic proof of reachability.

Worked end-to-end scenarios show how these independent rules combine for internal exports, dynamic plugins, public APIs, monorepo dependencies, and higher-risk file deletion. The scenarios illustrate the existing policy rather than defining new cleanup rules.

Analysis-only mode treats the repository as read-only. It does not install or temporarily fetch Knip, edit configuration, run auto-fixes, or perform otherwise eligible cleanup. When Git is available, the final repository state must match the initial state.

See [SKILL.md](SKILL.md) for the workflow, [references/finding-semantics.md](references/finding-semantics.md) for issue-type semantics and action boundaries, [references/risk-classification.md](references/risk-classification.md) for cleanup risk, [references/confidence-evidence.md](references/confidence-evidence.md) for the evidence model, [references/dynamic-runtime-usage.md](references/dynamic-runtime-usage.md) for runtime discovery and convention-based usage, [references/configuration-modeling.md](references/configuration-modeling.md) for `entry`, `project`, external entry paths, and targeted suppression, [references/execution-policy.md](references/execution-policy.md) for action gates and batching, [references/analysis-only-mode.md](references/analysis-only-mode.md) for read-only analysis safeguards, [references/git-aware-review.md](references/git-aware-review.md) for PR-scoped review, [references/monorepo-cleanup.md](references/monorepo-cleanup.md) for workspace-specific guidance, [references/verification.md](references/verification.md) for validation and recovery, and [references/end-to-end-scenarios.md](references/end-to-end-scenarios.md) for worked examples of the complete decision and execution loop.

## Principles

- Do not reimplement Knip's analysis.
- Run Knip in report-only mode before applying fixes.
- Interpret the Knip issue type before choosing a cleanup action.
- Do not assume `unused` means `safe to delete`.
- Do not equate an unused export with an unused declaration; check same-file consumers and side effects before deleting implementation code.
- Keep risk, confidence, Git attribution, and execution eligibility as separate decisions.
- Prefer concrete repository evidence over filename or naming guesses.
- Investigate whether the specific finding can participate in dynamic runtime behavior; do not classify an entire repository from the presence of one dynamic mechanism.
- By default, only `SAFE / HIGH` findings are candidates for automatic cleanup.
- Apply finding-type execution rules even after the confidence threshold is met.
- Prefer modeling real entry points and project boundaries over suppressing intentional code with ignore rules.
- Treat broad `ignore` as a last resort; `ignoreFiles` and `ignoreDependencies` do not repair missing source reachability.
- Treat file deletion separately from lower-risk cleanup.
- Make small semantic batches and inspect the resulting diff before continuing.
- Stop on unexplained validation failures.
- Preserve unrelated user work; cleanup recovery must not use destructive repository-wide resets.
- In analysis-only mode, do not modify repository or dependency state and verify the final worktree matches the initial worktree when Git is available.
- Use the repository's existing validation commands.
- Rerun Knip after cleanup because removing dead code can expose more dead code.
- In PR review, use Git context to prioritize findings without hiding unrelated analysis results.
- Do not attribute a finding to a PR solely because its file changed.
- In monorepos, check workspace ownership, public package metadata, and relevant cross-workspace consumers before cleanup.

## Knip integration

Use an existing local Knip installation when available, for example:

```sh
pnpm exec knip
```

Only use a package-manager runner after confirming that Knip is already available locally. Do not use `npx`, `npm exec`, `bunx`, or a similar runner to download or temporarily install Knip for analysis-only work.

The skill can also work with Knip's official MCP server when the agent environment exposes `knip-run`.

For monorepos, Knip's `--workspace` filter may be used to focus a first pass on affected workspaces when appropriate. Broader validation and a full Knip run may still be needed before finalizing cross-workspace changes.

When auto-fix is appropriate, prefer scoped issue types such as `knip --fix-type dependencies` or `knip --fix-type exports,types`. The skill does not treat unrestricted `knip --fix` as the default execution path. Auto-fix is never part of analysis-only mode.

This repository does not wrap or replace Knip and does not require its own runtime dependency.

## Project status

The skill currently covers repository cleanup, Knip finding semantics, Knip configuration modeling, analysis-only safety, Git-aware PR/branch review, monorepo/workspace-aware cleanup, dynamic runtime usage investigation, evidence-based confidence reporting, a conservative cleanup execution policy, and worked end-to-end scenarios for applying the full decision loop. Automation can be added separately without turning the project into a CLI or another MCP server.

## License

MIT
