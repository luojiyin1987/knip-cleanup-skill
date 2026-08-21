import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLedgerFromText, verifyLedgerAgainstText } from './finding-ledger.mjs';

const report = JSON.stringify({
  issues: [
    {
      file: 'src/math.ts',
      files: [],
      exports: [{ name: 'factorial', line: 12, col: 14, pos: 256 }],
      types: [{ name: 'Radians', line: 20, col: 13, pos: 410 }],
      dependencies: [],
    },
    {
      file: 'package.json',
      files: [],
      exports: [],
      types: [],
      dependencies: [{ name: 'lodash' }],
      unlisted: [{ name: 'rimraf' }],
    },
    {
      file: 'src/legacy.ts',
      files: [{ name: 'src/legacy.ts' }],
      exports: [],
      types: [],
      dependencies: [],
    },
  ],
});

test('builds a deterministic ledger from Knip JSON', () => {
  const ledger = buildLedgerFromText(report);

  assert.equal(ledger.source.rawFindings, 5);
  assert.deepEqual(ledger.source.byIssue, {
    dependencies: 1,
    exports: 1,
    files: 1,
    types: 1,
    unlisted: 1,
  });
  assert.deepEqual(ledger.findings.map((finding) => finding.id), [
    'F0001',
    'F0002',
    'F0003',
    'F0004',
    'F0005',
  ]);
  assert.ok(ledger.findings.every((finding) => finding.classification === 'UNCLASSIFIED'));
  assert.ok(ledger.findings.every((finding) => finding.confidence === 'UNASSESSED'));
});

function completeFinding(finding, overrides = {}) {
  const actions = {
    dependencies: 'remove dependency',
    exports: 'delete unused declaration',
    files: 'delete unused file',
    types: 'delete unused declaration',
    unlisted: 'declare dependency',
  };
  Object.assign(finding, {
    classification: 'SAFE',
    confidence: 'HIGH',
    execution: 'ELIGIBLE',
    action: actions[finding.issue] ?? 'keep and review',
    ...overrides,
  });
}

test('verifies a fully accounted ledger', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) {
    completeFinding(finding);
  }
  const unlisted = ledger.findings.find((finding) => finding.issue === 'unlisted');
  completeFinding(unlisted, {
    classification: 'REVIEW',
    execution: 'BLOCKED',
    action: 'correct dependency declaration',
  });
  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.rawFindings, 5);
  assert.equal(summary.unclassifiedInScope, 0);
  assert.equal(summary.classification.SAFE, 4);
  assert.equal(summary.classification.REVIEW, 1);
});

test('allows out-of-scope findings to remain unclassified', () => {
  const ledger = buildLedgerFromText(report);
  Object.assign(ledger.findings[0], {
    scope: 'OUT_OF_SCOPE',
    execution: 'NOT_APPLICABLE',
  });
  for (const finding of ledger.findings.slice(1)) {
    completeFinding(finding);
  }

  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.scope.outOfScope, 1);
  assert.equal(summary.unclassifiedInScope, 0);
});

test('fails when an in-scope finding remains unclassified', () => {
  const ledger = buildLedgerFromText(report);
  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /in-scope finding is unclassified/,
  );
});

test('fails when a finding is removed from the ledger', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings.pop();

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /expected 5/,
  );
});

test('fails when the raw Knip report changes', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  const changed = JSON.stringify({ issues: [] });

  assert.throws(
    () => verifyLedgerAgainstText(ledger, changed),
    /source fingerprint/,
  );
});

test('fails when confidence remains unassessed', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].confidence = 'UNASSESSED';

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /unassessed confidence/,
  );
});

test('fails when execution remains undecided', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].execution = 'UNDECIDED';

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /undecided execution/,
  );
});

test('fails when a REVIEW finding is eligible', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].classification = 'REVIEW';

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /REVIEW findings cannot be eligible/,
  );
});

test('fails when a SAFE MEDIUM finding is eligible', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].confidence = 'MEDIUM';

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /only HIGH confidence findings can be eligible/,
  );
});

test('fails when an in-scope finding has no action', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].action = null;

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /must have an exact action/,
  );
});

test('fails when an out-of-scope finding is eligible', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].scope = 'OUT_OF_SCOPE';

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /out-of-scope findings must have no action/,
  );
});

test('fails when a CONFIGURATION finding has a deletion action', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  completeFinding(ledger.findings[0], {
    classification: 'CONFIGURATION',
    execution: 'BLOCKED',
    action: 'delete unused file',
  });

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /action delete unused file is incompatible with dependencies/,
  );
});

test('fails when an eligible finding has no executable action', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  ledger.findings[0].action = 'keep and review';

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /must have an executable action/,
  );
});

test('accepts a complete analysis-only decision', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) {
    completeFinding(finding, {
      execution: 'NOT_APPLICABLE',
      action: 'no action in analysis-only mode',
    });
  }

  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.execution.NOT_APPLICABLE, 5);
});

test('accepts an analysis-only CONFIGURATION finding', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) {
    completeFinding(finding, {
      execution: 'NOT_APPLICABLE',
      action: 'no action in analysis-only mode',
    });
  }
  ledger.findings[0].classification = 'CONFIGURATION';

  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.classification.CONFIGURATION, 1);
});

test('rejects actions that do not match the Knip issue type', () => {
  const incompatibleActions = {
    dependencies: 'delete unused file',
    exports: 'declare dependency',
    files: 'remove dependency',
    unlisted: 'remove export modifier',
  };

  for (const [issue, action] of Object.entries(incompatibleActions)) {
    const ledger = buildLedgerFromText(report);
    for (const finding of ledger.findings) completeFinding(finding);
    const finding = ledger.findings.find((candidate) => candidate.issue === issue);
    finding.action = action;

    assert.throws(
      () => verifyLedgerAgainstText(ledger, report),
      new RegExp(`action ${action} is incompatible with ${issue}`),
    );
  }
});

test('rejects an export action for an unresolved finding', () => {
  const unresolvedReport = JSON.stringify({
    issues: [{ file: 'src/index.ts', unresolved: [{ name: './missing.js' }] }],
  });
  const ledger = buildLedgerFromText(unresolvedReport);
  completeFinding(ledger.findings[0], { action: 'remove export modifier' });

  assert.throws(
    () => verifyLedgerAgainstText(ledger, unresolvedReport),
    /action remove export modifier is incompatible with unresolved/,
  );
});

test('accepts dependency and unresolved issue actions', () => {
  const extendedReport = JSON.stringify({
    issues: [{
      file: 'package.json',
      devDependencies: [{ name: 'vitest' }],
      unresolved: [{ name: './missing.js' }],
    }],
  });
  const ledger = buildLedgerFromText(extendedReport);
  for (const finding of ledger.findings) {
    completeFinding(finding, {
      action: finding.issue === 'devDependencies'
        ? 'remove dependency'
        : 'correct unresolved reference',
    });
  }

  const summary = verifyLedgerAgainstText(ledger, extendedReport);
  assert.equal(summary.execution.ELIGIBLE, 2);
});

test('restricts unknown issue types to review actions', () => {
  const unknownReport = JSON.stringify({
    issues: [{ file: 'src/index.ts', futureIssue: [{ name: 'candidate' }] }],
  });
  const ledger = buildLedgerFromText(unknownReport);
  completeFinding(ledger.findings[0], { action: 'delete unused declaration' });

  assert.throws(
    () => verifyLedgerAgainstText(ledger, unknownReport),
    /action delete unused declaration is incompatible with futureIssue/,
  );
});

test('accepts an eligible CONFIGURATION correction with high confidence', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  completeFinding(ledger.findings[0], {
    classification: 'CONFIGURATION',
    action: 'correct Knip model',
  });

  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.classification.CONFIGURATION, 1);
  assert.equal(summary.execution.ELIGIBLE, 5);
});

test('rejects an eligible CONFIGURATION correction without high confidence', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) completeFinding(finding);
  completeFinding(ledger.findings[0], {
    classification: 'CONFIGURATION',
    confidence: 'MEDIUM',
    action: 'correct Knip model',
  });

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /only HIGH confidence findings can be eligible/,
  );
});
