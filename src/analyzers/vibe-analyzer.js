import { createFinding } from "../findings/create-finding.js";

export function analyzeVibeRisk(changedFiles, config) {
  if (!changedFiles || changedFiles.length === 0) {
    return [];
  }

  const maxFiles = config.vibe?.max_files_changed_for_small_diff ?? 8;

  if (changedFiles.length <= maxFiles) {
    return [];
  }

  return [
    createFinding(config, {
      ruleId: "vibe_large_change_surface",
      severity: "medium",
      files: changedFiles,
      message: `Diff touches ${changedFiles.length} files, above the vibe-coding review threshold of ${maxFiles}.`,
      recommendation: "Split the change or review whether generated code spread into unrelated areas."
    })
  ];
}
