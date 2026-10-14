import assert from "node:assert/strict";
import { mkdir, utimes, writeFile, copyFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { compareReports, generateCompareText } from "../../src/compare/compare-reports.js";
import { evaluateMutationGate } from "../../src/mutation/evaluate-mutation-gate.js";
import { readMutationSummary } from "../../src/mutation/read-mutation-summary.js";

const FIXTURE = path.resolve("tests/fixtures/mutation/infection-summary.json");

async function project(summary = FIXTURE) {
  const dir = path.join(tmpdir(), `guardrails-mutation-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  if (summary) {
    await copyFile(summary, path.join(dir, "summary.json"));
  }
  return dir;
}

const config = (mutation = {}) => ({ mutation: { summary: "summary.json", ...mutation } });

test("reader parses an Infection summary", async () => {
  const mutation = await readMutationSummary(await project(), config({ scope_note: "Billing" }));

  assert.equal(mutation.status, "ok");
  assert.equal(mutation.msi, 65.46);
  assert.equal(mutation.mutantsTotal, 304);
  assert.equal(mutation.killed, 199);
  assert.equal(mutation.survivors, 105);
  assert.equal(mutation.scopeNote, "Billing");
});

test("reader reports missing, disabled and invalid files without throwing", async () => {
  const empty = await project(null);
  assert.equal((await readMutationSummary(empty, config())).status, "missing");
  assert.equal((await readMutationSummary(empty, { mutation: {} })).status, "disabled");

  await writeFile(path.join(empty, "summary.json"), JSON.stringify({ foo: 1 }));
  const invalid = await readMutationSummary(empty, config());
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.error, /stats/);
});

test("reader warns about stale summaries", async () => {
  const dir = await project();
  const old = new Date(Date.now() - 100 * 3600 * 1000);
  await utimes(path.join(dir, "summary.json"), old, old);

  const mutation = await readMutationSummary(dir, config({ max_age_hours: 24 }));

  assert.equal(mutation.stale, true);
  assert.match(mutation.warnings[0], /stale/);
});

const current = (msi, scopeNote = "A") => ({
  status: "ok",
  msi,
  scopeNote,
  baseline: { msi: 65, scopeNote: "A" }
});

test("gate fails when MSI drops more than max_drop and passes within tolerance", () => {
  const cfg = { policies: { mutation_score_drop: "block" }, mutation: { max_drop: 2 } };

  assert.equal(evaluateMutationGate(current(62.9), cfg).violations.length, 1);
  assert.equal(evaluateMutationGate(current(63), cfg).violations.length, 0);
  assert.equal(evaluateMutationGate(current(64), cfg).violations.length, 0);
});

test("gate enforces min_msi", () => {
  const cfg = { policies: { mutation_score_drop: "block" }, mutation: { min_msi: 70 } };
  assert.equal(evaluateMutationGate(current(65), cfg).violations.length, 1);
});

test("gate treats different scopes as a violation requiring a new baseline", () => {
  const cfg = { policies: { mutation_score_drop: "block" }, mutation: { max_drop: 2 } };
  const gate = evaluateMutationGate(current(10, "B"), cfg);

  assert.match(gate.violations[0], /Different mutation scopes.*again/);
});

test("gate fails when configured but the summary is missing, stays silent otherwise", () => {
  const cfg = { policies: { mutation_score_drop: "block" }, mutation: { max_drop: 2 } };

  assert.match(evaluateMutationGate({ status: "missing", summaryPath: "s.json" }, cfg).violations[0], /not found/);
  assert.deepEqual(evaluateMutationGate({ status: "missing" }, { mutation: {} }).violations, []);
});

test("stale summary is a notice, or a violation with fail_on_stale", () => {
  const stale = { ...current(65), stale: true, warnings: ["old"] };

  assert.deepEqual(evaluateMutationGate(stale, { mutation: {} }).notices, ["old"]);
  assert.deepEqual(evaluateMutationGate(stale, { mutation: { fail_on_stale: true } }).violations, ["old"]);
});

test("gate flags unreadable summaries", () => {
  const cfg = { policies: { mutation_score_drop: "block" }, mutation: { max_drop: 2 } };


  assert.equal(evaluateMutationGate({ status: "invalid", error: "x" }, cfg).violations.length, 1);
});

test("compare shows MSI and survivor deltas", () => {
  const report = (msi, survivors) => ({
    findings: [],
    score: 100,
    mutation: { status: "ok", msi, survivors, scopeNote: "A" }
  });
  const text = generateCompareText(compareReports(report(65, 100), report(70, 80)));

  assert.match(text, /MSI: 65% -> 70% \(\+5\)/);
  assert.match(text, /Survivors: 100 -> 80 \(-20\)/);
});
