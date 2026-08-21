# Analysis-only mode

Use this reference when the user asks to inspect, analyze, review, classify, or report **without modifying the repository**.

## Contract

Analysis-only means read-only:

- do not edit source, configuration, manifests, lockfiles, or generated project files;
- do not install, add, update, or temporarily fetch Knip or another analyzer;
- do not run Knip fix/file-removal options;
- do not apply `SAFE / HIGH` cleanup;
- do not change Git branches, index state, commits, or tags;
- do not use destructive Git recovery to hide accidental changes.

If Knip is not already available through a known local installation or approved interface, report that limitation and continue only with read-only repository evidence.

Package runners such as `npx`, `npm exec`, or `bunx` must not be used when they would obtain Knip from a registry.

## Prefer read-only evidence

Use tools that do not intentionally mutate the repository, for example:

- repository search (`rg` or equivalent);
- reading manifests, scripts, configuration, workflows, and source;
- package-manager read-only queries such as dependency explanation/ownership commands when known safe in that repository;
- Git inspection commands;
- existing diagnostic commands only when they are known not to rewrite project state.

Avoid builds, generators, formatters, migrations, or other commands that are known to rewrite project files or ignored build output unless the task explicitly allows that behavior.

## Repository-state check

When Git is available, capture the initial Git-visible state and compare it with the final state. `git status --porcelain=v1 --untracked-files=all` is a useful baseline; use diffs when pre-existing modifications make status text insufficient.

The invariant is:

```text
no cleanup-owned repository mutation
```

Do not overclaim that Git proves every ignored cache or build artifact is unchanged. Instead, avoid commands known to generate those artifacts.

If an unexpected mutation occurs, stop and report it. Revert only cleanup-owned changes when they are safely separable; never discard unrelated user work.

## Stop point

Analysis-only work may still:

- run Knip report-only when already available;
- interpret findings;
- collect repository/CLI evidence;
- classify risk and confidence;
- report hypothetical execution eligibility;
- recommend the smallest future action.

Then stop.

Report that analysis-only mode was used, whether Knip was available without installation, and whether the final Git-visible state matched the initial state.
