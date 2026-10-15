import { analyzeProject } from "../analyzers/index.js";
import { loadBaseline, markBaselineFindings } from "../baseline/baseline-store.js";
import { loadConfig } from "../config/load-config.js";
import { readMutationSummary } from "../mutation/read-mutation-summary.js";
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

  const mutation = await readMutationSummary(projectPath, withSummaryDate(config, options.summaryDate));

  if (options.useBaseline !== false) {
    const baseline = await loadBaseline(projectPath);
    findings = markBaselineFindings(findings, baseline);

    if (baseline.mutation) {
      mutation.baseline = baseline.mutation;
    }
  }

  findings = sortFindings(findings);

  return {
    projectName: config.project.name,
    generatedAt: new Date().toISOString(),
    filesScanned: files.length,
    score: scoreProject(findings, { filesScanned: files.length }),
    findings,
    mutation,
    config
  };
}

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

// A per-run date wins over mutation.generated_at, which wins over the file mtime.
function withSummaryDate(config, summaryDate) {
  if (!summaryDate) {
    return config;
  }

  return { ...config, mutation: { ...config.mutation, generated_at: summaryDate } };
}

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
