import { mutationMaturityLine } from "../mutation/format-mutation.js";

export function assessMaturity(result) {
  const level = maturityLevel(result.score);
  const dominantRules = topCounts(result.findings, (finding) => finding.ruleId).map(
    ([ruleId, findings]) => ({ ruleId, findings })
  );
  const hotspots = topCounts(result.findings, findingFile)
    .filter(([file]) => file !== "project")
    .map(([file, findings]) => ({ file, findings }));
  const highFindings = result.findings.filter(
    (finding) => finding.severity === "critical" || finding.severity === "high"
  ).length;

  return {
    projectName: result.projectName,
    score: result.score,
    filesScanned: result.filesScanned,
    findings: result.findings.length,
    highFindings,
    mutation: result.mutation ?? null,
    level: level.id,
    label: level.label,
    dominantRules,
    hotspots,
    summary: `${result.projectName}: maturidade ${level.label}, score ${result.score}/100, ${result.findings.length} achado(s) em ${result.filesScanned} arquivo(s).`
  };
}

export function generateMaturityText(maturity) {
  const lines = [
    `Maturity: ${maturity.label}`,
    `Project: ${maturity.projectName}`,
    `Score: ${maturity.score}/100`,
    `Files scanned: ${maturity.filesScanned}`,
    `Findings: ${maturity.findings}`,
    `High/Critical findings: ${maturity.highFindings}`,
    mutationMaturityLine(maturity.mutation),
    "",
    "Dominant rules:"
  ];

  for (const item of maturity.dominantRules.slice(0, 5)) {
    lines.push(`- ${item.ruleId}: ${item.findings}`);
  }

  lines.push("", "Hotspots:");

  for (const item of maturity.hotspots.slice(0, 8)) {
    lines.push(`- ${item.file}: ${item.findings}`);
  }

  lines.push("", "Use this as a radar for inspection, not as an automatic refactor plan.");

  return `${lines.join("\n")}\n`;
}

function maturityLevel(score) {
  if (score >= 90) {
    return { id: "high", label: "alta" };
  }

  if (score >= 75) {
    return { id: "intermediate", label: "controlado com pontos de atenção" };
  }

  if (score >= 50) {
    return { id: "attention", label: "atenção necessária" };
  }

  return { id: "low", label: "baixa" };
}

function topCounts(items, getKey) {
  const counts = {};

  for (const item of items) {
    const keys = [].concat(getKey(item)).filter(Boolean);

    for (const key of keys) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return Object.entries(counts).sort((left, right) => right[1] - left[1]);
}

function findingFile(finding) {
  return finding.file ?? finding.files ?? "project";
}
