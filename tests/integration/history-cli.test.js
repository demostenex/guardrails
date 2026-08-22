import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/run-cli.js";

test("CLI exposes history, compare and maturity commands from saved scan versions", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-history-cli-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: cli-history-demo",
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
      "export function ok() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );
  await runCli(["scan", "--path", projectPath], testIo());

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

  const historyOutput = [];
  const compareOutput = [];
  const maturityOutput = [];

  assert.equal(await runCli(["history", "--path", projectPath], testIo(historyOutput)), 0);
  assert.equal(await runCli(["compare", "--path", projectPath], testIo(compareOutput)), 0);
  assert.equal(await runCli(["maturity", "--path", projectPath], testIo(maturityOutput)), 0);

  assert.match(historyOutput.join(""), /cli-history-demo/);
  assert.match(compareOutput.join(""), /New findings: 1/);
  assert.match(maturityOutput.join(""), /Maturity:/);
});

function testIo(output = []) {
  return {
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => output.push(value) },
    exitCode: 0
  };
}
