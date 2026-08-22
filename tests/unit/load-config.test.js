import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../../src/config/load-config.js";

test("loadConfig reads .guardrails.yml and merges defaults", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-config-${Date.now()}`);
  await mkdir(projectPath, { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: demo",
      "  language: javascript",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      "rules:",
      "  max_file_lines: 10",
      "  max_function_lines: 4",
      "policies:",
      "  architecture_violation: block",
      "architecture:",
      "  layers:",
      "    - domain",
      "    - ui",
      "  forbidden_imports:",
      "    - from: domain",
      "      to: ui",
      ""
    ].join("\n")
  );

  const config = await loadConfig(projectPath);

  assert.equal(config.project.name, "demo");
  assert.equal(config.project.language, "javascript");
  assert.deepEqual(config.scan.include, ["src/**/*.js"]);
  assert.equal(config.scan.exclude.includes("node_modules/**"), true);
  assert.equal(config.rules.max_file_lines, 10);
  assert.equal(config.rules.max_function_lines, 4);
  assert.equal(config.policies.architecture_violation, "block");
  assert.deepEqual(config.architecture.forbidden_imports, [
    { from: "domain", to: "ui" }
  ]);
});
