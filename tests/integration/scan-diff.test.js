import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanDiff } from "../../src/core/scan-diff.js";

test("scanDiff scans only changed files and reports vibe change surface risk", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-diff-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src/lib"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: diff-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      "vibe:",
      "  max_files_changed_for_small_diff: 1",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/lib/changed.js"),
    [
      "// TODO: generated code needs review",
      "export function changed() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/lib/also-changed.js"),
    [
      "export function alsoChanged() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/lib/unchanged.js"),
    [
      "// TODO: should not be scanned in diff mode",
      "export function unchanged() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );

  const result = await scanDiff(projectPath, {
    changedFiles: ["src/lib/changed.js", "src/lib/also-changed.js"]
  });
  const todoFindings = result.findings.filter(
    (finding) => finding.ruleId === "todo_comment"
  );

  assert.equal(result.projectName, "diff-demo");
  assert.equal(result.filesScanned, 2);
  assert.equal(todoFindings.length, 1);
  assert.equal(todoFindings[0].file, "src/lib/changed.js");
  assert.equal(
    result.findings.some((finding) => finding.ruleId === "vibe_large_change_surface"),
    true
  );
});
