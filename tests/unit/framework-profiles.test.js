import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCodeHealth } from "../../src/analyzers/code-health-analyzer.js";
import { analyzeDuplicates } from "../../src/analyzers/duplicate-analyzer.js";
import { resolveFrameworkProfiles } from "../../src/frameworks/index.js";
import { parseFile } from "../../src/parser/generic-parser.js";

const baseConfig = {
  rules: {
    min_duplicate_body_chars: 40
  },
  policies: {
    duplicate_functions: "warn"
  }
};

test("resolveFrameworkProfiles auto-detects Laravel from project files", () => {
  const parsedFiles = [
    parseFile(phpFile("routes/web.php", "<?php\nRoute::get('/', fn () => view('welcome'));\n")),
    parseFile(phpFile("app/Models/User.php", "<?php\nclass User extends Model {}\n"))
  ];

  const profiles = resolveFrameworkProfiles(parsedFiles, {
    frameworks: {
      auto_detect: true,
      enabled: []
    }
  });

  assert.deepEqual(
    profiles.map((profile) => profile.id),
    ["laravel"]
  );
});

test("resolveFrameworkProfiles enables explicit profiles even without detected files", () => {
  const profiles = resolveFrameworkProfiles([], {
    frameworks: {
      auto_detect: false,
      enabled: ["laravel"]
    }
  });

  assert.deepEqual(
    profiles.map((profile) => profile.id),
    ["laravel"]
  );
});

test("Laravel duplicate suppressions are controlled by framework profiles", () => {
  const parsedFiles = [
    parseFile(
      phpFile(
        "database/migrations/2026_01_01_000001_add_status.php",
        [
          "<?php",
          "class AddStatus",
          "{",
          "  public function up()",
          "  {",
          "    Schema::table('items', fn ($table) => $table->string('status'));",
          "  }",
          "}"
        ].join("\n")
      )
    ),
    parseFile(
      phpFile(
        "database/migrations/2026_01_02_000001_add_type.php",
        [
          "<?php",
          "class AddType",
          "{",
          "  public function up()",
          "  {",
          "    Schema::table('items', fn ($table) => $table->string('status'));",
          "  }",
          "}"
        ].join("\n")
      )
    )
  ];

  assert.deepEqual(
    analyzeDuplicates(parsedFiles, {
      ...baseConfig,
      frameworks: {
        auto_detect: true,
        enabled: []
      }
    }),
    []
  );

  const findings = analyzeDuplicates(parsedFiles, {
    ...baseConfig,
    frameworks: {
      auto_detect: false,
      enabled: []
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "duplicate_functions");
});

test("Laravel code-health suppressions are controlled by framework profiles", () => {
  const parsedFiles = [
    parseFile(
      phpFile(
        "database/migrations/2026_07_17_235125_create_permission_tables.php",
        [
          "<?php",
          "return new class extends Migration",
          "{",
          "  public function up(): void",
          "  {",
          "    $tableNames = config('permission.table_names');",
          "    Schema::create($tableNames['model_has_permissions'], function ($table) {",
          ...Array.from({ length: 35 }, (_, index) => `      $table->string('field_${index}');`),
          "    });",
          "  }",
          "};"
        ].join("\n")
      )
    )
  ];
  const codeHealthConfig = {
    rules: {
      max_file_lines: 500,
      max_function_lines: 20
    },
    policies: {
      long_function: "warn",
      large_file: "warn"
    }
  };

  assert.deepEqual(
    analyzeCodeHealth(parsedFiles, {
      ...codeHealthConfig,
      frameworks: {
        auto_detect: true,
        enabled: []
      }
    }),
    []
  );

  const findings = analyzeCodeHealth(parsedFiles, {
    ...codeHealthConfig,
    frameworks: {
      auto_detect: false,
      enabled: []
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "long_function");
});

function phpFile(filePath, content) {
  return {
    path: filePath,
    content,
    lines: content.split(/\r?\n/)
  };
}
