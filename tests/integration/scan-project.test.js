import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanProject } from "../../src/core/scan-project.js";

async function createProject() {
  const projectPath = path.join(tmpdir(), `guardrails-scan-${Date.now()}`);
  await mkdir(path.join(projectPath, "src/domain"), { recursive: true });
  await mkdir(path.join(projectPath, "src/ui"), { recursive: true });
  await mkdir(path.join(projectPath, "src/services"), { recursive: true });
  await mkdir(path.join(projectPath, "src/lib"), { recursive: true });

  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: scan-demo",
      "scan:",
      "  include:",
      "    - src/**/*.js",
      "rules:",
      "  max_file_lines: 8",
      "  max_function_lines: 4",
      "  max_service_methods: 2",
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
    "export function renderButton() { return '<button />'; }\n"
  );

  await writeFile(
    path.join(projectPath, "src/domain/order.js"),
    [
      "import { renderButton } from '../ui/button.js';",
      "export function orderLabel(order) {",
      "  return renderButton() + order.id;",
      "}",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(projectPath, "src/services/UserService.js"),
    [
      "export class UserService {",
      "  create() { return true; }",
      "  update() { return true; }",
      "  remove() { return true; }",
      "}",
      ""
    ].join("\n")
  );

  const duplicateBody = [
    "export function calculateTotal(items) {",
    "  let total = 0;",
    "  for (const item of items) {",
    "    total += item.price * item.quantity;",
    "  }",
    "  return total;",
    "}",
    ""
  ].join("\n");

  await writeFile(path.join(projectPath, "src/lib/billing.js"), duplicateBody);
  await writeFile(
    path.join(projectPath, "src/lib/orders.js"),
    duplicateBody.replace("calculateTotal", "getOrderTotal")
  );

  await writeFile(
    path.join(projectPath, "src/lib/messy.js"),
    [
      "// TODO: replace generated draft",
      "export function generatedDraft(value) {",
      "  const normalized = String(value).trim();",
      "  const upper = normalized.toUpperCase();",
      "  const tagged = `[draft] ${upper}`;",
      "  return tagged;",
      "}",
      "export const marker = true;",
      ""
    ].join("\n")
  );

  return projectPath;
}

test("scanProject reports MVP guardrail findings", async () => {
  const projectPath = await createProject();

  const result = await scanProject(projectPath);
  const ruleIds = result.findings.map((finding) => finding.ruleId);

  assert.equal(result.projectName, "scan-demo");
  assert.equal(result.score < 100, true);
  assert.equal(ruleIds.includes("architecture_violation"), true);
  assert.equal(ruleIds.includes("large_service"), true);
  assert.equal(ruleIds.includes("duplicate_functions"), true);
  assert.equal(ruleIds.includes("todo_comment"), true);
  assert.equal(ruleIds.includes("long_function"), true);
  assert.equal(ruleIds.includes("large_file"), true);

  const architectureFinding = result.findings.find(
    (finding) => finding.ruleId === "architecture_violation"
  );
  assert.equal(architectureFinding.policy, "block");
  assert.equal(architectureFinding.file, "src/domain/order.js");
});
