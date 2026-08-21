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
});

test('verifies a fully accounted ledger', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) {
    finding.classification = finding.issue === 'unlisted' ? 'REVIEW' : 'SAFE';
    finding.execution = 'NOT_APPLICABLE';
  }

  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.rawFindings, 5);
  assert.equal(summary.unclassifiedInScope, 0);
  assert.equal(summary.classification.SAFE, 4);
  assert.equal(summary.classification.REVIEW, 1);
});

test('allows out-of-scope findings to remain unclassified', () => {
  const ledger = buildLedgerFromText(report);
  ledger.findings[0].scope = 'OUT_OF_SCOPE';
  for (const finding of ledger.findings.slice(1)) {
    finding.classification = 'SAFE';
  }

  const summary = verifyLedgerAgainstText(ledger, report);
  assert.equal(summary.scope.outOfScope, 1);
  assert.equal(summary.unclassifiedInScope, 0);
});

test('fails when an in-scope finding remains unclassified', () => {
  const ledger = buildLedgerFromText(report);
  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /final verification requires 0/,
  );
});

test('fails when a finding is removed from the ledger', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) finding.classification = 'SAFE';
  ledger.findings.pop();

  assert.throws(
    () => verifyLedgerAgainstText(ledger, report),
    /expected 5/,
  );
});

test('fails when the raw Knip report changes', () => {
  const ledger = buildLedgerFromText(report);
  for (const finding of ledger.findings) finding.classification = 'SAFE';
  const changed = JSON.stringify({ issues: [] });

  assert.throws(
    () => verifyLedgerAgainstText(ledger, changed),
    /source fingerprint/,
  );
});
