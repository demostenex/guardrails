import assert from "node:assert/strict";
import test from "node:test";

import { scoreProject } from "../../src/scoring/score-project.js";

test("scoreProject returns 100 when there are no findings", () => {
  assert.equal(scoreProject([], { filesScanned: 50 }), 100);
});

test("scoreProject uses finding density so moderate debt in a larger project does not saturate to zero", () => {
  const findings = [
    ...Array.from({ length: 13 }, () => ({ severity: "high" })),
    ...Array.from({ length: 4 }, () => ({ severity: "medium" }))
  ];

  const score = scoreProject(findings, { filesScanned: 196 });

  assert.equal(score > 70, true);
  assert.equal(score < 100, true);
});

test("scoreProject heavily penalizes dense high-severity debt", () => {
  const findings = [
    ...Array.from({ length: 435 }, () => ({ severity: "high" })),
    ...Array.from({ length: 184 }, () => ({ severity: "medium" }))
  ];

  const score = scoreProject(findings, { filesScanned: 1515 });

  assert.equal(score < 10, true);
});
