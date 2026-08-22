import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { listHistoryVersions } from "../../src/history/history-store.js";
import { writeReports } from "../../src/report/write-report.js";

test("writeReports stores latest files and immutable history versions", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-history-${randomUUID()}`);
  const result = scanResult("2026-07-25T16:03:13.942Z", 79, [
    {
      id: "long_function::src/a.js::too long",
      ruleId: "long_function",
      severity: "high",
      policy: "warn",
      status: "new",
      file: "src/a.js",
      message: "too long"
    }
  ]);

  const reports = await writeReports(projectPath, result);
  const versions = await listHistoryVersions(projectPath);
  const latest = JSON.parse(
    await readFile(path.join(projectPath, ".guardrails/latest.json"), "utf8")
  );
  const summary = JSON.parse(
    await readFile(path.join(projectPath, ".guardrails/history", versions[0].id, "summary.json"), "utf8")
  );

  assert.equal(reports.markdownPath.endsWith(".guardrails/report.md"), true);
  assert.equal(reports.jsonPath.endsWith(".guardrails/report.json"), true);
  assert.equal(reports.historyId, "2026-07-25T16-03-13-942Z");
  assert.equal(versions.length, 1);
  assert.equal(versions[0].score, 79);
  assert.equal(latest.historyId, "2026-07-25T16-03-13-942Z");
  assert.equal(summary.findings, 1);
  assert.deepEqual(summary.byRule, { long_function: 1 });
});

function scanResult(generatedAt, score, findings) {
  return {
    projectName: "demo",
    generatedAt,
    filesScanned: 10,
    score,
    findings
  };
}
