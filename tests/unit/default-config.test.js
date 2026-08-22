import assert from "node:assert/strict";
import test from "node:test";

import { defaultConfig } from "../../src/config/default-config.js";

test("defaultConfig includes common Laravel, frontend, and Rust source files", () => {
  assert.equal(defaultConfig.scan.include.includes("**/app/**/*.php"), true);
  assert.equal(defaultConfig.scan.include.includes("**/routes/**/*.php"), true);
  assert.equal(defaultConfig.scan.include.includes("**/resources/js/**/*.js"), true);
  assert.equal(defaultConfig.scan.include.includes("**/*.rs"), true);
  assert.equal(defaultConfig.scan.exclude.includes("vendor/**"), true);
  assert.equal(defaultConfig.scan.exclude.includes("target/**"), true);
  assert.equal(defaultConfig.rules.min_similar_body_tokens, 35);
  assert.equal(defaultConfig.rules.similar_function_threshold, 0.9);
  assert.equal(defaultConfig.policies.similar_functions, "warn");
  assert.equal(defaultConfig.frameworks.auto_detect, true);
  assert.deepEqual(defaultConfig.frameworks.enabled, []);
});
