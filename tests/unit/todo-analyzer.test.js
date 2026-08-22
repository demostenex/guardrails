import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCodeHealth } from "../../src/analyzers/code-health-analyzer.js";
import { parseFile } from "../../src/parser/generic-parser.js";

test("analyzeCodeHealth reports TODO only when it appears in comments", () => {
  const parsed = parseFile({
    path: "src/example.js",
    content: [
      "const pattern = /TODO|FIXME|HACK/;",
      "const fixture = '// TODO inside a string fixture';",
      "// TODO: real work item",
      "export function ok() {",
      "  return pattern.test(fixture);",
      "}",
      ""
    ].join("\n"),
    lines: [
      "const pattern = /TODO|FIXME|HACK/;",
      "const fixture = '// TODO inside a string fixture';",
      "// TODO: real work item",
      "export function ok() {",
      "  return pattern.test(fixture);",
      "}",
      ""
    ]
  });

  const findings = analyzeCodeHealth([parsed], {
    rules: {
      max_file_lines: 200,
      max_function_lines: 80
    },
    policies: {
      todo_comment: "warn"
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "todo_comment");
  assert.equal(findings[0].line, 3);
});
