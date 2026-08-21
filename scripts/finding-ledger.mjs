#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const CLASSIFICATIONS = new Set(['UNCLASSIFIED', 'SAFE', 'REVIEW', 'CONFIGURATION']);
const CONFIDENCE_LEVELS = new Set(['UNASSESSED', 'HIGH', 'MEDIUM', 'LOW']);
const SCOPES = new Set(['IN_SCOPE', 'OUT_OF_SCOPE']);
const EXECUTION_STATES = new Set(['UNDECIDED', 'ELIGIBLE', 'BLOCKED', 'NOT_APPLICABLE']);
const ACTIONS = new Set([
  'remove dependency',
  'delete unused file',
  'remove export modifier',
  'delete unused declaration',
  'correct Knip model',
  'declare dependency',
  'correct dependency declaration',
  'correct unresolved reference',
  'keep and review',
  'no action in analysis-only mode',
]);

const METADATA_KEYS = new Set(['file', 'owners']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableIdentity({ issue, file, item }) {
  return JSON.stringify([
    issue,
    file,
    item.name ?? null,
    item.namespace ?? null,
    item.line ?? null,
    item.col ?? null,
    item.pos ?? null,
  ]);
}

function compareNullableNumber(a, b) {
  const left = a ?? Number.MAX_SAFE_INTEGER;
  const right = b ?? Number.MAX_SAFE_INTEGER;
  return left - right;
}

function compareStrings(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function sortFindings(a, b) {
  return (
    compareStrings(a.file, b.file) ||
    compareStrings(a.issue, b.issue) ||
    compareNullableNumber(a.line, b.line) ||
    compareNullableNumber(a.col, b.col) ||
    compareStrings(a.namespace, b.namespace) ||
    compareStrings(a.name, b.name) ||
    compareNullableNumber(a.pos, b.pos)
  );
}

function parseKnipReport(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid Knip JSON: ${error.message}`);
  }

  if (!report || !Array.isArray(report.issues)) {
    throw new Error('Knip JSON must contain a top-level issues array');
  }

  return report;
}

function flattenKnipReport(report) {
  const findings = [];

  for (const group of report.issues) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      throw new Error('Every Knip issues entry must be an object');
    }

    const file = group.file;
    if (typeof file !== 'string' || file.length === 0) {
      throw new Error('Every Knip issues entry must contain a non-empty file path');
    }

    for (const [issue, value] of Object.entries(group)) {
      if (METADATA_KEYS.has(issue)) continue;
      if (!Array.isArray(value)) continue;

      for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(`Issue ${issue} in ${file} contains a non-object item`);
        }

        const identity = stableIdentity({ issue, file, item });
        findings.push({
          issue,
          file,
          name: item.name ?? null,
          namespace: item.namespace ?? null,
          line: item.line ?? null,
          col: item.col ?? null,
          pos: item.pos ?? null,
          key: `sha256:${sha256(identity)}`,
        });
      }
    }
  }

  findings.sort(sortFindings);

  const occurrences = new Map();
  return findings.map((finding, index) => {
    const occurrence = (occurrences.get(finding.key) ?? 0) + 1;
    occurrences.set(finding.key, occurrence);
    return {
      id: `F${String(index + 1).padStart(4, '0')}`,
      ...finding,
      key: `${finding.key}:${occurrence}`,
    };
  });
}

function countByIssue(findings) {
  const counts = {};
  for (const finding of findings) {
    counts[finding.issue] = (counts[finding.issue] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function buildLedgerFromText(text) {
  const report = parseKnipReport(text);
  const findings = flattenKnipReport(report);

  return {
    schemaVersion: 2,
    source: {
      format: 'knip-json-reporter',
      sha256: sha256(text),
      rawFindings: findings.length,
      byIssue: countByIssue(findings),
    },
    findings: findings.map((finding) => ({
      ...finding,
      classification: 'UNCLASSIFIED',
      confidence: 'UNASSESSED',
      scope: 'IN_SCOPE',
      execution: 'UNDECIDED',
      action: null,
      unknowns: [],
      notes: null,
    })),
  };
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }
}

function validateFindingState(finding) {
  if (!CLASSIFICATIONS.has(finding.classification)) {
    throw new Error(`${finding.id}: invalid classification ${finding.classification}`);
  }
  if (!CONFIDENCE_LEVELS.has(finding.confidence)) {
    throw new Error(`${finding.id}: invalid confidence ${finding.confidence}`);
  }
  if (!SCOPES.has(finding.scope)) {
    throw new Error(`${finding.id}: invalid scope ${finding.scope}`);
  }
  if (!EXECUTION_STATES.has(finding.execution)) {
    throw new Error(`${finding.id}: invalid execution state ${finding.execution}`);
  }
  if (finding.action !== null && !ACTIONS.has(finding.action)) {
    throw new Error(`${finding.id}: invalid action ${finding.action}`);
  }
  assertStringArray(finding.unknowns ?? [], `${finding.id}.unknowns`);
}

function validateFinalFindingState(finding) {
  if (finding.scope === 'OUT_OF_SCOPE') {
    if (finding.execution !== 'NOT_APPLICABLE' || finding.action !== null) {
      throw new Error(`${finding.id}: out-of-scope findings must have no action`);
    }
    return;
  }

  if (finding.classification === 'UNCLASSIFIED') {
    throw new Error(`${finding.id}: in-scope finding is unclassified`);
  }
  if (finding.confidence === 'UNASSESSED') {
    throw new Error(`${finding.id}: in-scope finding has unassessed confidence`);
  }
  if (finding.execution === 'UNDECIDED') {
    throw new Error(`${finding.id}: in-scope finding has undecided execution`);
  }
  if (finding.action === null) {
    throw new Error(`${finding.id}: in-scope finding must have an exact action`);
  }
  if (
    finding.execution === 'ELIGIBLE' &&
    (finding.classification !== 'SAFE' || finding.confidence !== 'HIGH')
  ) {
    throw new Error(`${finding.id}: only SAFE / HIGH findings can be eligible`);
  }
  if (
    finding.execution === 'ELIGIBLE' &&
    ['keep and review', 'no action in analysis-only mode'].includes(finding.action)
  ) {
    throw new Error(`${finding.id}: eligible finding must have an executable action`);
  }
  if (
    finding.execution === 'NOT_APPLICABLE' &&
    finding.action !== 'no action in analysis-only mode'
  ) {
    throw new Error(`${finding.id}: in-scope NOT_APPLICABLE finding must use the analysis-only action`);
  }
  if (
    finding.action === 'no action in analysis-only mode' &&
    finding.execution !== 'NOT_APPLICABLE'
  ) {
    throw new Error(`${finding.id}: analysis-only action must be NOT_APPLICABLE`);
  }
  if (finding.classification === 'CONFIGURATION') {
    if (finding.execution === 'ELIGIBLE') {
      throw new Error(`${finding.id}: CONFIGURATION findings cannot be eligible for cleanup`);
    }
    if (
      ![
        'correct Knip model',
        'keep and review',
        'no action in analysis-only mode',
      ].includes(finding.action)
    ) {
      throw new Error(`${finding.id}: CONFIGURATION finding has an incompatible action`);
    }
  }
}

function verifyLedgerAgainstText(ledger, text) {
  if (!ledger || ledger.schemaVersion !== 2 || !Array.isArray(ledger.findings)) {
    throw new Error('Unsupported or invalid finding ledger');
  }

  const canonical = buildLedgerFromText(text);

  if (ledger.source?.sha256 !== canonical.source.sha256) {
    throw new Error('Ledger source fingerprint does not match the supplied Knip report');
  }

  if (ledger.source?.rawFindings !== canonical.source.rawFindings) {
    throw new Error('Ledger raw finding count does not match the supplied Knip report');
  }

  if (JSON.stringify(ledger.source?.byIssue) !== JSON.stringify(canonical.source.byIssue)) {
    throw new Error('Ledger per-issue counts do not match the supplied Knip report');
  }

  if (ledger.findings.length !== canonical.findings.length) {
    throw new Error(
      `Ledger contains ${ledger.findings.length} findings, expected ${canonical.findings.length}`,
    );
  }

  const ids = new Set();
  const keys = new Set();
  const canonicalByKey = new Map(canonical.findings.map((finding) => [finding.key, finding]));

  for (const finding of ledger.findings) {
    if (ids.has(finding.id)) throw new Error(`Duplicate ledger id: ${finding.id}`);
    if (keys.has(finding.key)) throw new Error(`Duplicate ledger key: ${finding.key}`);
    ids.add(finding.id);
    keys.add(finding.key);

    const expected = canonicalByKey.get(finding.key);
    if (!expected) {
      throw new Error(`${finding.id}: finding does not exist in the supplied Knip report`);
    }

    for (const field of ['id', 'issue', 'file', 'name', 'namespace', 'line', 'col', 'pos']) {
      if (finding[field] !== expected[field]) {
        throw new Error(`${finding.id}: ${field} does not match the supplied Knip report`);
      }
    }

    validateFindingState(finding);
    validateFinalFindingState(finding);
  }

  const missing = canonical.findings.filter((finding) => !keys.has(finding.key));
  if (missing.length > 0) {
    throw new Error(`Ledger is missing ${missing.length} finding(s)`);
  }

  const summary = summarizeLedger(ledger);
  if (summary.unclassifiedInScope !== 0) {
    throw new Error(
      `Ledger has ${summary.unclassifiedInScope} in-scope unclassified finding(s); final verification requires 0`,
    );
  }

  return summary;
}

function summarizeLedger(ledger) {
  const classification = { SAFE: 0, REVIEW: 0, CONFIGURATION: 0, UNCLASSIFIED: 0 };
  const confidence = { HIGH: 0, MEDIUM: 0, LOW: 0, UNASSESSED: 0 };
  const execution = { ELIGIBLE: 0, BLOCKED: 0, NOT_APPLICABLE: 0, UNDECIDED: 0 };
  let inScope = 0;
  let outOfScope = 0;
  let classifiedInScope = 0;
  let unclassifiedInScope = 0;

  for (const finding of ledger.findings) {
    classification[finding.classification] = (classification[finding.classification] ?? 0) + 1;
    confidence[finding.confidence] = (confidence[finding.confidence] ?? 0) + 1;
    execution[finding.execution] = (execution[finding.execution] ?? 0) + 1;

    if (finding.scope === 'OUT_OF_SCOPE') {
      outOfScope += 1;
    } else {
      inScope += 1;
      if (finding.classification === 'UNCLASSIFIED') {
        unclassifiedInScope += 1;
      } else {
        classifiedInScope += 1;
      }
    }
  }

  return {
    rawFindings: ledger.findings.length,
    byIssue: countByIssue(ledger.findings),
    scope: { inScope, outOfScope },
    classification,
    confidence,
    execution,
    reconciliation: {
      classifiedInScope,
      outOfScope,
      accountedFindings: classifiedInScope + outOfScope,
      unclassifiedInScope,
    },
    unclassifiedInScope,
  };
}

function formatSummary(summary) {
  const lines = [
    'Finding ledger verified.',
    `Raw findings: ${summary.rawFindings}`,
    'By issue:',
    ...Object.entries(summary.byIssue).map(([issue, count]) => `  ${issue}: ${count}`),
    'Classification:',
    `  SAFE: ${summary.classification.SAFE}`,
    `  REVIEW: ${summary.classification.REVIEW}`,
    `  CONFIGURATION: ${summary.classification.CONFIGURATION}`,
    `  UNCLASSIFIED: ${summary.classification.UNCLASSIFIED}`,
    'Confidence:',
    `  HIGH: ${summary.confidence.HIGH}`,
    `  MEDIUM: ${summary.confidence.MEDIUM}`,
    `  LOW: ${summary.confidence.LOW}`,
    `  UNASSESSED: ${summary.confidence.UNASSESSED}`,
    'Scope:',
    `  IN_SCOPE: ${summary.scope.inScope}`,
    `  OUT_OF_SCOPE: ${summary.scope.outOfScope}`,
    'Reconciliation:',
    `  ${summary.rawFindings} raw = ${summary.reconciliation.classifiedInScope} classified in scope + ${summary.reconciliation.outOfScope} out of scope + ${summary.reconciliation.unclassifiedInScope} unclassified in scope`,
    `  accounted: ${summary.reconciliation.accountedFindings}/${summary.rawFindings}`,
  ];
  return `${lines.join('\n')}\n`;
}

async function readUtf8(path) {
  return path === '-' ? new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  }) : readFile(path, 'utf8');
}

async function writeUtf8(path, content) {
  if (!path || path === '-') {
    process.stdout.write(content);
    return;
  }
  await writeFile(path, content, 'utf8');
}

function usage() {
  return `Usage:\n  node scripts/finding-ledger.mjs build <knip.json|-> [ledger.json|-]\n  node scripts/finding-ledger.mjs verify <knip.json> <ledger.json>\n`;
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;

  if (command === 'build') {
    const [knipPath, ledgerPath = '-'] = args;
    if (!knipPath) throw new Error(usage().trim());
    const text = await readUtf8(knipPath);
    const ledger = buildLedgerFromText(text);
    await writeUtf8(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    return;
  }

  if (command === 'verify') {
    const [knipPath, ledgerPath] = args;
    if (!knipPath || !ledgerPath) throw new Error(usage().trim());
    const [text, ledgerText] = await Promise.all([readUtf8(knipPath), readUtf8(ledgerPath)]);
    let ledger;
    try {
      ledger = JSON.parse(ledgerText);
    } catch (error) {
      throw new Error(`Invalid ledger JSON: ${error.message}`);
    }
    const summary = verifyLedgerAgainstText(ledger, text);
    process.stdout.write(formatSummary(summary));
    return;
  }

  throw new Error(usage().trim());
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`finding-ledger: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export {
  buildLedgerFromText,
  flattenKnipReport,
  formatSummary,
  parseKnipReport,
  summarizeLedger,
  verifyLedgerAgainstText,
};
