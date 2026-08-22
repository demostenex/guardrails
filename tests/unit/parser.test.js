import assert from "node:assert/strict";
import test from "node:test";

import { parseFile } from "../../src/parser/generic-parser.js";

test("parseFile does not count braces inside regex literals as function blocks", () => {
  const parsed = parseFile({
    path: "src/parser/example.js",
    content: [
      "export function parseLine(value) {",
      "  return /^\\s*(?:export\\s+)?function\\s+([A-Za-z_$][\\w$]*)\\s*\\([^)]*\\)\\s*\\{/.test(value);",
      "}",
      "",
      "export function next() {",
      "  return true;",
      "}",
      ""
    ].join("\n"),
    lines: [
      "export function parseLine(value) {",
      "  return /^\\s*(?:export\\s+)?function\\s+([A-Za-z_$][\\w$]*)\\s*\\([^)]*\\)\\s*\\{/.test(value);",
      "}",
      "",
      "export function next() {",
      "  return true;",
      "}",
      ""
    ]
  });

  assert.equal(parsed.functions.length, 2);
  assert.equal(parsed.functions[0].name, "parseLine");
  assert.equal(parsed.functions[0].lineCount, 3);
  assert.equal(parsed.functions[1].name, "next");
  assert.equal(parsed.functions[1].lineCount, 3);
});
