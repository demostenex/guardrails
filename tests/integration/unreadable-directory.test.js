import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanProject } from "../../src/core/scan-project.js";

test("scanProject skips unreadable directories instead of failing", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-unreadable-${randomUUID()}`);
  const unreadablePath = path.join(projectPath, "docker/pgdata");

  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await mkdir(unreadablePath, { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: unreadable-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/index.js"),
    [
      "export function ok() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );
  await chmod(unreadablePath, 0);

  try {
    const result = await scanProject(projectPath);

    assert.equal(result.projectName, "unreadable-demo");
    assert.equal(result.filesScanned, 1);
  } finally {
    await chmod(unreadablePath, 0o700);
  }
});
