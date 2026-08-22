import assert from "node:assert/strict";
import test from "node:test";

import { generateMarkdownReport } from "../../src/report/markdown-report.js";

test("generateMarkdownReport creates an actionable report grouped by severity", () => {
  const report = generateMarkdownReport({
    projectName: "demo",
    score: 72,
    generatedAt: "2026-07-25T10:00:00.000Z",
    findings: [
      {
        ruleId: "architecture_violation",
        severity: "critical",
        policy: "block",
        file: "src/domain/order.js",
        message: "domain imports ui",
        recommendation: "Move UI dependency out of domain."
      },
      {
        ruleId: "todo_comment",
        severity: "medium",
        policy: "warn",
        file: "src/lib/messy.js",
        line: 1,
        message: "TODO comment found",
        recommendation: "Resolve or document the TODO."
      }
    ]
  });

  assert.match(report, /# Guardrails Report/);
  assert.match(report, /Project: demo/);
  assert.match(report, /Score geral: 72\/100/);
  assert.match(report, /## Crítico/);
  assert.match(report, /architecture_violation/);
  assert.match(report, /## Médio/);
  assert.match(report, /src\/lib\/messy\.js:1/);
});
