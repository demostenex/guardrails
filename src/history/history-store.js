import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateJsonReport } from "../report/json-report.js";
import { generateMarkdownReport } from "../report/markdown-report.js";

const HISTORY_DIRECTORY = ".guardrails/history";

export async function saveHistoryVersion(projectPath, result) {
  const historyId = makeHistoryId(result.generatedAt);
  const historyPath = path.join(projectPath, HISTORY_DIRECTORY, historyId);
  const versionedResult = {
    ...result,
    historyId
  };

  await mkdir(historyPath, { recursive: true });
  await Promise.all([
    writeFile(path.join(historyPath, "report.md"), generateMarkdownReport(versionedResult)),
    writeFile(path.join(historyPath, "report.json"), generateJsonReport(versionedResult)),
    writeFile(path.join(historyPath, "summary.json"), `${JSON.stringify(summarizeReport(versionedResult), null, 2)}\n`)
  ]);

  return {
    historyId,
    historyPath,
    result: versionedResult
  };
}

export async function writeLatest(projectPath, historyVersion) {
  const latestPath = path.join(projectPath, ".guardrails/latest.json");
  const latest = {
    historyId: historyVersion.historyId,
    historyPath: path.relative(path.join(projectPath, ".guardrails"), historyVersion.historyPath),
    generatedAt: historyVersion.result.generatedAt,
    projectName: historyVersion.result.projectName,
    score: historyVersion.result.score,
    filesScanned: historyVersion.result.filesScanned,
    findings: historyVersion.result.findings.length
  };

  await writeFile(latestPath, `${JSON.stringify(latest, null, 2)}\n`);
  return latest;
}

export async function listHistoryVersions(projectPath) {
  const historyRoot = path.join(projectPath, HISTORY_DIRECTORY);

  try {
    const entries = await readdir(historyRoot, { withFileTypes: true });
    const versions = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const summaryPath = path.join(historyRoot, entry.name, "summary.json");

          try {
            const summary = JSON.parse(await readFile(summaryPath, "utf8"));
            return {
              id: entry.name,
              ...summary
            };
          } catch {
            return null;
          }
        })
    );

    return versions
      .filter(Boolean)
      .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt));
  } catch {
    return [];
  }
}

export async function loadHistoryReport(projectPath, historyId) {
  const reportPath = path.join(projectPath, HISTORY_DIRECTORY, historyId, "report.json");
  return JSON.parse(await readFile(reportPath, "utf8"));
}

export async function loadLatestReport(projectPath) {
  const latest = JSON.parse(
    await readFile(path.join(projectPath, ".guardrails/latest.json"), "utf8")
  );

  return loadHistoryReport(projectPath, latest.historyId);
}

export async function loadComparisonReports(projectPath, options = {}) {
  const versions = await listHistoryVersions(projectPath);

  if (options.from || options.to) {
    const from = options.from ?? versions.at(-2)?.id;
    const to = options.to ?? versions.at(-1)?.id;

    return {
      previous: await loadHistoryReport(projectPath, from),
      current: await loadHistoryReport(projectPath, to)
    };
  }

  if (versions.length < 2) {
    throw new Error("At least two scan history versions are required for compare.");
  }

  return {
    previous: await loadHistoryReport(projectPath, versions.at(-2).id),
    current: await loadHistoryReport(projectPath, versions.at(-1).id)
  };
}

export function summarizeReport(result) {
  const byRule = countBy(result.findings, (finding) => finding.ruleId);
  const bySeverity = countBy(result.findings, (finding) => finding.severity);
  const byStatus = countBy(result.findings, (finding) => finding.status ?? "new");
  const topFiles = Object.entries(countFiles(result.findings))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([file, findings]) => ({ file, findings }));

  return {
    projectName: result.projectName,
    generatedAt: result.generatedAt,
    score: result.score,
    filesScanned: result.filesScanned,
    findings: result.findings.length,
    byRule,
    bySeverity,
    byStatus,
    topFiles
  };
}

export function makeHistoryId(generatedAt) {
  return generatedAt.replaceAll(":", "-").replaceAll(".", "-");
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function countFiles(findings) {
  const counts = {};

  for (const finding of findings) {
    const files = finding.file ? [finding.file] : finding.files ?? [];

    for (const file of files) {
      counts[file] = (counts[file] ?? 0) + 1;
    }
  }

  return counts;
}
