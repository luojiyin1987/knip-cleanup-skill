# Knip configuration modeling

Use this reference when repository evidence shows that code is intentional but Knip does not represent the real execution or project relationship correctly.

## Principle

> Model repository reality before suppressing output.

The Skill should not duplicate Knip's configuration manual. When exact option semantics matter, inspect current Knip documentation and the repository's existing configuration.

## Start from repository evidence

Establish the real behavior first, for example through:

- package metadata or scripts;
- repository search;
- CI/workflow commands;
- Docker/deployment/task configuration;
- runtime/plugin registration;
- workspace boundaries;
- other repository-controlled invocation paths.

If the candidate's participation is still uncertain, keep it `REVIEW` rather than using configuration to hide the uncertainty.

## Choose the smallest model correction

Common directions are:

```text
real executable/tooling root missing
→ entry

wrong analyzed source boundary
→ project

supported framework/tool relationship missing
→ plugin/workspace configuration

justified reporting exception
→ narrow issue-specific ignore
```

Use broad suppression only after a more accurate model has been ruled out.

`ignoreFiles` or dependency-specific ignores do not create a missing source reachability edge. Do not use them as substitutes for understanding why a real entry path is absent.

Before overriding `entry`, `project`, or workspace/plugin configuration, inspect what the repository and current Knip defaults already provide. A manual override can change more of the analysis graph than the one false positive being investigated.

## External invocation example

If a repository workflow executes a script directly and Knip still reports it as unused:

```text
workflow/task runner
→ directly executed script
→ imports helper/type modules
```

First confirm the command and whether Knip should already discover it. If the real root is genuinely missing from Knip's graph, model the root; imported helpers should normally become reachable through the resulting graph rather than each being ignored separately.

Do not encode GitHub Actions, Deno, Docker, or another ecosystem as permanent special-case rules when repository search and current Knip behavior can answer the question.

## Validate configuration as an experiment

When the task authorizes configuration changes:

1. make the narrowest correction;
2. rerun Knip;
3. confirm the target false positive or false-positive chain disappears for the expected reason;
4. confirm related source remains analyzed;
5. check that unrelated useful findings did not disappear unexpectedly.

A lower finding count alone is not proof that the configuration is correct.

In analysis-only mode, recommend the configuration direction but do not apply it.
