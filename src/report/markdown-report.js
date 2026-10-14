import { mutationMarkdownLines } from "../mutation/format-mutation.js";

const SEVERITY_LABELS = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo"
};

const SEVERITIES = ["critical", "high", "medium", "low"];

export function generateMarkdownReport(result) {
  const lines = [
    "# Guardrails Report",
    "",
    `Project: ${result.projectName}`,
    `Generated at: ${result.generatedAt}`,
    `Score geral: ${result.score}/100`,
    "",
    `Findings: ${result.findings.length}`,
    ""
  ];

  for (const severity of SEVERITIES) {
    const findings = result.findings.filter((finding) => finding.severity === severity);

    if (findings.length === 0) {
      continue;
    }

    lines.push(`## ${SEVERITY_LABELS[severity]}`, "");

    for (const finding of findings) {
      lines.push(`- ${formatLocation(finding)}`);
      lines.push(`  - Regra: ${finding.ruleId}`);
      lines.push(`  - Política: ${finding.policy}`);
      lines.push(`  - Status: ${finding.status ?? "new"}`);
      lines.push(`  - Problema: ${finding.message}`);

      if (finding.recommendation) {
        lines.push(`  - Ação sugerida: ${finding.recommendation}`);
      }

      lines.push("");
    }
  }

  if (result.findings.length === 0) {
    lines.push("Nenhum problema encontrado.", "");
  }

  lines.push(...mutationMarkdownLines(result.mutation));

  return `${lines.join("\n").trimEnd()}\n`;
}

function formatLocation(finding) {
  if (finding.file) {
    return finding.line ? `${finding.file}:${finding.line}` : finding.file;
  }

  return finding.files?.join(", ") ?? "project";
}
