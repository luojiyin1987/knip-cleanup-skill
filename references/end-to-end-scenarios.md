# End-to-end cleanup scenarios

These scenarios show how the existing Knip cleanup policy can be applied from finding to final decision.

They are **illustrative, not normative**. If a scenario conflicts with a normative reference such as [risk-classification.md](risk-classification.md), [confidence-evidence.md](confidence-evidence.md), [dynamic-runtime-usage.md](dynamic-runtime-usage.md), [monorepo-cleanup.md](monorepo-cleanup.md), [git-aware-review.md](git-aware-review.md), [execution-policy.md](execution-policy.md), or [verification.md](verification.md), the normative reference wins.

Use the scenarios to understand how the pieces fit together:

```text
Knip finding
-> inspect repository context
-> classify risk
-> investigate runtime/workspace/Git evidence when relevant
-> assign confidence
-> apply the execution gate
-> make one small batch when eligible
-> inspect the diff
-> validate
-> rerun Knip
```

## Scenario template

A useful end-to-end record can include:

```text
Context:
Knip finding:

Risk:
Confidence:
Attribution:        # when Git attribution is relevant
Workspace:          # when workspace ownership is relevant

Supporting evidence:
Counter-evidence:
Unknowns:

Execution decision:
Changes:
Validation:
Final Knip result:
Outcome:
```

Not every field is required for every finding. Record the evidence that can materially change the decision.

---

## Scenario 1: internal unused export is eligible for cleanup

### Context

A library workspace contains an old parser helper:

```ts
// packages/parser/src/legacy.ts
export function parseLegacy(input: string) {
  return input.trim();
}
```

Knip reports `parseLegacy` as an unused export.

### Investigation

Repository inspection establishes:

- no imports or re-exports consume `parseLegacy`;
- the symbol is not exposed through the package export map or another public entry point;
- no dynamic registration, reflection, or convention-based loading refers to the symbol;
- no dependent workspace imports it;
- the file itself contains other live implementation code, so the candidate is the export surface rather than the whole file.

### Decision

```text
Context:
- packages/parser is an internal workspace package

Knip finding:
- packages/parser/src/legacy.ts:parseLegacy -> unused export

Risk: SAFE
Confidence: HIGH
Workspace: packages/parser

Supporting evidence:
- SUPPORTS: Knip reports the export unused
- SUPPORTS: repository search finds no import or re-export consumer
- SUPPORTS: package metadata does not expose the symbol publicly
- SUPPORTS: no runtime discovery or registration path reaches the symbol
- SUPPORTS: dependent workspaces do not consume the symbol

Counter-evidence:
- none found

Unknowns:
- none material

Execution decision:
- eligible for a scoped automatic cleanup
```

`SAFE / HIGH` makes the finding eligible for the execution gate. It is not unconditional permission to delete arbitrary surrounding code.

### Execution

Use one small semantic batch:

```text
Changes:
- remove the unnecessary export surface for parseLegacy
- keep unrelated implementation code unchanged
```

Inspect the diff before validation and confirm no public API or unrelated formatting changes were introduced.

### Validation

Run the checks already supported by the repository, for example the affected workspace's typecheck, tests, and build, then rerun Knip.

```text
Validation:
- parser typecheck: pass
- parser tests: pass
- parser build: pass
- Knip rerun: parseLegacy finding resolved

Final Knip result:
- no new finding in the same cleanup batch

Outcome:
- accepted
```

This scenario demonstrates the normal happy path: repository evidence supports `SAFE / HIGH`, the finding passes the type-specific execution gate, and the cleanup remains narrow and validated.

---

## Scenario 2: dynamically discovered plugin is a configuration finding

### Context

Knip reports a plugin file as unused:

```text
src/plugins/github.ts -> unused file
```

The repository contains a plugin loader similar to:

```ts
const files = await glob("src/plugins/*.ts");

for (const file of files) {
  await import(file);
}
```

### Investigation

The agent traces the concrete runtime path instead of treating the directory name `plugins` as proof.

Repository evidence shows:

- application bootstrap invokes the plugin loader;
- the loader scans `src/plugins/*.ts`;
- `src/plugins/github.ts` matches the discovery pattern;
- the file performs intentional plugin registration when loaded.

### Decision

```text
Knip finding:
- src/plugins/github.ts -> unused file

Risk: CONFIGURATION
Confidence: HIGH

Supporting evidence:
- SUPPORTS: application bootstrap invokes the plugin loader
- SUPPORTS: loader scans src/plugins/*.ts
- SUPPORTS: github.ts matches the discovery rule
- SUPPORTS: loading github.ts performs intentional registration

Counter-evidence:
- Knip reports no static consumer

Unknowns:
- none material to runtime reachability

Execution decision:
- do not delete the file
- investigate a narrow Knip configuration representation for the intentional entry path
```

The lack of a normal import consumer does not make the file dead. The runtime path is established, so this is not merely unresolved risk.

### Execution

If the task includes resolving Knip false positives, make a narrow configuration correction that represents the intentional entry point or discovery mechanism when Knip supports it.

Do not add a broad ignore merely to obtain a clean report.

### Validation

```text
Validation:
- rerun Knip after the narrow configuration change
- confirm github.ts is no longer incorrectly reported
- confirm unrelated findings are still visible

Final Knip result:
- intended plugin finding resolved through configuration

Outcome:
- keep intentional code
- accept narrow configuration correction when appropriate
```

This scenario demonstrates the distinction from `REVIEW`: confirmed intentional runtime reachability that Knip does not model points toward `CONFIGURATION`.

---

## Scenario 3: public API remains REVIEW even with no repository consumers

### Context

A published package contains:

```ts
// packages/core/src/index.ts
export { legacyApi } from "./legacy-api.js";
```

Knip reports `legacyApi` as an unused export. Repository search finds no internal consumer.

### Investigation

Package metadata and release structure show that the symbol is part of the package's public entry point.

There is no evidence about external consumers that install the published package.

### Decision

```text
Knip finding:
- packages/core/src/index.ts:legacyApi -> unused export

Risk: REVIEW
Confidence: HIGH
Workspace: packages/core

Supporting evidence:
- SUPPORTS: Knip reports no repository consumer
- SUPPORTS: repository search confirms no internal consumer
- SUPPORTS REVIEW: the symbol is exported from the published package entry point
- SUPPORTS REVIEW: removal could be a breaking API change

Counter-evidence to removal:
- public API exposure means external consumers may exist

Unknowns:
- external consumer usage is not established

Execution decision:
- blocked by default
- leave unchanged unless the requested task explicitly authorizes the breaking API change
```

`REVIEW / HIGH` is correct here. HIGH confidence means the evidence strongly supports the classification that compatibility review is required.

### Validation does not change the public API semantics

Suppose the repository's checks all pass:

```text
Validation:
- typecheck: pass
- tests: pass
- build: pass
```

That evidence does not prove that published external consumers do not depend on `legacyApi`.

The result remains:

```text
Risk: REVIEW
Confidence: HIGH
Outcome: blocked by default
```

If the task explicitly authorizes a breaking API removal, execution may proceed under the reviewed scope, but the finding should remain classified `REVIEW` rather than being relabeled `SAFE`.

---

## Scenario 4: monorepo dependency cleanup uses ownership, Git, and dependent validation

### Context

A branch removes the last parser implementation that imported `legacy-parser`.

A focused Knip run reports:

```text
packages/parser/package.json -> legacy-parser -> unused dependency
```

### Investigation

Before removing the dependency, inspect more than the workspace-local Knip result.

Evidence establishes:

- `packages/parser/package.json` owns the dependency;
- no source import or require remains;
- package scripts do not invoke the dependency's executable;
- package configuration does not use it as a plugin, preset, loader, or adapter;
- root tooling does not rely on it;
- no other workspace expects the parser workspace to provide or use it;
- the branch removed the final repository consumer.

When a trusted base/current comparison supports that causal history, Git attribution can be recorded independently from cleanup risk.

### Decision

```text
Knip finding:
- packages/parser/package.json -> legacy-parser -> unused dependency

Risk: SAFE
Confidence: HIGH
Attribution: PR-ASSOCIATED
Workspace: packages/parser

Supporting evidence:
- SUPPORTS: Knip reports the dependency unused
- SUPPORTS: no imports or requires remain
- SUPPORTS: no script/config/plugin/binary usage found
- SUPPORTS: packages/parser/package.json owns the dependency
- SUPPORTS: root tooling does not use it
- SUPPORTS: relevant workspace consumers were checked
- SUPPORTS ATTRIBUTION: branch removed the final repository consumer

Counter-evidence:
- none found

Unknowns:
- none material

Execution decision:
- eligible for a scoped dependency-removal batch
```

The `PR-ASSOCIATED` attribution explains why the finding appeared. It is not what makes the dependency safe to remove.

### Execution

Use the repository's package manager so the owning manifest and lockfile stay consistent.

```text
Changes:
- remove legacy-parser from packages/parser/package.json
- update the lockfile
```

Inspect both manifest and lockfile changes before continuing.

### Validation

Start with the affected workspace, then expand when the dependency boundary can affect other packages.

```text
Validation:
- parser typecheck: pass
- parser tests: pass
- parser build: pass
- relevant dependent workspace checks: pass
- broader/final Knip run: dependency finding resolved

Outcome:
- accepted
```

This scenario demonstrates why a workspace filter is a focus mechanism rather than proof of isolation, and why Git attribution remains a separate axis from risk and confidence.

---

## Scenario 5: unused file deletion is blocked when runtime discovery is unresolved

### Context

Knip reports:

```text
src/migrations/2024-old.ts -> unused file
```

Repository search finds no static imports.

The project also contains a migration runner, but initial inspection does not establish whether it discovers every file in `src/migrations`, only files listed in configuration, or a filtered subset.

### Investigation

The absence of imports supports further investigation, but it is not sufficient evidence for file deletion.

```text
Knip finding:
- src/migrations/2024-old.ts -> unused file

Risk: REVIEW
Confidence: MEDIUM

Supporting evidence:
- SUPPORTS possible cleanup: Knip reports the file unused
- SUPPORTS possible cleanup: no static imports found
- SUPPORTS REVIEW: the project has runtime migration discovery

Counter-evidence to automatic deletion:
- migration files may be invoked by convention rather than imports

Unknowns:
- UNKNOWN: whether 2024-old.ts matches the migration runner's discovery/filtering rules
- UNKNOWN: whether deployment or operational tooling invokes the migration externally

Execution decision:
- blocked
- inspect the migration discovery path before reconsidering deletion
```

Do not run:

```sh
knip --fix --allow-remove-files
```

just because the file has no static consumer.

### Possible follow-up outcomes

If later evidence proves that the migration runner loads the file intentionally, reclassify toward `CONFIGURATION` when Knip is missing that runtime path.

If later evidence proves that the file cannot be discovered, is not externally invoked, is not an intentional retained migration artifact, and satisfies the stricter file-deletion checks, the finding may be reconsidered for `SAFE / HIGH`.

Until then:

```text
Outcome:
- keep file unchanged
- no automatic deletion
```

This scenario demonstrates that file deletion has a stricter execution threshold than removing an internal export.

---

## Comparing the outcomes

| Scenario | Risk | Confidence | Default execution result |
| --- | --- | --- | --- |
| internal unused export | SAFE | HIGH | eligible for scoped cleanup |
| dynamically discovered plugin | CONFIGURATION | HIGH | keep code; fix Knip configuration when appropriate |
| published unused API | REVIEW | HIGH | blocked unless breaking change is explicitly in scope |
| monorepo unused dependency | SAFE | HIGH | eligible after ownership and cross-workspace checks |
| migration file with unresolved discovery | REVIEW | MEDIUM | blocked pending runtime evidence |

The important pattern is that the Knip label is only the starting point. The final action depends on repository evidence, risk classification, confidence, workspace and Git context when relevant, and the finding-specific execution gate.

## What the scenarios do not authorize

These examples do not create shortcuts around the core policy.

- Do not infer `SAFE` from a passing test suite alone.
- Do not infer PR causality from a changed filename alone.
- Do not infer runtime usage from a directory name alone.
- Do not infer isolation from a workspace-filtered Knip run alone.
- Do not treat HIGH confidence as permission to modify `REVIEW` or `CONFIGURATION` findings.
- Do not delete files with `--allow-remove-files` before reviewing the candidates against the file-deletion gate.
- Do not use broad Knip ignores to make unresolved findings disappear.
- Do not discard unrelated user work while applying or recovering from a cleanup.

When a real repository differs from these scenarios, follow the repository evidence and the normative references rather than forcing the finding into the closest example.
