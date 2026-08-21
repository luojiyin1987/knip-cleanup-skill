# Confidence and evidence

Use this reference when a Knip finding is not trivial enough to classify from one decisive fact.

## Keep three decisions separate

- **Risk**: `SAFE`, `REVIEW`, or `CONFIGURATION`.
- **Confidence**: `HIGH`, `MEDIUM`, or `LOW` confidence in that classification.
- **Execution eligibility**: whether the requested task may actually change the repository.

`HIGH` does not mean "safe to delete." `REVIEW / HIGH` and `CONFIGURATION / HIGH` are valid outcomes.

## Prefer concrete evidence over checklists

Use the smallest set of repository/CLI evidence that materially resolves the decision. Useful sources include:

- Knip's finding and issue type;
- repository search for imports, scripts, configuration references, runtime registrations, or external invocation paths;
- same-file consumers for export/type findings;
- package/public API metadata;
- package-manager dependency ownership or `why`/`explain` information;
- workspace consumers in a monorepo;
- Git evidence when attribution matters;
- existing validation results after an authorized change.

Do not add a framework-specific rule when repository evidence can answer the question directly.

## Record only material evidence

For a non-trivial finding, capture:

```text
Supporting evidence:
- ...

Counter-evidence:
- ...

Material unknowns:
- ...

Risk: SAFE | REVIEW | CONFIGURATION
Confidence: HIGH | MEDIUM | LOW
```

Omit empty categories when they add no value.

## Confidence direction

- **HIGH** — the decisive evidence is direct and relevant; no material unknown remains for the classification.
- **MEDIUM** — evidence leans clearly one way, but at least one material uncertainty remains.
- **LOW** — evidence is sparse, indirect, contradictory, or the relevant boundary has not been inspected.

A finding should not receive `SAFE / HIGH` merely because Knip reports it or because repository search found no obvious import. The proposed action boundary must also be understood.

For groups of findings, apply one classification only when the same decisive evidence genuinely covers every named member. Otherwise split exceptions and unknowns.

## Evidence is directional

Evidence can:

- **support** a classification;
- **contradict** it;
- remain **unknown**.

Do not manufacture numeric confidence scores. The goal is reviewable reasoning, not fake precision.

If new evidence appears during cleanup or validation, update the classification or confidence instead of defending the earlier decision.
