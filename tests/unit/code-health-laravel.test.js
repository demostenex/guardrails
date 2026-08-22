import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCodeHealth } from "../../src/analyzers/code-health-analyzer.js";
import { parseFile } from "../../src/parser/generic-parser.js";

const config = {
  rules: {
    max_file_lines: 500,
    max_function_lines: 20
  },
  policies: {
    long_function: "warn",
    large_file: "warn"
  }
};

test("analyzeCodeHealth ignores published Spatie permission migration size", () => {
  const parsed = parseFile(
    phpFile(
      "database/migrations/2026_07_17_235125_create_permission_tables.php",
      [
        "use Illuminate\\Database\\Migrations\\Migration;",
        "use Illuminate\\Support\\Facades\\Schema;",
        "",
        "return new class extends Migration",
        "{",
        "  public function up(): void",
        "  {",
        "    $teams = config('permission.teams');",
        "    $tableNames = config('permission.table_names');",
        "    Schema::create($tableNames['model_has_permissions'], function ($table) {",
        ...Array.from({ length: 35 }, (_, index) => `      $table->string('field_${index}');`),
        "    });",
        "  }",
        "};"
      ].join("\n")
    )
  );

  assert.deepEqual(analyzeCodeHealth([parsed], config), []);
});

test("analyzeCodeHealth still reports long custom migrations", () => {
  const parsed = parseFile(
    phpFile(
      "database/migrations/2026_07_17_235125_create_orders_table.php",
      [
        "return new class extends Migration",
        "{",
        "  public function up(): void",
        "  {",
        "    Schema::create('orders', function ($table) {",
        ...Array.from({ length: 35 }, (_, index) => `      $table->string('field_${index}');`),
        "    });",
        "  }",
        "};"
      ].join("\n")
    )
  );

  const findings = analyzeCodeHealth([parsed], config);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "long_function");
});

function phpFile(filePath, body) {
  const content = `<?php\n${body}\n`;

  return {
    path: filePath,
    content,
    lines: content.split(/\r?\n/)
  };
}
