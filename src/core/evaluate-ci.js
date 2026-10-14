import { evaluateMutationGate } from "../mutation/evaluate-mutation-gate.js";

export function evaluateCi(scanResult) {
  const blockedFindings = scanResult.findings.filter(
    (finding) => finding.policy === "block" && finding.status !== "baseline"
  ).length;
  const mutation = evaluateMutationGate(scanResult.mutation, scanResult.config ?? {});
  const mutationBlocked = mutation.policy === "block" ? mutation.violations.length : 0;

  return {
    passed: blockedFindings + mutationBlocked === 0,
    blockedFindings,
    mutation
  };
}
