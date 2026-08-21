# knip-cleanup-skill

A small coding-agent skill for cleaning up unused JavaScript and TypeScript code with [Knip](https://knip.dev).

Knip already provides the static analysis. This skill adds the decision workflow around it: classify findings, avoid deleting intentional runtime or public API code, apply small fixes, validate the project, and rerun Knip.

## What it does

The skill guides an agent through this loop:

```text
inspect project
  -> run Knip without fixing
  -> classify findings
  -> propose minimal cleanup
  -> apply safe changes
  -> lint / typecheck / test / build
  -> rerun Knip
```

Findings are grouped into three categories:

- **SAFE** — strong evidence of internal dead code;
- **REVIEW** — dynamic/runtime/public API usage cannot be ruled out;
- **CONFIGURATION** — the code appears intentional and Knip likely needs better configuration.

See [SKILL.md](SKILL.md) for the workflow and [references/risk-classification.md](references/risk-classification.md) for the classification rules.

## Principles

- Do not reimplement Knip's analysis.
- Run Knip in report-only mode before applying fixes.
- Do not assume `unused` means `safe to delete`.
- Prefer configuration fixes for intentional code that Knip cannot discover.
- Treat file deletion separately from lower-risk cleanup.
- Use the repository's existing validation commands.
- Rerun Knip after cleanup because removing dead code can expose more dead code.

## Knip integration

Use an existing local Knip installation when available, for example:

```sh
pnpm exec knip
```

The skill can also work with Knip's official MCP server when the agent environment exposes `knip-run`.

This repository does not wrap or replace Knip and does not require its own runtime dependency.

## Project status

The initial version focuses on the cleanup workflow only. Git-aware PR review, confidence scoring, monorepo-specific refinements, and automation can be added separately without expanding the first version into a CLI or another MCP server.

## License

MIT
