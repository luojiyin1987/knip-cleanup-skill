# Git-aware PR review

Use this reference when the cleanup task is scoped to a pull request, feature branch, or commit range.

The purpose of Git context is to prioritize and attribute Knip findings. Do not treat the diff as a replacement for Knip's repository-wide analysis.

## 1. Resolve the comparison target

Prefer explicit pull request metadata when it is available. Otherwise determine the repository default branch and use the merge base between that branch and the current HEAD.

Do not assume the default branch is named `main`.

Typical commands are:

```sh
git merge-base HEAD origin/<default-branch>
git diff --name-status <merge-base>...HEAD
```

Do not switch branches or reset the user's worktree just to obtain a baseline.

## 2. Inspect the diff before running cleanup

Identify:

- changed, added, renamed, and deleted files;
- changed `package.json` files and lockfiles;
- changed package entry points or `exports` maps;
- removed imports, consumers, registrations, scripts, or configuration;
- affected workspaces in a monorepo.

This context helps explain why code may have become unused.

## 3. Run Knip on the current branch

Run Knip in report-only mode first.

For a monorepo, affected workspaces may be used to narrow the first pass when that improves signal. Knip supports the `--workspace` (`-W`) filter, for example:

```sh
knip --workspace packages/my-lib
```

A workspace-filtered run can include related ancestor, dependency, and dependent workspaces. Use a full-project run when workspace filtering could hide relevant context.

## 4. Correlate findings with the change

Prioritize findings with a plausible causal relationship to the diff, such as:

- an export whose last consumer was removed by the branch;
- a dependency used only by code deleted in the branch;
- an implementation file orphaned by a refactor;
- a type or re-export left behind after an API change;
- an entry point changed in package metadata.

Do not ignore unrelated Knip findings, but keep them outside the PR cleanup scope unless the task explicitly includes pre-existing debt.

## 5. Attribute findings carefully

Use one of these attribution labels when useful:

- **PR-ASSOCIATED** — the diff provides strong evidence that the branch caused or exposed the finding;
- **PRE-EXISTING** — a trusted base result shows the same finding already existed;
- **UNCERTAIN** — attribution cannot be established safely from available evidence.

A changed path alone is not enough to claim that a finding was introduced by the PR.

### Baseline comparison

When a trustworthy Knip result for the base revision is already available, compare it with the current result.

If obtaining a baseline would require destructive checkout, resetting the user's branch, or changing an active worktree, do not do that. Prefer an existing clean worktree, CI artifact, or other isolated checkout when available.

Without a base result, use Git history and the diff only as supporting evidence and report attribution as uncertain when necessary.

## 6. Classify risk independently

Git attribution and cleanup risk are separate questions.

For example:

```text
Finding: src/public-api.ts: legacyParser
Attribution: PR-ASSOCIATED
Risk: REVIEW
Reason: the branch removed its internal consumer, but the symbol is part of the package's public exports.
```

A PR-associated finding is not automatically safe to remove. Apply the SAFE, REVIEW, and CONFIGURATION rules from `risk-classification.md` independently.

## 7. Keep the cleanup scoped

Prefer cleanup that is directly related to the branch.

Avoid opportunistic removal of unrelated pre-existing dead code because it increases review noise and makes regressions harder to attribute.

If unrelated findings are useful to mention, report them separately as follow-up candidates.

## 8. Validate against the branch intent

After a cleanup change:

1. review the resulting Git diff;
2. confirm the cleanup did not broaden the PR's intended behavior change;
3. run the repository's relevant validation commands;
4. rerun Knip;
5. confirm the targeted finding disappeared without introducing new failures.

## Suggested report

```text
PR scope:
- changed workspaces: packages/parser
- relevant change: removed the final internal consumer of parseLegacy

Knip finding:
- packages/parser/src/legacy.ts: parseLegacy

Attribution: PR-ASSOCIATED
Risk: SAFE
Evidence:
- final repository consumer removed in this branch
- symbol is not part of package exports
- no runtime/configuration reference found
- validation passes after cleanup

Action:
- remove the unused internal export

Remaining unrelated findings:
- 3 pre-existing/uncertain findings left unchanged
```
