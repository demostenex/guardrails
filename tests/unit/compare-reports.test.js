import assert from "node:assert/strict";
import test from "node:test";

import { compareReports } from "../../src/compare/compare-reports.js";

test("compareReports identifies new, resolved and unchanged findings", () => {
  const previous = scanResult("old", 80, [
    finding("A", "long_function", "src/a.js"),
    finding("B", "large_file", "src/b.js")
  ]);
  const current = scanResult("new", 75, [
    finding("B", "large_file", "src/b.js"),
    finding("C", "duplicate_functions", "src/c.js")
  ]);

  const comparison = compareReports(previous, current);

  assert.equal(comparison.score.from, 80);
  assert.equal(comparison.score.to, 75);
  assert.equal(comparison.score.delta, -5);
  assert.equal(comparison.findings.from, 2);
  assert.equal(comparison.findings.to, 2);
  assert.equal(comparison.findings.new, 1);
  assert.equal(comparison.findings.resolved, 1);
  assert.equal(comparison.findings.unchanged, 1);
  assert.deepEqual(comparison.newFindings.map((findingItem) => findingItem.id), ["C"]);
  assert.deepEqual(comparison.resolvedFindings.map((findingItem) => findingItem.id), ["A"]);
});

function scanResult(generatedAt, score, findings) {
  return {
    projectName: "demo",
    generatedAt,
    filesScanned: 5,
    score,
    findings
  };
}

function finding(id, ruleId, file) {
  return {
    id,
    ruleId,
    severity: "high",
    policy: "warn",
    status: "new",
    file,
    message: `${ruleId} in ${file}`
  };
}
