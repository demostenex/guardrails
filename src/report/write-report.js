import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { saveHistoryVersion, writeLatest } from "../history/history-store.js";
import { generateJsonReport } from "./json-report.js";
import { generateMarkdownReport } from "./markdown-report.js";

export async function writeReports(projectPath, result) {
  const reportDirectory = path.join(projectPath, ".guardrails");
  await mkdir(reportDirectory, { recursive: true });
  const history = await saveHistoryVersion(projectPath, result);
  const versionedResult = history.result;

  const markdownPath = path.join(reportDirectory, "report.md");
  const jsonPath = path.join(reportDirectory, "report.json");

  await Promise.all([
    writeFile(markdownPath, generateMarkdownReport(versionedResult)),
    writeFile(jsonPath, generateJsonReport(versionedResult)),
    writeLatest(projectPath, history)
  ]);

  return {
    markdownPath,
    jsonPath,
    historyId: history.historyId,
    historyPath: history.historyPath
  };
}
