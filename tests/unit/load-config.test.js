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

async function configFrom(yaml) {
  const projectPath = path.join(tmpdir(), `guardrails-config-inline-${Date.now()}-${Math.random()}`);
  await mkdir(projectPath, { recursive: true });
  await writeFile(path.join(projectPath, ".guardrails.yml"), yaml);
  return loadConfig(projectPath);
}

test("loadConfig accepts inline lists", async () => {
  const config = await configFrom(
    [
      "scan:",
      '  include: [src/**/*.js, "app/{a,b}/*.php", \'x, y.js\']',
      "  exclude: []",
      "architecture:",
      "  layers: [domain, ui]  # comment",
      ""
    ].join("\n")
  );

  assert.deepEqual(config.scan.include, ["src/**/*.js", "app/{a,b}/*.php", "x, y.js"]);
  assert.deepEqual(config.architecture.layers, ["domain", "ui"]);
});

// Inline list behavior. Valid input gives a clear array; malformed input throws
// and never degrades to the literal string "[a, b]".
const inline = (list) => configFrom(`scan:\n  include: ${list}\n`).then((c) => c.scan.include);

test("inline lists: accepted forms", async () => {
  assert.deepEqual(await inline('["a,b", c]'), ["a,b", "c"]);
  assert.deepEqual(await inline("['a', \"b\"]"), ["a", "b"]);
  assert.deepEqual(await inline("[  a  ,   b  ]"), ["a", "b"]);
  assert.deepEqual(await inline("[a, b,]"), ["a", "b"]);
  assert.deepEqual(await inline("[]"), []);
  assert.deepEqual(await inline("[ ]"), []);
  assert.deepEqual(await inline('["app/{a,b}/*.php"]'), ["app/{a,b}/*.php"]);
  assert.deepEqual(await inline("[app/{a,b}/*.php, c]"), ["app/{a,b}/*.php", "c"]);
});

test("inline lists: malformed forms are rejected with a clear message", async () => {
  await assert.rejects(inline("[a, b"), /missing closing "\]"/);
  await assert.rejects(inline('["a, b]'), /unterminated quote/);
  await assert.rejects(inline("[a, , b]"), /empty item/);
  await assert.rejects(inline("[,]"), /empty item/);
  await assert.rejects(inline("[[a], b]"), /nested lists/);
  await assert.rejects(inline("[a]b]"), /nested lists|missing closing/);
});
