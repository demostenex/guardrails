import { fingerprintFinding } from "../findings/fingerprint.js";

export function compareReports(previous, current) {
  const previousById = mapFindingsById(previous.findings);
  const currentById = mapFindingsById(current.findings);
  const newFindings = current.findings.filter(
    (finding) => !previousById.has(findingId(finding))
  );
  const resolvedFindings = previous.findings.filter(
    (finding) => !currentById.has(findingId(finding))
  );
  const unchangedFindings = current.findings.filter((finding) =>
    previousById.has(findingId(finding))
  );

  return {
    projectName: current.projectName,
    from: {
      historyId: previous.historyId,
      generatedAt: previous.generatedAt
    },
    to: {
      historyId: current.historyId,
      generatedAt: current.generatedAt
    },
    score: {
      from: previous.score,
      to: current.score,
      delta: current.score - previous.score
    },
    findings: {
      from: previous.findings.length,
      to: current.findings.length,
      delta: current.findings.length - previous.findings.length,
      new: newFindings.length,
      resolved: resolvedFindings.length,
      unchanged: unchangedFindings.length
    },
    byRule: compareCounts(countByRule(previous.findings), countByRule(current.findings)),
    newFindings,
    resolvedFindings,
    unchangedFindings
  };
}

export function generateCompareText(comparison) {
  return [
    `Compare: ${comparison.projectName}`,
    `From: ${comparison.from.generatedAt}`,
    `To: ${comparison.to.generatedAt}`,
    `Score: ${comparison.score.from} -> ${comparison.score.to} (${formatDelta(comparison.score.delta)})`,
    `Findings: ${comparison.findings.from} -> ${comparison.findings.to} (${formatDelta(comparison.findings.delta)})`,
    `New findings: ${comparison.findings.new}`,
    `Resolved findings: ${comparison.findings.resolved}`,
    `Unchanged findings: ${comparison.findings.unchanged}`
  ].join("\n");
}

function mapFindingsById(findings) {
  return new Map(findings.map((finding) => [findingId(finding), finding]));
}

function findingId(finding) {
  return finding.id ?? fingerprintFinding(finding);
}

function countByRule(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.ruleId] = (counts[finding.ruleId] ?? 0) + 1;
    return counts;
  }, {});
}

function compareCounts(previous, current) {
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort();

  return keys.map((ruleId) => ({
    ruleId,
    from: previous[ruleId] ?? 0,
    to: current[ruleId] ?? 0,
    delta: (current[ruleId] ?? 0) - (previous[ruleId] ?? 0)
  }));
}

function formatDelta(value) {
  return value > 0 ? `+${value}` : String(value);
}
