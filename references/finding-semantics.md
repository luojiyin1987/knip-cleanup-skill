# Knip finding semantics

Use this reference when the proposed action depends on what a Knip issue type actually proves.

## Core rule

> A Knip finding describes an analysis result at a specific boundary. It is not a generic instruction to delete code.

Common interpretations:

| Knip issue | What it means for cleanup |
| --- | --- |
| `files` | file is not reachable in Knip's current graph; deletion still needs entry/runtime/side-effect evidence |
| `dependencies` / `devDependencies` | declared package has no recognized use; scripts/config/plugins/ownership may still matter |
| `exports` | exported value has no known external consumer; declaration may still be used inside the file |
| `types` | exported type surface has no known external consumer; type declaration may still have internal consumers |
| `unlisted` | referenced dependency is not declared; normally a dependency declaration problem |
| `binaries` | referenced binary is not provided by an appropriate declared dependency; not an unused-command finding |
| `unresolved` | Knip could not resolve a supported specifier; analysis confidence may be incomplete |

Preserve the semantics of other Knip issue types rather than forcing them into a dead-code model.

## Compatible actions

The finding ledger enforces these action boundaries:

| Knip issue | Compatible actions |
| --- | --- |
| `files` | delete unused file; correct Knip model; keep and review |
| `dependencies` / `devDependencies` | remove dependency; correct Knip model; keep and review |
| `exports` / `types` | remove export modifier; delete unused declaration; correct Knip model; keep and review |
| `unlisted` | declare dependency; correct dependency declaration; keep and review |
| `unresolved` | correct unresolved reference; correct Knip model; keep and review |

Analysis-only mode can use `no action in analysis-only mode` for every issue. Unknown issue types fail closed. They only allow Knip model correction or review.

## Unused export is not unused declaration

Always separate:

```text
Is the export surface unused?
Is the declaration/implementation unused?
```

Example:

```ts
export const computeChangePct = (...) => ...;

export function summarize(...) {
  return computeChangePct(...);
}
```

If `computeChangePct` is reported as an unused export but still has same-file consumers, the likely action is:

```diff
-export const computeChangePct = ...
+const computeChangePct = ...
```

not deletion of the declaration.

When declaration liveness affects the action, inspect the declaring file and record internal/external consumers only as much as needed to make the distinction.

## Side-effect boundary

Deleting an exported declaration can remove behavior even when its export surface is unused. Pay attention to initializers and top-level expressions such as:

```ts
export default new Service();
```

Before deleting the expression or declaration, determine whether construction or module initialization has relevant side effects and whether the module is still reachable for other reasons.

## Dependency boundary

For an unused dependency finding, repository search plus package-manager ownership/`why`/`explain` evidence is usually more useful than adding more Skill heuristics. Check non-import usage only when it is materially plausible for the repository.

## Finding chains

One missing entry or project relationship can produce downstream unused files, exports, types, or dependencies. When many findings share a suspicious boundary, look for a common graph cause before classifying every item independently.

Use precise action names:

- remove dependency;
- delete unused file;
- remove export modifier;
- delete unused declaration;
- correct Knip model;
- declare dependency;
- correct dependency declaration;
- correct unresolved reference;
- keep and review.
