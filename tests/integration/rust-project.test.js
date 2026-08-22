import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanProject } from "../../src/core/scan-project.js";

async function createRustProject() {
  const projectPath = path.join(tmpdir(), `guardrails-rust-${randomUUID()}`);
  await mkdir(path.join(projectPath, "src/domain"), { recursive: true });
  await mkdir(path.join(projectPath, "src/ui"), { recursive: true });
  await mkdir(path.join(projectPath, "src/services"), { recursive: true });
  await mkdir(path.join(projectPath, "src/lib"), { recursive: true });
  await mkdir(path.join(projectPath, "target/debug"), { recursive: true });

  await writeFile(
    path.join(projectPath, ".guardrails.yml"),
    [
      "project:",
      "  name: rust-demo",
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
    path.join(projectPath, "src/ui/button.rs"),
    [
      "pub fn render_button() -> &'static str {",
      "    \"<button />\"",
      "}",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(projectPath, "src/domain/order.rs"),
    [
      "use crate::ui::button;",
      "",
      "pub fn order_label(id: &str) -> String {",
      '    format!("{}{}", button::render_button(), id)',
      "}",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(projectPath, "src/services/user_service.rs"),
    [
      "pub struct UserService;",
      "",
      "impl UserService {",
      "    pub fn create() -> bool { true }",
      "    pub fn update() -> bool { true }",
      "    pub fn remove() -> bool { true }",
      "}",
      ""
    ].join("\n")
  );

  const duplicateBody = [
    "pub fn calculate_total(items: &[i32]) -> i32 {",
    "    let mut total = 0;",
    "    for item in items {",
    "        total += *item * 2;",
    "    }",
    "    total",
    "}",
    ""
  ].join("\n");

  await writeFile(path.join(projectPath, "src/lib/billing.rs"), duplicateBody);
  await writeFile(
    path.join(projectPath, "src/lib/orders.rs"),
    duplicateBody.replace("calculate_total", "get_order_total")
  );

  await writeFile(
    path.join(projectPath, "src/lib/messy.rs"),
    [
      "// TODO: replace generated draft",
      "pub fn generated_draft(value: &str) -> String {",
      "    let normalized = value.trim();",
      "    let upper = normalized.to_uppercase();",
      "    let tagged = format!(\"[draft] {upper}\");",
      "    tagged",
      "}",
      "pub const MARKER: bool = true;",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(projectPath, "target/debug/generated.rs"),
    [
      "// TODO: generated output that must not be scanned",
      "pub fn generated() {",
      ...Array.from({ length: 40 }, (_, index) => `    let value_${index} = ${index};`),
      "}",
      ""
    ].join("\n")
  );

  return projectPath;
}

test("scanProject evaluates Rust crates and ignores Cargo target output", async () => {
  const projectPath = await createRustProject();
  const result = await scanProject(projectPath);
  const ruleIds = result.findings.map((finding) => finding.ruleId);

  assert.equal(result.projectName, "rust-demo");
  assert.equal(result.filesScanned, 6);
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
  assert.equal(architectureFinding.file, "src/domain/order.rs");

  assert.equal(
    result.findings.some((finding) => (finding.file ?? "").includes("target/")),
    false
  );
});
