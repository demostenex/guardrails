import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getGitChangedFiles(projectPath) {
  const tracked = await git(projectPath, [
    "diff",
    "--name-only",
    "--diff-filter=ACMRTUXB",
    "HEAD"
  ]);
  const untracked = await git(projectPath, [
    "ls-files",
    "--others",
    "--exclude-standard"
  ]);

  return unique(
    [...tracked, ...untracked]
      .map((file) => file.trim())
      .filter((file) => file.length > 0)
  );
}

async function git(projectPath, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: projectPath
    });

    return result.stdout.split(/\r?\n/);
  } catch {
    return [];
  }
}

function unique(values) {
  return [...new Set(values)];
}
