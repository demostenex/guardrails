import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCi } from "../../src/core/evaluate-ci.js";

test("evaluateCi fails when a finding has block policy", () => {
  const result = evaluateCi({
    findings: [
      {
        ruleId: "architecture_violation",
        policy: "block",
        severity: "critical"
      },
      {
        ruleId: "todo_comment",
        policy: "warn",
        severity: "medium"
      }
    ]
  });

  assert.equal(result.passed, false);
  assert.equal(result.blockedFindings, 1);
});

test("evaluateCi passes when findings are warnings only", () => {
  const result = evaluateCi({
    findings: [
      {
        ruleId: "todo_comment",
        policy: "warn",
        severity: "medium"
      }
    ]
  });

  assert.equal(result.passed, true);
  assert.equal(result.blockedFindings, 0);
});
