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
    mutation: compareMutation(previous.mutation, current.mutation),
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
    `Unchanged findings: ${comparison.findings.unchanged}`,
    ...mutationCompareLines(comparison.mutation)
  ].join("\n");
}

function compareMutation(previous, current) {
  if (previous?.status !== "ok" || current?.status !== "ok") {
    return null;
  }

  return {
    msi: { from: previous.msi, to: current.msi, delta: round(current.msi - previous.msi) },
    survivors: {
      from: previous.survivors,
      to: current.survivors,
      delta: current.survivors - previous.survivors
    },
    scopeChanged: (previous.scopeNote ?? "") !== (current.scopeNote ?? ""),
    scopes: { from: previous.scopeNote ?? "", to: current.scopeNote ?? "" }
  };
}

function mutationCompareLines(mutation) {
  if (!mutation) {
    return [];
  }

  const lines = [
    `MSI: ${mutation.msi.from}% -> ${mutation.msi.to}% (${formatDelta(mutation.msi.delta)})`,
    `Survivors: ${mutation.survivors.from} -> ${mutation.survivors.to} (${formatDelta(mutation.survivors.delta)})`
  ];

  if (mutation.scopeChanged) {
    lines.push(
      `Mutation scope changed ("${mutation.scopes.from}" -> "${mutation.scopes.to}"): MSI values are not directly comparable.`
    );
  }

  return lines;
}

function round(value) {
  return Math.round(value * 100) / 100;
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
