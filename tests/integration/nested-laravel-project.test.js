import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanProject } from "../../src/core/scan-project.js";

test("scanProject scans Laravel apps nested one or more directories below the repository root", async () => {
  const projectPath = path.join(tmpdir(), `guardrails-nested-laravel-${randomUUID()}`);
  await mkdir(path.join(projectPath, "faturamento/app/Services"), { recursive: true });
  await writeFile(
    path.join(projectPath, "faturamento/app/Services/InvoiceService.php"),
    [
      "<?php",
      "class InvoiceService",
      "{",
      "  public function issue()",
      "  {",
      "    return true;",
      "  }",
      "}",
      ""
    ].join("\n")
  );

  const result = await scanProject(projectPath);

  assert.equal(result.filesScanned, 1);
  assert.equal(result.projectName.startsWith("guardrails-nested-laravel-"), true);
});
