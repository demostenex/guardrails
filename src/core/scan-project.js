import { analyzeProject } from "../analyzers/index.js";
import { loadBaseline, markBaselineFindings } from "../baseline/baseline-store.js";
import { loadConfig } from "../config/load-config.js";
import { parseFile } from "../parser/generic-parser.js";
import { scanFiles } from "../scanner/file-scanner.js";
import { scoreProject } from "../scoring/score-project.js";

export async function scanProject(projectPath = process.cwd(), options = {}) {
  const config = await loadConfig(projectPath);
  const files = await scanFiles(projectPath, config, {
    onlyFiles: options.onlyFiles
  });
  const parsedFiles = files.map(parseFile);
  let findings = analyzeProject(parsedFiles, config, {
    changedFiles: options.changedFiles
  });

  if (options.useBaseline !== false) {
    const baseline = await loadBaseline(projectPath);
    findings = markBaselineFindings(findings, baseline);
  }

  findings = sortFindings(findings);

  return {
    projectName: config.project.name,
    generatedAt: new Date().toISOString(),
    filesScanned: files.length,
    score: scoreProject(findings, { filesScanned: files.length }),
    findings,
    config
  };
}

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

function sortFindings(findings) {
  return [...findings].sort((left, right) => {
    const severity =
      (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);

    if (severity !== 0) {
      return severity;
    }

    return (left.file ?? left.files?.[0] ?? "").localeCompare(
      right.file ?? right.files?.[0] ?? ""
    );
  });
}
