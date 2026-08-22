import assert from "node:assert/strict";
import test from "node:test";

import { assessMaturity } from "../../src/maturity/assess-maturity.js";

test("assessMaturity labels controlled projects and highlights dominant risks", () => {
  const maturity = assessMaturity({
    projectName: "number-doc",
    score: 79,
    filesScanned: 196,
    findings: [
      finding("long_function", "high", "app/Livewire/A.php"),
      finding("long_function", "high", "app/Livewire/B.php"),
      finding("large_file", "medium", "resources/views/a.blade.php")
    ]
  });

  assert.equal(maturity.level, "intermediate");
  assert.equal(maturity.label, "controlado com pontos de atenção");
  assert.equal(maturity.dominantRules[0].ruleId, "long_function");
  assert.equal(maturity.hotspots[0].file, "app/Livewire/A.php");
  assert.match(maturity.summary, /number-doc/);
});

test("assessMaturity labels very low score projects as low maturity", () => {
  const maturity = assessMaturity({
    projectName: "number",
    score: 3,
    filesScanned: 1515,
    findings: Array.from({ length: 20 }, (_, index) =>
      finding("long_function", "high", `app/File${index}.php`)
    )
  });

  assert.equal(maturity.level, "low");
  assert.match(maturity.summary, /baixa/);
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
