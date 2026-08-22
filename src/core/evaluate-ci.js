export function evaluateCi(scanResult) {
  const blockedFindings = scanResult.findings.filter(
    (finding) => finding.policy === "block" && finding.status !== "baseline"
  ).length;

  return {
    passed: blockedFindings === 0,
    blockedFindings
  };
}
