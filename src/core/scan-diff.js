import { getGitChangedFiles } from "../scanner/git-diff-scanner.js";
import { scanProject } from "./scan-project.js";

export async function scanDiff(projectPath = process.cwd(), options = {}) {
  const changedFiles = normalizeFiles(
    options.changedFiles ?? (await getGitChangedFiles(projectPath))
  );

  return scanProject(projectPath, {
    onlyFiles: changedFiles,
    changedFiles,
    useBaseline: options.useBaseline,
    summaryDate: options.summaryDate
  });
}

function normalizeFiles(files) {
  return files.map((file) => file.replaceAll("\\", "/"));
}
