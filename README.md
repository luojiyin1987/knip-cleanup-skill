# knip-cleanup-skill

A small coding-agent skill for cleaning up unused JavaScript and TypeScript code with [Knip](https://knip.dev).

Knip already provides the static analysis. This skill adds the decision and execution workflow around it: classify findings, record evidence and confidence, apply scoped cleanup rules, avoid deleting intentional runtime or public API code, validate each change batch, and rerun Knip.

## What it does

The skill guides an agent through this loop:

```text
inspect project
  -> run Knip without fixing
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

For pull requests and feature branches, the skill can also correlate Knip findings with the Git diff. It keeps attribution separate from cleanup risk:

- **PR-ASSOCIATED** — the branch likely caused or exposed the finding;
- **PRE-EXISTING** — a trusted baseline shows the finding already existed;
- **UNCERTAIN** — available Git evidence is not enough to attribute it safely.

For monorepos, the skill treats workspace ownership and package boundaries as part of cleanup evidence. A workspace-filtered result is useful for focus, but it is not treated as proof that root tooling, dependent packages, or external package consumers are irrelevant.

For findings affected by dynamic imports, filesystem discovery, runtime registration, side effects, framework conventions, or non-import entry points, the skill investigates the concrete runtime path instead of treating every dynamic signal as automatically unsafe. Confirmed intentional runtime reachability points toward `CONFIGURATION`; unresolved candidate reachability points toward `REVIEW`; dynamic behavior that has been ruled out for the candidate can allow normal `SAFE` evaluation to continue.

See [SKILL.md](SKILL.md) for the workflow, [references/risk-classification.md](references/risk-classification.md) for cleanup risk, [references/confidence-evidence.md](references/confidence-evidence.md) for the evidence model, [references/dynamic-runtime-usage.md](references/dynamic-runtime-usage.md) for runtime discovery and convention-based usage, [references/execution-policy.md](references/execution-policy.md) for action gates and batching, [references/git-aware-review.md](references/git-aware-review.md) for PR-scoped review, [references/monorepo-cleanup.md](references/monorepo-cleanup.md) for workspace-specific guidance, and [references/verification.md](references/verification.md) for validation and recovery.

## Principles

- Do not reimplement Knip's analysis.
- Run Knip in report-only mode before applying fixes.
- Do not assume `unused` means `safe to delete`.
- Keep risk, confidence, Git attribution, and execution eligibility as separate decisions.
- Prefer concrete repository evidence over filename or naming guesses.
- Investigate whether the specific finding can participate in dynamic runtime behavior; do not classify an entire repository from the presence of one dynamic mechanism.
- By default, only `SAFE / HIGH` findings are candidates for automatic cleanup.
- Apply finding-type execution rules even after the confidence threshold is met.
- Prefer configuration fixes for intentional code that Knip cannot discover.
- Treat file deletion separately from lower-risk cleanup.
- Make small semantic batches and inspect the resulting diff before continuing.
- Stop on unexplained validation failures.
- Preserve unrelated user work; cleanup recovery must not use destructive repository-wide resets.
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

The skill can also work with Knip's official MCP server when the agent environment exposes `knip-run`.

For monorepos, Knip's `--workspace` filter may be used to focus a first pass on affected workspaces when appropriate. Broader validation and a full Knip run may still be needed before finalizing cross-workspace changes.

When auto-fix is appropriate, prefer scoped issue types such as `knip --fix-type dependencies` or `knip --fix-type exports,types`. The skill does not treat unrestricted `knip --fix` as the default execution path.

This repository does not wrap or replace Knip and does not require its own runtime dependency.

## Project status

The skill currently covers repository cleanup, Git-aware PR/branch review, monorepo/workspace-aware cleanup, dynamic runtime usage investigation, evidence-based confidence reporting, and a conservative cleanup execution policy. Automation can be added separately without turning the project into a CLI or another MCP server.

## License

MIT
