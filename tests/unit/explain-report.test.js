import assert from "node:assert/strict";
import test from "node:test";

import { buildAnalysis, generateAnalysisMarkdown } from "../../src/explain/explain-report.js";

test("buildAnalysis creates a read-only explanation focused on inspection priorities", () => {
  const report = {
    projectName: "number-doc",
    generatedAt: "2026-07-25T16:16:17.134Z",
    score: 79,
    filesScanned: 196,
    findings: [
      finding("long_function", "high", "app/Services/Ged/Nodes/ContaPagarNodeHandler.php"),
      finding("duplicate_functions", "high", "app/Services/Ged/Nodes/ContaPagarNodeHandler.php"),
      finding("long_function", "high", "app/Services/Ged/Nodes/ContaReceberNodeHandler.php"),
      finding("large_file", "medium", "resources/views/livewire/ged/process-designer.blade.php")
    ]
  };
  const comparison = {
    score: { from: 75, to: 79, delta: 4 },
    findings: { from: 20, to: 4, delta: -16, new: 1, resolved: 17, unchanged: 3 }
  };

  const analysis = buildAnalysis(report, comparison);

  assert.equal(analysis.projectName, "number-doc");
  assert.equal(analysis.mode, "read-only");
  assert.equal(analysis.maturity.level, "intermediate");
  assert.equal(analysis.trend.scoreDelta, 4);
  assert.equal(analysis.priorities[0].file, "app/Services/Ged/Nodes/ContaPagarNodeHandler.php");
  assert.match(analysis.aiPrompt, /Do not edit code/);
});

test("generateAnalysisMarkdown explains without suggesting automatic code changes", () => {
  const markdown = generateAnalysisMarkdown(
    buildAnalysis({
      projectName: "demo",
      generatedAt: "2026-07-25T16:16:17.134Z",
      score: 100,
      filesScanned: 10,
      findings: []
    })
  );

  assert.match(markdown, /# Guardrails Analysis/);
  assert.match(markdown, /Read-only/);
  assert.match(markdown, /Radar/);
});

function finding(ruleId, severity, file) {
  return {
    id: `${ruleId}:${file}`,
    ruleId,
    severity,
    policy: "warn",
    status: "new",
    file,
    message: `${ruleId} in ${file}`
  };
}
