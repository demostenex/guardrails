import { generateCompareText } from "../compare/compare-reports.js";
import { assessMaturity } from "../maturity/assess-maturity.js";

export function buildAnalysis(report, comparison = null) {
  const maturity = assessMaturity(report);
  const priorities = buildPriorities(report);
  const trend = buildTrend(comparison);

  return {
    projectName: report.projectName,
    generatedAt: new Date().toISOString(),
    sourceReportGeneratedAt: report.generatedAt,
    mode: "read-only",
    purpose: "Radar for deciding what to inspect. It must not modify application code.",
    maturity,
    trend,
    priorities,
    aiPrompt: buildAiPrompt(report, maturity, trend, priorities)
  };
}

export function generateAnalysisMarkdown(analysis) {
  const lines = [
    "# Guardrails Analysis",
    "",
    `Project: ${analysis.projectName}`,
    `Generated at: ${analysis.generatedAt}`,
    `Source report: ${analysis.sourceReportGeneratedAt}`,
    "",
    "## Read-only Contract",
    "",
    "Radar only: this analysis points out where to inspect. It does not propose automatic code changes and does not modify application code.",
    "",
    "## Maturity",
    "",
    `Level: ${analysis.maturity.label}`,
    `Score: ${analysis.maturity.score}/100`,
    `Findings: ${analysis.maturity.findings}`,
    `High/Critical findings: ${analysis.maturity.highFindings}`,
    ""
  ];

  lines.push("## Trend", "", formatTrend(analysis.trend), "", "## Inspection Priorities", "");

  if (analysis.priorities.length === 0) {
    lines.push("No findings to inspect.", "");
  }

  for (const priority of analysis.priorities) {
    lines.push(`- ${priority.file}`);
    lines.push(`  - Findings: ${priority.findings}`);
    lines.push(`  - Dominant rules: ${priority.rules.join(", ")}`);
    lines.push(`  - Why inspect: ${priority.reason}`);
    lines.push("");
  }

  lines.push(
    "## AI-Ready Prompt",
    "",
    "The prompt below is safe to send to an external analysis model. It asks for interpretation only.",
    "",
    "```text",
    analysis.aiPrompt,
    "```",
    ""
  );

  return lines.join("\n");
}

function buildPriorities(report) {
  const fileMap = new Map();

  for (const finding of report.findings) {
    const files = finding.file ? [finding.file] : finding.files ?? ["project"];

    for (const file of files) {
      const item = fileMap.get(file) ?? {
        file,
        findings: 0,
        highFindings: 0,
        rules: new Map()
      };

      item.findings += 1;
      item.highFindings += finding.severity === "critical" || finding.severity === "high" ? 1 : 0;
      item.rules.set(finding.ruleId, (item.rules.get(finding.ruleId) ?? 0) + 1);
      fileMap.set(file, item);
    }
  }

  return [...fileMap.values()]
    .sort((left, right) => {
      const highDelta = right.highFindings - left.highFindings;
      return highDelta !== 0 ? highDelta : right.findings - left.findings;
    })
    .slice(0, 10)
    .map((item) => ({
      file: item.file,
      findings: item.findings,
      highFindings: item.highFindings,
      rules: [...item.rules.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([ruleId]) => ruleId),
      reason: explainPriority(item)
    }));
}

function explainPriority(item) {
  const rules = [...item.rules.keys()];

  if (rules.includes("duplicate_functions") && rules.includes("long_function")) {
    return "combines duplication and long logic, which usually means business behavior deserves inspection before new work lands here.";
  }

  if (rules.includes("large_service")) {
    return "service has enough responsibility to become an ownership and regression hotspot.";
  }

  if (rules.includes("large_file")) {
    return "file size makes review and AI-assisted edits harder to keep scoped.";
  }

  if (rules.includes("todo_comment")) {
    return "tracked uncertainty exists in code and should be resolved or converted into explicit work.";
  }

  return "concentrates guardrail findings and should be inspected before nearby changes grow.";
}

function buildTrend(comparison) {
  if (!comparison) {
    return {
      available: false,
      summary: "No previous history version available for comparison."
    };
  }

  return {
    available: true,
    scoreDelta: comparison.score.delta,
    findingsDelta: comparison.findings.delta,
    newFindings: comparison.findings.new,
    resolvedFindings: comparison.findings.resolved,
    unchangedFindings: comparison.findings.unchanged,
    summary: hasFullComparisonMetadata(comparison)
      ? generateCompareText(comparison)
      : summarizeComparison(comparison)
  };
}

function hasFullComparisonMetadata(comparison) {
  return comparison.from?.generatedAt && comparison.to?.generatedAt && comparison.projectName;
}

function summarizeComparison(comparison) {
  return [
    `Score: ${comparison.score.from} -> ${comparison.score.to} (${formatDelta(comparison.score.delta)})`,
    `Findings: ${comparison.findings.from} -> ${comparison.findings.to} (${formatDelta(comparison.findings.delta)})`,
    `New findings: ${comparison.findings.new}`,
    `Resolved findings: ${comparison.findings.resolved}`,
    `Unchanged findings: ${comparison.findings.unchanged}`
  ].join("\n");
}

function formatTrend(trend) {
  if (!trend.available) {
    return trend.summary;
  }

  return [
    `Score delta: ${formatDelta(trend.scoreDelta)}`,
    `Findings delta: ${formatDelta(trend.findingsDelta)}`,
    `New findings: ${trend.newFindings}`,
    `Resolved findings: ${trend.resolvedFindings}`,
    `Unchanged findings: ${trend.unchangedFindings}`
  ].join("\n");
}

function buildAiPrompt(report, maturity, trend, priorities) {
  return [
    "You are analyzing a guardrails report for code health.",
    "Do not edit code. Do not produce patches. Do not propose automatic fixes.",
    "Only explain what humans should inspect, why it matters, and what questions they should ask before changing code.",
    "",
    `Project: ${report.projectName}`,
    `Score: ${report.score}/100`,
    `Files scanned: ${report.filesScanned}`,
    `Findings: ${report.findings.length}`,
    `Maturity: ${maturity.label}`,
    `Trend: ${trend.summary}`,
    "",
    "Top inspection priorities:",
    ...priorities.slice(0, 8).map((priority) =>
      `- ${priority.file}: ${priority.findings} finding(s), rules=${priority.rules.join(", ")}`
    )
  ].join("\n");
}

function formatDelta(value) {
  return value > 0 ? `+${value}` : String(value);
}
