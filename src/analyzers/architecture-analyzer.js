import { createFinding } from "../findings/create-finding.js";

export function analyzeArchitecture(parsedFiles, config) {
  const findings = [];
  const forbiddenImports = config.architecture?.forbidden_imports ?? [];

  if (forbiddenImports.length === 0) {
    return findings;
  }

  for (const file of parsedFiles) {
    const sourceLayer = findLayer(file.path, config);

    if (!sourceLayer) {
      continue;
    }

    for (const importItem of file.imports) {
      const targetLayer = findLayer(importItem.resolvedPath, config);

      if (!targetLayer) {
        continue;
      }

      const violation = forbiddenImports.find(
        (rule) => rule.from === sourceLayer && rule.to === targetLayer
      );

      if (!violation) {
        continue;
      }

      findings.push(
        createFinding(config, {
          ruleId: "architecture_violation",
          severity: "critical",
          file: file.path,
          line: importItem.line,
          message: `${sourceLayer} imports ${targetLayer}, which is forbidden by architecture rules.`,
          recommendation: "Invert the dependency or move orchestration into an allowed layer.",
          details: {
            from: sourceLayer,
            to: targetLayer,
            import: importItem.specifier
          }
        })
      );
    }
  }

  return findings;
}

function findLayer(filePath, config) {
  const layers = config.architecture?.layers ?? [];
  const segments = filePath.split("/").map((segment) => segment.toLowerCase());

  return layers.find((layer) => segments.includes(layer.toLowerCase())) ?? null;
}
