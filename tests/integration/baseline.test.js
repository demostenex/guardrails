import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { saveBaseline } from "../../src/baseline/baseline-store.js";
import { scanProject } from "../../src/core/scan-project.js";

test("baseline marks existing findings as baseline instead of new", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-baseline-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: baseline-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/draft.js"),
    [
      "// TODO: legacy problem before guardrails adoption",
      "export function draft() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );

  const firstScan = await scanProject(projectPath, { useBaseline: false });
  await saveBaseline(projectPath, firstScan);
  const secondScan = await scanProject(projectPath);

  assert.equal(secondScan.findings.length, 1);
  assert.equal(secondScan.findings[0].ruleId, "todo_comment");
  assert.equal(secondScan.findings[0].status, "baseline");
});
