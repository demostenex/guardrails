import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { matchesAnyGlob } from "./glob.js";

export async function scanFiles(projectPath, config, options = {}) {
  const allFiles = await walk(projectPath);
  const onlyFiles = options.onlyFiles
    ? new Set(options.onlyFiles.map((file) => normalizePath(file)))
    : null;

  const selectedFiles = allFiles
    .map((absolutePath) => ({
      absolutePath,
      path: normalizePath(path.relative(projectPath, absolutePath))
    }))
    .filter((file) => !onlyFiles || onlyFiles.has(file.path))
    .filter((file) => isIncluded(file.path, config.scan));

  return Promise.all(
    selectedFiles.map(async (file) => {
      const content = await readFile(file.absolutePath, "utf8");

      return {
        ...file,
        content,
        lines: content.split(/\r?\n/)
      };
    })
  );
}

async function walk(directory) {
  const entries = await readDirectoryOrSkip(directory);
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      files.push(...(await walk(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function readDirectoryOrSkip(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      return [];
    }

    throw error;
  }
}

function shouldSkipDirectory(name) {
  return [
    ".git",
    ".guardrails",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "coverage",
    "target"
  ].includes(name);
}

function isIncluded(filePath, scanConfig) {
  const include = scanConfig.include ?? [];
  const exclude = scanConfig.exclude ?? [];

  return matchesAnyGlob(filePath, include) && !matchesAnyGlob(filePath, exclude);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}
