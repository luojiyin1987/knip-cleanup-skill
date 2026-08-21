# Confidence and evidence model

Use this reference to make Knip cleanup decisions explainable and repeatable.

The model keeps three questions separate:

1. **Risk** — what kind of action is appropriate? `SAFE`, `REVIEW`, or `CONFIGURATION`.
2. **Confidence** — how strong is the evidence for that risk classification? `HIGH`, `MEDIUM`, or `LOW`.
3. **Attribution** — for Git-aware review, is the finding `PR-ASSOCIATED`, `PRE-EXISTING`, or `UNCERTAIN`?

Confidence is **not** a probability that deletion is safe. A finding can be `REVIEW / HIGH` when there is strong evidence that human or compatibility review is required.

Do not invent numeric confidence percentages.

## Evidence dimensions

For each non-trivial finding, inspect the dimensions that can materially change the decision.

### 1. Static reachability

Useful evidence includes:

- Knip reports the item unused;
- repository search finds no static imports or consumers;
- re-export chains have been checked;
- the item is not referenced from scripts or configuration.

Knip output alone is evidence, but it is not enough for `SAFE / HIGH`.

### 2. Public API exposure

Check relevant package metadata and API surfaces:

- `exports`;
- `main`;
- `module`;
- `types`;
- `bin`;
- documented or intentionally published entry points.

A repository may have no internal consumer while external consumers still depend on the API.

### 3. Runtime discovery and side effects

Look for runtime mechanisms static analysis may not fully prove:

- dynamic `import()`;
- computed module names;
- file-system discovery;
- plugin registration;
- dependency injection or reflection;
- framework conventions;
- side-effect-only imports;
- top-level registration behavior.

Unresolved runtime discovery is counter-evidence against a `SAFE` classification.

### 4. Workspace and ownership boundaries

In monorepos, check:

- which manifest owns the dependency or entry point;
- cross-workspace consumers;
- root-level tooling and shared dependencies;
- dependent packages that consume public exports;
- whether a filtered Knip run omitted relevant repository context.

A workspace-local result is not sufficient evidence by itself.

### 5. Git causality

For PR or branch review, Git evidence can explain why an item became unused:

- the final consumer was removed;
- an entry point changed;
- a feature implementation was deleted;
- a dependency became unnecessary after a refactor.

Git causality helps attribution and prioritization. It does not make the cleanup safe by itself.

### 6. Validation

Use the repository's existing checks, such as:

- lint;
- typecheck;
- targeted tests;
- broader tests;
- build or package checks;
- final Knip run.

Passing validation strengthens a classification but does not prove that external consumers or untested runtime discovery do not exist.

## Record evidence explicitly

For each important dimension, record one of:

- **SUPPORTS** — evidence supports the current classification;
- **CONTRADICTS** — evidence conflicts with the current classification;
- **UNKNOWN** — important evidence could not be established.

Prefer concrete repository evidence over filename or directory-name guesses.

Example:

```text
Finding: src/legacy/parser.ts
Risk: SAFE
Confidence: HIGH
Evidence:
- SUPPORTS: Knip reports the file unused
- SUPPORTS: no imports or re-exports found
- SUPPORTS: not exposed by package metadata
- SUPPORTS: no runtime/configuration reference found
- SUPPORTS: test and build pass after removal
Unknowns: none material
```

## Confidence levels

### HIGH

Use **HIGH** when the evidence needed for the chosen classification has been checked and no material contradiction remains.

For `SAFE / HIGH`, normally require evidence covering all relevant boundaries:

- static reachability checked;
- public API exposure ruled out;
- runtime/convention-based loading reasonably ruled out;
- workspace ownership and cross-workspace consumers checked when applicable;
- relevant validation passes after the change when a change has been applied.

`REVIEW / HIGH` is appropriate when strong evidence shows that the item is public, dynamically loaded, compatibility-sensitive, or otherwise unsuitable for automatic cleanup.

`CONFIGURATION / HIGH` is appropriate when strong evidence shows the code is intentional and Knip configuration is the real gap.

### MEDIUM

Use **MEDIUM** when the current classification is supported, but one material evidence dimension is incomplete or indirect.

Examples:

- an internal export appears unused, but broader validation is unavailable;
- a dependency has no static references, but a repository tool may invoke its binary indirectly;
- workspace consumers were checked, but external package consumers cannot be assessed;
- a PR clearly removed the final repository consumer, but API compatibility remains uncertain.

Do not treat `SAFE / MEDIUM` as an automatic-fix candidate by default. Gather more evidence or request review.

### LOW

Use **LOW** when the classification relies mostly on weak signals or material contradictions remain unresolved.

Examples:

- only the Knip finding has been inspected;
- the decision is based on a filename or directory name;
- package metadata has not been checked;
- dynamic loading is plausible but unexplored;
- a workspace-filtered run is the only analysis performed;
- validation fails or cannot be interpreted;
- repository evidence conflicts with the proposed classification.

A `LOW` finding should not be changed automatically.

## Evidence quality rules

Use these rules when evidence conflicts:

1. Direct repository metadata is stronger than naming conventions.
2. Actual imports, registrations, scripts, and configuration are stronger than assumptions about how a file is used.
3. Public API exposure outweighs the absence of internal consumers.
4. Known dynamic loading outweighs a static "unused" result.
5. A trusted base/current comparison is stronger attribution evidence than "the file changed in this PR".
6. Full repository or dependency-aware workspace analysis is stronger than an isolated workspace result.
7. Passing tests are supporting evidence, not proof of no external usage.
8. Failed validation blocks automatic cleanup until the failure is understood.

## Automatic-action threshold

By default:

| Risk | Confidence | Default action |
| --- | --- | --- |
| SAFE | HIGH | eligible for a small automatic cleanup |
| SAFE | MEDIUM | inspect further or request review |
| SAFE | LOW | do not change automatically |
| REVIEW | any | do not change automatically |
| CONFIGURATION | any | prefer configuration or documentation changes |

Explicit task scope can authorize a reviewed breaking API change or other higher-risk action, but confidence labels must still reflect the evidence honestly.

## Downgrade and reclassification rules

When new evidence appears, update the decision instead of defending the original label.

Examples:

- discovering a package `exports` entry changes a candidate from `SAFE` to `REVIEW`;
- discovering framework convention loading may change `SAFE` to `CONFIGURATION` or `REVIEW`;
- finding a cross-workspace consumer changes `SAFE` to `REVIEW` or invalidates the unused assumption;
- a failed build after deletion removes the basis for `SAFE / HIGH`;
- a clean broader scan and successful validation can raise `SAFE / MEDIUM` to `SAFE / HIGH` when no material unknown remains.

## Suggested report shape

```text
Finding: packages/parser/src/legacy.ts:parseLegacy
Risk: SAFE
Confidence: HIGH
Attribution: PR-ASSOCIATED

Supporting evidence:
- Knip reports the export unused
- branch removed its final repository consumer
- symbol is not part of package exports
- no dynamic/configuration reference found
- dependent workspace checks pass

Counter-evidence:
- none found

Unknowns:
- none material

Action:
- remove the unused internal export
```

For an uncertain public API finding:

```text
Finding: packages/core/src/index.ts:legacyApi
Risk: REVIEW
Confidence: HIGH
Attribution: PR-ASSOCIATED

Supporting evidence:
- branch removed the final internal consumer
- package export map still exposes the symbol

Counter-evidence to automatic removal:
- published API may have external consumers

Action:
- leave unchanged unless breaking API removal is explicitly in scope
```
