# Knip finding semantics

Use this reference before assigning cleanup risk to a Knip finding.

Knip issue types describe different kinds of evidence. They are not interchangeable, and none of them should be translated mechanically into "delete this code."

The most important rule is:

> An unused export is evidence about an export surface, not proof that the declaration or implementation is unused.

Interpret the reported issue type first, then investigate the concrete candidate before assigning `SAFE`, `REVIEW`, or `CONFIGURATION`.

## 1. Preserve the meaning of each issue type

Common Knip issue types should be read as follows:

| Knip issue | What the finding establishes | What it does **not** establish |
| --- | --- | --- |
| `files` | Knip cannot find a reference that makes the file reachable in its current project graph | the file is safe to delete |
| `dependencies` / `devDependencies` | Knip cannot find a recognized reference to the declared dependency | the declaration is unnecessary in every script, plugin, binary, runtime, peer, or workspace context |
| `exports` | Knip cannot find a reference to the exported value from another reachable module | the declaration or implementation itself is unused |
| `types` | Knip cannot find a reference to the exported type surface | the type declaration itself has no internal type consumers |
| `unlisted` | a dependency is referenced but is not declared in the relevant manifest | dead code exists; this is normally a dependency declaration problem, not a cleanup candidate |
| `binaries` | a referenced binary is not provided by a dependency declared for the relevant package | the command is unused; this is an unlisted-binary problem |
| `unresolved` | Knip cannot resolve an import or other supported specifier | the target is unused; unresolved analysis usually lowers confidence until understood |

Knip has additional issue types such as namespace exports, enum members, duplicate exports, catalog issues, and cycles. Preserve their Knip-specific meaning instead of forcing them into the unused-file/export/dependency model.

A finding type controls what still has to be proved. It does not replace repository evidence.

## 2. Unused export is not dead implementation

For every `exports` finding, separate two questions:

1. Is the **export surface** unused by other reachable modules?
2. Is the **declaration or implementation** itself unused?

These are independent.

For example:

```ts
export const computeChangePct = (current: number, previous: number) =>
  ((current - previous) / previous) * 100;

export function summarize(current: number, previous: number) {
  return computeChangePct(current, previous).toFixed(1);
}
```

If Knip reports `computeChangePct` as an unused export, `summarize` may still use the declaration inside the same file.

The likely cleanup boundary is therefore:

```diff
-export const computeChangePct = ...
+const computeChangePct = ...
```

not deletion of the declaration.

Do not describe these two actions with the same word.

Use precise action terminology:

- **remove export modifier** — keep a declaration that still has internal consumers;
- **delete unused declaration** — remove the declaration only after internal consumers and side effects are ruled out;
- **keep and review** — retain the declaration when public API, runtime, compatibility, or side-effect evidence requires review.

## 3. Record external and internal consumers separately

For every non-trivial `exports` or `types` finding, record both dimensions when they affect the action:

```text
External consumers: none | found | unknown
Internal consumers: none | found | unknown
```

Use the following decision direction:

| External consumers | Internal consumers | Default interpretation |
| --- | --- | --- |
| none | found | export surface may be unnecessary; implementation/declaration is still used |
| none | none | declaration may be a cleanup candidate after public API, runtime, and side-effect checks |
| found | any | do not treat the export as unused based on local search; reconcile the evidence |
| unknown | any | do not claim `SAFE / HIGH` until the material unknown is resolved |

"Internal consumer" includes same-file runtime references and, for types, same-file type references.

Do not infer `Internal consumers: none` from a repository-wide import search. Search or inspect the declaring file itself.

## 4. Check the declaration boundary before proposing an action

For an unused export or exported type, answer the applicable questions before choosing an action:

- Is the symbol referenced elsewhere in the same file?
- Is the symbol referenced through a re-export chain?
- Is the export part of a package entry point or export map?
- Is the package published, private, or compatibility-sensitive?
- Do dependent workspaces consume it?
- Can runtime registration, reflection, filesystem discovery, or framework behavior reach it?
- Does evaluating the declaration or initializer have side effects?
- Would removing only the export surface preserve behavior?
- Would deleting the declaration change module initialization?

A missing material answer should reduce confidence rather than being silently assumed safe.

## 5. Treat initializer and top-level side effects explicitly

Export syntax can be attached to code whose evaluation matters even when the export surface is unused.

For example:

```ts
export default new OrganizationModel();
```

This is not equivalent to a side-effect-free declaration such as:

```ts
export class ProjectModel {}
```

Before changing an exported initializer or expression, inspect whether evaluation can:

- read environment or process state;
- register listeners, routes, plugins, hooks, or handlers;
- mutate a registry or singleton;
- perform I/O or network work;
- create a resource whose construction has observable effects;
- affect another live export through module initialization.

Do not delete an initializer merely because its export is unused.

If the export surface is unnecessary but evaluation is intentionally required, preserve the required behavior or classify the finding for review/configuration according to the repository evidence.

## 6. Interpret unused files as reachability findings

An unused-file finding means Knip did not find a reference that reaches the file in its current graph.

It does not by itself rule out:

- CI or deployment invocation;
- package scripts or binaries;
- dynamic imports;
- filesystem or glob discovery;
- framework conventions;
- migrations, generators, fixtures, templates, or operational scripts;
- side-effect-only loading;
- external commands or tooling.

`Knip reports unused file` plus `repository search finds no import` is not sufficient for `SAFE / HIGH` file deletion.

Follow the stricter file-deletion gate in [execution-policy.md](execution-policy.md) and runtime investigation in [dynamic-runtime-usage.md](dynamic-runtime-usage.md).

## 7. Interpret unused dependencies as declaration findings

An unused dependency finding means Knip did not find a recognized use of the dependency declaration.

Before calling a dependency `SAFE / HIGH`, check applicable non-import use paths, including:

- package scripts and binaries;
- configuration plugins, presets, loaders, adapters, or processors;
- runtime or conditional loading;
- code generation and build tooling;
- the manifest that owns the dependency;
- root/shared tooling in a monorepo;
- dependent workspaces;
- peer-dependency or optional-peer expectations;
- whether the declaration is intentionally direct rather than relying on a transitive provider.

Do not remove a direct dependency merely because the package is currently available transitively through another dependency.

Dependency ownership and package-boundary evidence remain separate from Knip's finding itself.

## 8. Treat unlisted, binary, and unresolved findings as diagnostic evidence

Not every Knip issue is a removal candidate.

### Unlisted dependencies

`unlisted` means code or configuration references a dependency that is not declared in the relevant manifest.

The usual question is where and how it should be declared, not what dead code should be deleted.

Do not classify an unlisted dependency as a `SAFE` removal merely because it appears in a dead-code report.

### Unlisted binaries

`binaries` means a referenced command cannot be matched to an appropriately declared package that provides that binary.

Investigate the script and package ownership. Do not interpret the issue as "this command is unused."

### Unresolved imports

`unresolved` means Knip cannot resolve a supported specifier.

An unresolved import is counter-evidence to overconfident cleanup because the analysis graph may be incomplete.

Resolve or explain a material unresolved edge before using absence of consumers as `HIGH`-confidence deletion evidence.

## 9. Respect finding chains

Knip findings can cascade from one missing or unreachable entry path.

For example:

```text
missing runtime/CI entry
-> file appears unused
-> imports reachable only from that file appear unused
-> their exports appear unused
-> dependencies used only by that chain appear unused
```

When multiple issue types point into the same unreachable area, investigate the root reachability problem before independently labeling every downstream export or dependency `SAFE / HIGH`.

A large cluster of apparently unused files, exports, and dependencies is evidence to look for a common entry/configuration gap, not permission to mass-delete the cluster.

Configuration modeling itself is covered separately from this finding-semantics guide.

## 10. Use precise action labels in reports

Prefer action labels that identify the exact proposed change:

- `remove dependency`
- `delete unused file`
- `remove export modifier`
- `delete unused declaration`
- `add or correct Knip entry/configuration` (recommendation only when analysis-only mode applies)
- `keep and review`
- `no action in analysis-only mode`

Avoid ambiguous phrases such as "clean this symbol" or "delete dead code" when the finding only establishes an unused export surface.

In analysis-only mode, all action labels are recommendations. Do not execute them.

## 11. Confidence follows evidence, not issue count

Do not assign `SAFE / HIGH` to a group merely because every item has the same Knip issue type.

For grouped findings, either:

- establish that the same evidence genuinely applies to every named member; or
- split out exceptions and unknowns.

For `exports` and `types`, `HIGH` confidence requires the action boundary to be clear enough to distinguish export-surface cleanup from declaration deletion.

For `files` and `dependencies`, `HIGH` confidence requires the applicable entry/runtime/tooling/ownership checks to be complete enough that the proposed action is supported.

If a material check is incomplete, use `MEDIUM` or `LOW` confidence as appropriate rather than filling the gap with an assumption.

## Non-negotiable safeguards

- Do not translate every Knip issue into deletion.
- Do not equate an unused export with an unused declaration.
- Do not delete a declaration without checking same-file consumers.
- Do not delete an exported initializer without checking top-level evaluation and side effects.
- Do not call an unused file safe based only on Knip plus absence of static imports.
- Do not call an unused dependency safe based only on Knip plus absence of source imports.
- Do not treat `unlisted`, `binaries`, or `unresolved` as ordinary dead-code removal findings.
- Do not give a whole group `SAFE / HIGH` unless the required evidence applies to every member.
