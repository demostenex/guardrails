import { fingerprintFinding } from "./fingerprint.js";

export function createFinding(config, finding) {
  const policy = config.policies?.[finding.ruleId] ?? "warn";
  const normalized = {
    policy,
    status: "new",
    ...finding
  };

  return {
    id: fingerprintFinding(normalized),
    ...normalized
  };
}
