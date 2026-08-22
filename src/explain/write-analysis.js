import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateAnalysisMarkdown } from "./explain-report.js";

export async function writeAnalysis(projectPath, analysis) {
  const reportDirectory = path.join(projectPath, ".guardrails");
  await mkdir(reportDirectory, { recursive: true });

  const markdownPath = path.join(reportDirectory, "analysis.md");
  const jsonPath = path.join(reportDirectory, "analysis.json");

  await Promise.all([
    writeFile(markdownPath, generateAnalysisMarkdown(analysis)),
    writeFile(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`)
  ]);

  return {
    markdownPath,
    jsonPath
  };
}
