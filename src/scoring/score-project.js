const PENALTY_BY_SEVERITY = {
  critical: 10,
  high: 4,
  medium: 2,
  low: 1
};

const DENSITY_MULTIPLIER = 70;

export function scoreProject(findings, options = {}) {
  if (findings.length === 0) {
    return 100;
  }

  const filesScanned = Math.max(1, options.filesScanned ?? findings.length);
  const weightedFindings = findings.reduce(
    (total, finding) => total + (PENALTY_BY_SEVERITY[finding.severity] ?? 0),
    0
  );
  const penalty = Math.round((weightedFindings / filesScanned) * DENSITY_MULTIPLIER);

  return Math.max(0, 100 - penalty);
}
