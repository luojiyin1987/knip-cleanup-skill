# Dynamic runtime usage guidance

Use this reference when a Knip finding may be affected by runtime discovery, side effects, framework conventions, or other behavior that static reachability cannot fully establish.

The goal is not to assume that all dynamic code is unsafe to clean up. The goal is to investigate the runtime boundary explicitly and record whether it supports `SAFE`, `REVIEW`, or `CONFIGURATION`.

Do not replace repository evidence with framework folklore, directory-name guesses, or a generic list of files that are "usually special".

## 1. Start from the concrete finding

For each relevant Knip finding, identify:

- the exact file, export, type, or dependency being reported;
- the package or workspace that owns it;
- the runtime path by which the item could be reached;
- whether the possible usage is static, dynamically selected, convention-based, side-effect-only, or externally invoked.

A repository containing some dynamic loading does not make every finding in that repository dynamic.

Investigate whether the specific candidate can participate in the runtime mechanism.

## 2. Dynamic import and require

Treat literal and computed module paths differently.

A literal dynamic import such as:

```ts
await import("./parser.js");
```

still gives strong repository evidence about the target module.

A computed import such as:

```ts
await import(`./plugins/${name}.js`);
```

creates a broader runtime boundary. A candidate that may match the computed path should not be classified `SAFE` until the possible values or selection mechanism have been understood.

The same caution applies to patterns such as:

```js
require(moduleName);
require(`./commands/${command}`);
```

Check, as applicable:

- how the path or module name is constructed;
- the allowed values of the selector;
- configuration that supplies those values;
- whether the candidate can match the resulting path;
- whether build tooling rewrites or expands the dynamic import.

Use `REVIEW` when the candidate may be reachable but the runtime selection cannot be resolved confidently.

If repository evidence establishes that the candidate cannot match the runtime selection, dynamic import alone is not a reason to keep the finding out of `SAFE` consideration.

## 3. Filesystem and glob discovery

Look for code that discovers modules or assets by scanning the filesystem rather than importing each candidate statically.

Common evidence includes use of:

- `fs.readdir`, `fs.readdirSync`, or directory iteration;
- `glob`, `fast-glob`, or similar libraries;
- recursive file walking;
- filename or extension filters;
- runtime loading of the paths returned by those scans.

Directory names such as `plugins`, `commands`, `routes`, `handlers`, `migrations`, or `adapters` are only investigation hints. They are not proof of runtime usage.

Prefer a concrete chain of evidence:

```text
runtime discovery code
-> scanned directory or glob
-> candidate matches the discovery rule
-> candidate is loaded or interpreted at runtime
```

If that chain is established and Knip does not model it, the finding is usually `CONFIGURATION` when the code is intentionally reachable through that mechanism.

If discovery exists but it is unclear whether the candidate is included, use `REVIEW` until the filter, runtime configuration, or registration path is understood.

If the candidate is outside the discovered paths or excluded by an established filter, the existence of filesystem discovery elsewhere does not block `SAFE` classification.

## 4. Registration and side effects

An unused export and an unused module are not the same decision.

A module may have runtime value because importing it performs registration or another top-level side effect even when none of its exports are referenced directly.

Look for patterns such as:

```ts
registerPlugin(plugin);
registry.set(name, handler);
container.bind(Token).to(Service);
router.use(route);
```

and side-effect imports such as:

```ts
import "./register-plugin.js";
```

Also inspect package metadata, application bootstrap code, and configuration that may cause a module to be imported only for initialization.

When a module has intentional registration or initialization behavior:

- do not infer that the module is removable because its exports are unused;
- distinguish removing an unused export from deleting the implementation file;
- prefer `REVIEW` when the runtime role is plausible but not established;
- prefer `CONFIGURATION` when repository evidence establishes intentional runtime reachability that Knip is missing.

A side effect that cannot be reached at runtime is not automatically a reason to retain the file. The important question is whether the module itself is actually loaded.

## 5. Framework and convention-based entry points

Frameworks and build tools may discover files by naming or directory convention.

Do not maintain a hard-coded catalogue of framework-specific "special files" in this skill. Framework behavior changes, plugins alter conventions, and projects frequently customize defaults.

Instead, investigate the repository's actual convention boundary:

1. identify the framework or tool from package metadata and configuration;
2. inspect relevant package scripts and build commands;
3. inspect framework or plugin configuration;
4. compare the candidate with neighboring files that are clearly convention-managed;
5. confirm whether the framework discovers that path, filename, or export shape;
6. check whether Knip already has or needs configuration that represents the convention.

Use repository-specific evidence over assumptions based on the file name alone.

Typical decisions are:

- confirmed intentional convention loading that Knip does not understand -> `CONFIGURATION`;
- plausible convention loading but unresolved applicability -> `REVIEW`;
- convention role reasonably ruled out -> continue normal `SAFE` evaluation.

## 6. External invocation and non-import entry points

Some code is used without another source file importing it.

Check for entry points referenced by:

- `package.json` scripts;
- `bin`, `exports`, `main`, `module`, or `types` metadata;
- task runners and build configuration;
- deployment or container configuration;
- test runners and setup files;
- migration or code-generation tools;
- hooks invoked by external systems.

A dependency can similarly be used through its executable, plugin name, preset, loader, or adapter rather than through a normal import.

Confirmed intentional invocation generally contradicts a `SAFE` deletion decision. If Knip can be configured to represent the entry point, prefer `CONFIGURATION` over deleting intentional code.

## 7. Decide between REVIEW and CONFIGURATION

Use the distinction below when dynamic behavior affects a finding.

| Runtime evidence | Default classification direction |
| --- | --- |
| intentional runtime or framework loading is established, but Knip does not model it | `CONFIGURATION` |
| a dynamic mechanism exists and the candidate may participate, but applicability cannot be established | `REVIEW` |
| the runtime mechanism has been checked and the candidate cannot participate | continue normal `SAFE` evaluation |
| only a filename or directory name suggests dynamic usage | insufficient evidence; investigate further |
| public API compatibility remains relevant even if runtime loading is ruled out | `REVIEW` |

`CONFIGURATION` should describe intentional code that Knip is failing to understand, not a convenient way to silence an uncertain finding.

Do not add broad ignores merely because runtime behavior is difficult to investigate.

## 8. Record the runtime evidence explicitly

Use the existing evidence vocabulary from [confidence-evidence.md](confidence-evidence.md): `SUPPORTS`, `CONTRADICTS`, and `UNKNOWN`.

Example of an unresolved plugin file:

```text
Finding: src/plugins/legacy.ts
Risk: REVIEW
Confidence: HIGH

Runtime evidence:
- SUPPORTS: src/plugins/index.ts scans src/plugins/*.ts
- SUPPORTS: legacy.ts matches the discovery glob
- UNKNOWN: runtime configuration may exclude legacy.ts

Action:
- do not delete automatically
- inspect runtime filtering before reconsidering
```

High confidence here means there is strong evidence that review is required. It does not mean deletion is probably safe.

Example of a configuration gap:

```text
Finding: src/commands/deploy.ts
Risk: CONFIGURATION
Confidence: HIGH

Runtime evidence:
- SUPPORTS: the command loader scans src/commands/*.ts
- SUPPORTS: deploy.ts matches the loader convention
- SUPPORTS: package scripts start the command loader

Action:
- keep the file
- represent the command entry point in Knip configuration when appropriate
```

Example where dynamic behavior is ruled out for the candidate:

```text
Finding: src/legacy/parser.ts
Risk: SAFE
Confidence: HIGH

Runtime evidence:
- SUPPORTS: plugin discovery is limited to src/plugins/*.ts
- SUPPORTS: parser.ts is outside the discovered path
- SUPPORTS: no import, script, package metadata, or framework entry point reaches parser.ts
- CONTRADICTS: none
- UNKNOWN: none material

Action:
- continue through the normal execution gate
```

## 9. Let new runtime evidence change the decision

Do not preserve an earlier classification when runtime inspection reveals stronger evidence.

Examples:

- finding a filesystem loader may change `SAFE` to `REVIEW`;
- proving that the candidate is always loaded by convention may change `REVIEW` to `CONFIGURATION`;
- proving that a candidate cannot match a dynamic path may remove a material unknown and raise confidence in `SAFE`;
- discovering package metadata exposure may keep the finding at `REVIEW` even after runtime loading is ruled out.

After classification and confidence are updated, return to [execution-policy.md](execution-policy.md). Dynamic runtime investigation informs the execution gate; it does not bypass it.

## Safeguards

- Do not classify by directory or filename alone.
- Do not assume all dynamic imports are equally opaque.
- Do not assume an unused export means its module has no runtime side effects.
- Do not create a framework-specific rule database in this skill.
- Do not use broad Knip ignores to hide unresolved runtime uncertainty.
- Do not call code intentional without repository evidence for the runtime path.
- Do not call code safe solely because tests pass; runtime discovery may be untested.
