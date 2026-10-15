import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/run-cli.js";

test("guardrails exposes short help", async () => {
  const output = [];
  const exitCode = await runCli(["--help"], testIo(output));

  assert.equal(exitCode, 0, output.join(""));
  assert.match(output.join(""), /Usage:/);
  assert.match(output.join(""), /guardrails help details/);
  assert.match(output.join(""), /scan/);
  assert.match(output.join(""), /explain/);
});

test("guardrails exposes a detailed manual", async () => {
  const output = [];
  const exitCode = await runCli(["help", "details"], testIo(output));

  assert.equal(exitCode, 0, output.join(""));
  assert.match(output.join(""), /NAME/);
  assert.match(output.join(""), /SYNOPSIS/);
  assert.match(output.join(""), /EXIT STATUS/);
  assert.match(output.join(""), /guardrails explain --path/);
});

test("guardrails scan command writes markdown and JSON reports", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-cli-scan-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: cli-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/draft.js"),
    [
      "// TODO: generated draft",
      "export function draft() {",
      "  return true;",
      "}",
      ""
    ].join("\n")
  );

  const output = [];
  const exitCode = await runCli(["scan", "--path", projectPath], {
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => output.push(value) },
    exitCode: 0
  });

  assert.equal(exitCode, 0, output.join(""));
  assert.equal(existsSync(path.join(projectPath, ".guardrails/report.md")), true);
  assert.equal(existsSync(path.join(projectPath, ".guardrails/report.json")), true);
  assert.match(
    readFileSync(path.join(projectPath, ".guardrails/report.md"), "utf8"),
    /todo_comment/
  );
});

test("guardrails ci command fails on block policy findings", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-cli-ci-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src/domain"), { recursive: true });
  await mkdir(path.join(projectPath, "src/ui"), { recursive: true });
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: cli-ci-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      "policies:",
      "  architecture_violation: block",
      "architecture:",
      "  forbidden_imports:",
      "    - from: domain",
      "      to: ui",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(projectPath, "src/ui/button.js"),
    "export function button() { return true; }\n"
  );
  await writeFile(
    path.join(projectPath, "src/domain/order.js"),
    [
      "import { button } from '../ui/button.js';",
      "export function order() {",
      "  return button();",
      "}",
      ""
    ].join("\n")
  );

  const output = [];
  const exitCode = await runCli(["ci", "--path", projectPath], {
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => output.push(value) },
    exitCode: 0
  });

  assert.equal(exitCode, 1);
  assert.match(output.join(""), /blocked finding/);
});

function testIo(output = []) {
  return {
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => output.push(value) },
    exitCode: 0
  };
}

test("guardrails prints its version", async () => {
  const output = [];
  const exitCode = await runCli(["--version"], testIo(output));
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));

  assert.equal(exitCode, 0);
  assert.equal(output.join("").trim(), `guardrails ${version}`);
});

test("--summary-date overrides the mtime for one run and rejects bad values", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-cli-date-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await writeFile(path.join(projectPath, "src/a.js"), "export const a = 1;\n");
  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    "scan:\n  include:\n    - src/**/*.js\nmutation:\n  summary: summary.json\n  max_age_hours: 24\n"
  );
  await writeFile(
    path.join(projectPath, "summary.json"),
    JSON.stringify({ stats: { totalMutantsCount: 10, msi: 80 } })
  );
  const old = new Date(Date.now() - 100 * 3600 * 1000).toISOString();

  const fresh = [];
  await runCli(["ci", "--path", projectPath], testIo(fresh));
  assert.doesNotMatch(fresh.join(""), /stale/);

  const stale = [];
  assert.equal(await runCli(["ci", "--path", projectPath, "--summary-date", old], testIo(stale)), 0);
  assert.match(stale.join(""), /Mutation notice: Mutation summary is 100h old/);

  const bad = [];
  assert.equal(await runCli(["ci", "--path", projectPath, "--summary-date", "nope"], testIo(bad)), 0);
  assert.match(bad.join(""), /Invalid mutation\.generated_at|generated_at/);

  const missing = [];
  assert.equal(await runCli(["ci", "--summary-date"], testIo(missing)), 1);
  assert.match(missing.join(""), /requires an ISO date/);
});
