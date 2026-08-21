# knip-cleanup-skill

A small coding-agent skill for cleaning up unused JavaScript and TypeScript code with [Knip](https://knip.dev).

Knip already provides the static analysis. This skill adds the decision workflow around it: classify findings, record evidence and confidence, avoid deleting intentional runtime or public API code, apply small fixes, validate the project, and rerun Knip.

## What it does

The skill guides an agent through this loop:

```text
inspect project
  -> run Knip without fixing
  -> classify findings
  -> record evidence and confidence
  -> propose minimal cleanup
  -> apply safe changes
  -> lint / typecheck / test / build
  -> rerun Knip
```

Findings are grouped into three risk categories:

- **SAFE** — strong evidence of internal dead code;
- **REVIEW** — dynamic/runtime/public API usage cannot be ruled out or compatibility review is required;
- **CONFIGURATION** — the code appears intentional and Knip likely needs better configuration.

Confidence is recorded separately as **HIGH**, **MEDIUM**, or **LOW**. It describes how strongly the available evidence supports the classification, not the probability that deletion is safe. `REVIEW / HIGH` is valid when there is strong evidence that human or compatibility review is required.

For pull requests and feature branches, the skill can also correlate Knip findings with the Git diff. It keeps attribution separate from cleanup risk:

- **PR-ASSOCIATED** — the branch likely caused or exposed the finding;
- **PRE-EXISTING** — a trusted baseline shows the finding already existed;
- **UNCERTAIN** — available Git evidence is not enough to attribute it safely.

For monorepos, the skill treats workspace ownership and package boundaries as part of cleanup evidence. A workspace-filtered result is useful for focus, but it is not treated as proof that root tooling, dependent packages, or external package consumers are irrelevant.

See [SKILL.md](SKILL.md) for the workflow, [references/risk-classification.md](references/risk-classification.md) for cleanup risk, [references/confidence-evidence.md](references/confidence-evidence.md) for the evidence model, [references/git-aware-review.md](references/git-aware-review.md) for PR-scoped review, and [references/monorepo-cleanup.md](references/monorepo-cleanup.md) for workspace-specific guidance.

## Principles

- Do not reimplement Knip's analysis.
- Run Knip in report-only mode before applying fixes.
- Do not assume `unused` means `safe to delete`.
- Keep risk, confidence, and Git attribution as separate decisions.
- Prefer concrete repository evidence over filename or naming guesses.
- By default, only `SAFE / HIGH` findings are candidates for automatic cleanup.
- Prefer configuration fixes for intentional code that Knip cannot discover.
- Treat file deletion separately from lower-risk cleanup.
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

This repository does not wrap or replace Knip and does not require its own runtime dependency.

## Project status

The skill currently covers repository cleanup, Git-aware PR/branch review, monorepo/workspace-aware cleanup, and evidence-based confidence reporting. Automation can be added separately without turning the project into a CLI or another MCP server.

## License

MIT
