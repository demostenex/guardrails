import { analyzeArchitecture } from "./architecture-analyzer.js";
import { analyzeCodeHealth } from "./code-health-analyzer.js";
import { analyzeDuplicates } from "./duplicate-analyzer.js";
import { analyzeServices } from "./service-analyzer.js";
import { analyzeVibeRisk } from "./vibe-analyzer.js";

export function analyzeProject(parsedFiles, config, options = {}) {
  return [
    ...analyzeCodeHealth(parsedFiles, config),
    ...analyzeServices(parsedFiles, config),
    ...analyzeArchitecture(parsedFiles, config),
    ...analyzeDuplicates(parsedFiles, config),
    ...analyzeVibeRisk(options.changedFiles, config)
  ];
}
