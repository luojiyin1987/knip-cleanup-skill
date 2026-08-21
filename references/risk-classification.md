# Risk classification

Use this reference to classify Knip findings before modifying code.

The labels describe the appropriate cleanup posture, not confidence or absolute runtime safety. Static analysis can miss dynamic usage. Record confidence separately with [confidence-evidence.md](confidence-evidence.md).

## SAFE

Use **SAFE** only when there is strong repository evidence that the item is internal and unused.

Typical examples:

- an internal export with no consumers and no public package exposure;
- an unused dependency with no script, config, plugin, binary, or runtime reference;
- an implementation file with no imports, no entry-point role, and no convention-based runtime loading;
- an unused type or re-export that exists only for internal code;
- dead helpers left behind by a completed refactor.

Before classifying SAFE, check relevant package metadata and configuration when applicable.

A SAFE classification does not automatically authorize a change. By default, automatic cleanup also requires HIGH confidence in the supporting evidence.

## REVIEW

Use **REVIEW** when static analysis is plausible but runtime or compatibility usage cannot be ruled out confidently, or when the item is intentionally part of a compatibility-sensitive surface.

Common signals:

- public exports from a library package;
- `exports`, `main`, `module`, `types`, or `bin` targets;
- CLI entry points;
- dynamic `import()` paths or computed module names;
- reflection or dependency-injection registration;
- plugin, adapter, loader, migration, hook, command, route, or handler directories discovered by convention;
- side-effect imports or modules with top-level registration behavior;
- CommonJS patterns that may be consumed dynamically;
- files referenced outside the package through tooling or deployment configuration;
- code whose removal could be a breaking API change even if the repository itself has no consumer.

Do not automatically delete REVIEW findings.

A finding can be `REVIEW / HIGH`: high confidence may mean there is strong evidence that review is required, not that removal is safe.

## CONFIGURATION

Use **CONFIGURATION** when the code appears intentional and the finding is better explained by Knip not knowing how the project reaches it.

Typical examples:

- framework-specific entry points;
- generated files that must remain in the repository;
- test fixtures, examples, templates, or snapshots intentionally outside normal imports;
- custom scripts or executables invoked externally;
- workspace entry points Knip has not discovered;
- plugins or configuration files loaded by convention;
- paths that should be represented by Knip `entry`, `project`, workspace, ignore, or plugin configuration.

Prefer correcting or documenting Knip configuration rather than deleting intentional code.

## Classification rules

When deciding between labels:

1. Repository evidence overrides filename guesses.
2. Public API compatibility requires more caution than internal cleanup.
3. Known or plausible dynamic loading usually requires REVIEW unless configuration clearly explains the finding.
4. Side effects require REVIEW unless their runtime role can be ruled out.
5. Framework conventions often indicate CONFIGURATION or REVIEW rather than SAFE.
6. Passing tests supports a decision but does not prove absence of external consumers.
7. In monorepos, package ownership and cross-workspace consumers are part of the classification evidence.
8. If important evidence is missing, choose REVIEW rather than SAFE.

After selecting a risk label, use [confidence-evidence.md](confidence-evidence.md) to record the evidence and assign HIGH, MEDIUM, or LOW confidence in that classification.

## Suggested finding notes

For non-trivial findings, record the evidence briefly:

```text
Finding: src/legacy/parser.ts
Risk: SAFE
Confidence: HIGH
Evidence:
- no imports found
- not exported from package metadata
- not referenced by scripts or configuration
- package validation passes after removal
```

For uncertain findings:

```text
Finding: src/plugins/foo.ts
Risk: REVIEW
Confidence: MEDIUM
Evidence:
- Knip reports the file unused
- project contains runtime plugin discovery
- filesystem-based loading cannot be ruled out
Action: keep until runtime registration is confirmed
```
