import { readFile } from "node:fs/promises";
import path from "node:path";

import { saveBaseline } from "../baseline/baseline-store.js";
import { compareReports, generateCompareText } from "../compare/compare-reports.js";
import { evaluateCi } from "../core/evaluate-ci.js";
import { scanDiff } from "../core/scan-diff.js";
import { scanProject } from "../core/scan-project.js";
import { buildAnalysis } from "../explain/explain-report.js";
import { writeAnalysis } from "../explain/write-analysis.js";
import {
  listHistoryVersions,
  loadComparisonReports,
  loadLatestReport
} from "../history/history-store.js";
import { assessMaturity, generateMaturityText } from "../maturity/assess-maturity.js";
import { writeReports } from "../report/write-report.js";

export const commandHandlers = {
  scan: runScan,
  diff: runDiff,
  ci: runCi,
  baseline: runBaseline,
  report: runReport,
  history: runHistory,
  compare: runCompare,
  maturity: runMaturity,
  explain: runExplain,
  watch: runWatch
};

async function runScan(projectPath, parsedArgs, io) {
  await scanAndPrint(projectPath, io, scanOptions(parsedArgs));
}

async function runDiff(projectPath, parsedArgs, io) {
  const result = await scanDiff(projectPath, scanOptions(parsedArgs));
  const reports = await writeReports(projectPath, result);
  printScanSummary(result, reports, io);
}

async function runCi(projectPath, parsedArgs, io) {
  const result = await scanProject(projectPath, scanOptions(parsedArgs));
  const reports = await writeReports(projectPath, result);
  const ci = evaluateCi(result);
  printScanSummary(result, reports, io);

  printMutationGate(ci.mutation, io);

  if (!ci.passed) {
    writeLine(io.stdout, `${ci.blockedFindings} blocked finding(s).`);
    io.exitCode = 1;
    return;
  }

  writeLine(io.stdout, "0 blocked finding(s).");
}

function printMutationGate(gate, io) {
  const label = gate.policy === "block" ? "Mutation gate FAILED" : "Mutation warning";
  const hasGateMessages = gate.violations.length + gate.notices.length > 0;

  if (hasGateMessages && gate.policy !== "block") {
    writeLine(io.stdout, "Mutation policy is warn: these do not fail ci.");
  }

  for (const violation of gate.violations) {
    writeLine(io.stdout, `${label}: ${violation}`);
  }

  for (const notice of gate.notices) {
    writeLine(io.stdout, `Mutation notice: ${notice}`);
  }
}

async function runBaseline(projectPath, parsedArgs, io) {
  const result = await scanProject(projectPath, { ...scanOptions(parsedArgs), useBaseline: false });
  const baseline = await saveBaseline(projectPath, result);
  writeLine(io.stdout, `Baseline saved with ${baseline.findings.length} finding(s).`);

  for (const warning of result.mutation?.warnings ?? []) {
    writeLine(io.stdout, `Mutation warning: ${warning} Baseline MSI may be outdated.`);
  }
}

async function runReport(projectPath, _parsedArgs, io) {
  const reportPath = path.join(projectPath, ".guardrails/report.md");
  const report = await readFile(reportPath, "utf8");
  writeLine(io.stdout, report.trimEnd());
}

async function runHistory(projectPath, _parsedArgs, io) {
  const versions = await listHistoryVersions(projectPath);
  printHistory(versions, io);
}

async function runCompare(projectPath, parsedArgs, io) {
  const reports = await loadComparisonReports(projectPath, {
    from: parsedArgs.from,
    to: parsedArgs.to
  });
  const comparison = compareReports(reports.previous, reports.current);
  writeLine(io.stdout, generateCompareText(comparison));
}

async function runMaturity(projectPath, _parsedArgs, io) {
  const latestReport = await loadLatestReport(projectPath);
  writeLine(io.stdout, generateMaturityText(assessMaturity(latestReport)).trimEnd());
}

async function runExplain(projectPath, _parsedArgs, io) {
  const latestReport = await loadLatestReport(projectPath);
  const comparison = await loadOptionalComparison(projectPath);
  const analysis = buildAnalysis(latestReport, comparison);
  const reports = await writeAnalysis(projectPath, analysis);

  writeLine(io.stdout, `Analysis report: ${reports.markdownPath}`);
  writeLine(io.stdout, `Analysis JSON: ${reports.jsonPath}`);
}

async function runWatch(projectPath, parsedArgs, io) {
  const interval = parsedArgs.interval;

  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error("--interval must be a positive number of milliseconds.");
  }

  writeLine(io.stdout, `Watching ${projectPath}. Interval: ${interval}ms.`);

  const run = async () => {
    await scanAndPrint(projectPath, io, scanOptions(parsedArgs));
  };

  await run();
  setInterval(run, interval);
}

async function loadOptionalComparison(projectPath) {
  try {
    const reports = await loadComparisonReports(projectPath);
    return compareReports(reports.previous, reports.current);
  } catch {
    return null;
  }
}

function scanOptions(parsedArgs) {
  return { summaryDate: parsedArgs.summaryDate ?? undefined };
}

async function scanAndPrint(projectPath, io, options = {}) {
  const result = await scanProject(projectPath, options);
  const reports = await writeReports(projectPath, result);
  printScanSummary(result, reports, io);
}

function printScanSummary(result, reports, io) {
  writeLine(
    io.stdout,
    `Scanned ${result.filesScanned} file(s). Score ${result.score}/100. Findings ${result.findings.length}.`
  );
  writeLine(io.stdout, `Markdown report: ${reports.markdownPath}`);
  writeLine(io.stdout, `JSON report: ${reports.jsonPath}`);
  writeLine(io.stdout, `History version: ${reports.historyId}`);
}

function printHistory(versions, io) {
  if (versions.length === 0) {
    writeLine(io.stdout, "No scan history found.");
    return;
  }

  for (const version of versions) {
    writeLine(
      io.stdout,
      `${version.id} ${version.projectName} score=${version.score}/100 findings=${version.findings} files=${version.filesScanned}`
    );
  }
}

function writeLine(stream, line) {
  stream.write(`${line}\n`);
}
