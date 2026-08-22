import assert from "node:assert/strict";
import test from "node:test";

import { parseFile } from "../../src/parser/generic-parser.js";

test("parseFile recognizes PHP classes, methods, functions and use imports", () => {
  const lines = [
    "<?php",
    "",
    "namespace App\\Services;",
    "",
    "use App\\Models\\User;",
    "",
    "class UserService",
    "{",
    "    public function create(User $user): bool",
    "    {",
    "        return true;",
    "    }",
    "",
    "    protected static function normalize(string $name): string",
    "    {",
    "        return trim($name);",
    "    }",
    "}",
    "",
    "function helper_value(): string",
    "{",
    "    return 'ok';",
    "}",
    ""
  ];

  const parsed = parseFile({
    path: "app/Services/UserService.php",
    content: lines.join("\n"),
    lines
  });

  assert.equal(parsed.classes.length, 1);
  assert.equal(parsed.classes[0].name, "UserService");
  assert.deepEqual(
    parsed.classes[0].methods.map((method) => method.name),
    ["create", "normalize"]
  );
  assert.deepEqual(
    parsed.functions.map((fn) => fn.name),
    ["create", "normalize", "helper_value"]
  );
  assert.deepEqual(parsed.imports, [
    {
      specifier: "App\\Models\\User",
      resolvedPath: "app/Models/User",
      line: 5
    }
  ]);
});
