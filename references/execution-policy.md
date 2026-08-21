# Cleanup execution policy

Use this reference after a finding has been interpreted and classified.

The question here is not whether Knip reported something. It is whether the requested task may safely perform a specific change.

## Default gate

| Risk | Confidence | Default policy |
| --- | --- | --- |
| SAFE | HIGH | eligible for a scoped automatic change |
| SAFE | MEDIUM/LOW | gather evidence or review first |
| REVIEW | any | keep unless the user explicitly authorizes the reviewed behavior/API change |
| CONFIGURATION | HIGH | keep intentional code; correct the Knip model when authorized |
| CONFIGURATION | MEDIUM/LOW | keep intentional code; gather evidence or recommend a model correction |

`SAFE / HIGH` is eligibility, not permission for every possible deletion.

Analysis-only mode overrides this table: no repository change is allowed.

## Match the action to the finding boundary

Prefer the smallest correct action.

### Dependency

Before removal, use repository/CLI evidence to establish that the owning manifest no longer needs the package. Search for material import, script, binary, plugin, config, workspace, or tooling usage when relevant. Package-manager `why`/`explain` output can help establish ownership or dependency context.

Use the repository's package manager for an authorized removal so manifest and lockfile remain consistent.

### Export or exported type

An unused export does not prove the declaration is dead.

- internal consumer exists -> prefer **remove export modifier**;
- no internal consumer and implementation is otherwise safe -> **delete unused declaration** may be eligible;
- public/compatibility boundary -> `REVIEW` unless explicitly authorized.

### File

File deletion has the highest default blast radius. Require `SAFE / HIGH` plus evidence that relevant entry paths, runtime discovery, side effects, package/workspace consumers, and intentional fixture/generated/migration roles are not material to the file.

Do not use `--allow-remove-files` as a shortcut around this decision.

### Configuration

When repository evidence proves intentional reachability that Knip missed, model the real relationship rather than deleting the code or broadly suppressing findings. See [configuration-modeling.md](configuration-modeling.md).

## Prefer evidence to more policy

When execution is ambiguous, first ask whether an existing repository or CLI source can answer the question:

- repository search;
- package-manager ownership/dependency explanation;
- Git diff/history;
- workspace metadata;
- existing build/typecheck/test behavior;
- already-available graph/debug tooling.

Do not solve ambiguity by adding another permanent framework rule to the Skill unless the behavior is stable and cannot be established from repository evidence.

## Small-batch loop

For authorized modifications:

1. make one coherent change;
2. inspect the diff;
3. confirm unrelated user work is untouched;
4. run relevant existing validation;
5. rerun Knip;
6. reclassify if new evidence appears.

Stop on unexplained validation failures. Revert or narrow only cleanup-owned changes; never use destructive repository-wide reset or automatic stashing to recover.

## Reporting

For each executed or blocked action, report the minimum reviewable facts:

```text
Finding: ...
Risk / confidence: ...
Decisive evidence: ...
Action: ...
Validation: ...
Result: executed | blocked | review | configuration
```

Passing validation does not prove there are no external consumers or unmodeled runtime paths.
