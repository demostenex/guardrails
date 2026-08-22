import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/run-cli.js";

test("CLI explain writes read-only analysis markdown and JSON from latest report", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-explain-cli-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: explain-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      "rules:",
      "  max_function_lines: 3",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/a.js"),
    [
      "export function tooLong() {",
      "  const a = 1;",
      "  const b = 2;",
      "  return a + b;",
      "}",
      ""
    ].join("\n")
  );

  await runCli(["scan", "--path", projectPath], testIo());
  const output = [];
  const exitCode = await runCli(["explain", "--path", projectPath], testIo(output));

  assert.equal(exitCode, 0, output.join(""));
  assert.equal(existsSync(path.join(projectPath, ".guardrails/analysis.md")), true);
  assert.equal(existsSync(path.join(projectPath, ".guardrails/analysis.json")), true);
  assert.match(readFileSync(path.join(projectPath, ".guardrails/analysis.md"), "utf8"), /Read-only/);
  assert.match(output.join(""), /Analysis report:/);
});

function testIo(output = []) {
  return {
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => output.push(value) },
    exitCode: 0
  };
}
