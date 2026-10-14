import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/run-cli.js";

const FIXTURE = path.resolve("tests/fixtures/mutation/infection-summary.json");

async function setup(extraConfig = []) {
  const dir = path.join(tmpdir(), `guardrails-mutation-cli-${randomUUID()}`);
  await mkdir(path.join(dir, "src"), { recursive: true });
  await writeFile(path.join(dir, "src/a.js"), "export const a = 1;\n");
  await copyFile(FIXTURE, path.join(dir, "summary.json"));
  await writeFile(
    path.join(dir, ".guardrails.yml"),
    ["scan:", "  include:", "    - src/**/*.js", "mutation:", "  summary: summary.json",
      "  scope_note: Billing", ...extraConfig, ""].join("\n")
  );
  return dir;
}

async function cli(...args) {
  let out = "";
  const io = { stdout: { write: (c) => (out += c) }, stderr: { write: (c) => (out += c) }, exitCode: 0 };
  const code = await runCli(args, io);
  return { code, out };
}

async function setMsi(dir, msi) {
  const json = JSON.parse(await readFile(FIXTURE, "utf8"));
  json.stats.msi = msi;
  await writeFile(path.join(dir, "summary.json"), JSON.stringify(json));
}

test("scan writes the Mutação section and mutation.json", async () => {
  const dir = await setup();
  const { code } = await cli("scan", "--path", dir);
  const report = await readFile(path.join(dir, ".guardrails/report.md"), "utf8");
  const latest = JSON.parse(await readFile(path.join(dir, ".guardrails/latest.json"), "utf8"));
  const mutation = JSON.parse(
    await readFile(path.join(dir, ".guardrails/history", latest.historyId, "mutation.json"), "utf8")
  );

  assert.equal(code, 0);
  assert.match(report, /## Mutação/);
  assert.match(report, /Recorte: Billing/);
  assert.match(report, /MSI: 65.46%/);
  assert.equal(mutation.historyId, latest.historyId);
  assert.equal(mutation.mutantsTotal, 304);
});

test("scan without a summary file does not fail", async () => {
  const dir = await setup();
  await writeFile(path.join(dir, "summary.json"), "{}");
  await cli("scan", "--path", dir);
  await (await import("node:fs/promises")).rm(path.join(dir, "summary.json"));
  const { code } = await cli("scan", "--path", dir);
  const report = await readFile(path.join(dir, ".guardrails/report.md"), "utf8");

  assert.equal(code, 0);
  assert.match(report, /Sem dados de mutação/);
});

test("ci blocks an MSI drop beyond max_drop and passes within tolerance", async () => {
  const dir = await setup(["  max_drop: 2", "policies:", "  mutation_score_drop: block"]);
  await setMsi(dir, 65);
  await cli("baseline", "--path", dir);

  await setMsi(dir, 64);
  assert.equal((await cli("ci", "--path", dir)).code, 0);

  await setMsi(dir, 62);
  const failing = await cli("ci", "--path", dir);
  assert.equal(failing.code, 1);
  assert.match(failing.out, /MSI dropped 3 points/);
});

test("compare and maturity report mutation", async () => {
  const dir = await setup();
  await cli("scan", "--path", dir);
  await setMsi(dir, 70);
  await cli("scan", "--path", dir);

  assert.match((await cli("compare", "--path", dir)).out, /MSI: 65.46% -> 70% \(\+4.54\)/);
  assert.match((await cli("maturity", "--path", dir)).out, /Mutation: MSI 70%/);
});

test("ci with block fails when the gate is configured but the summary is missing", async () => {
  const dir = await setup(["  max_drop: 2", "policies:", "  mutation_score_drop: block"]);
  await (await import("node:fs/promises")).rm(path.join(dir, "summary.json"));
  const result = await cli("ci", "--path", dir);

  assert.equal(result.code, 1);
  assert.match(result.out, /summary file not found/);
});
