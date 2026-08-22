import { createFinding } from "../findings/create-finding.js";
import { tokenizeFunctionShape } from "./function-shape.js";
import { findSimilarGroups } from "./similar-functions.js";
import { isSuppressedByFramework } from "../frameworks/index.js";

export function analyzeDuplicates(parsedFiles, config) {
  const candidates = collectDuplicateCandidates(parsedFiles, config);

  return [
    ...findExactDuplicateFindings(candidates, config),
    ...findSimilarFunctionFindings(candidates, config)
  ];
}

function collectDuplicateCandidates(parsedFiles, config) {
  const minChars = config.rules.min_duplicate_body_chars ?? 40;
  const minSimilarTokens = config.rules.min_similar_body_tokens ?? 35;
  const candidates = [];

  for (const file of parsedFiles) {
    for (const fn of file.functions) {
      const executableBody = extractExecutableBody(fn.body);

      if (isSuppressedByFramework(parsedFiles, config, {
        ruleId: "duplicate_functions",
        fn,
        executableBody
      })) {
        continue;
      }

      const normalizedBody = normalizeFunctionBody(executableBody);

      if (normalizedBody.length < minChars) {
        continue;
      }

      candidates.push({
        fn,
        normalizedBody,
        shapeTokens: tokenizeFunctionShape(executableBody).slice(0, 500),
        minSimilarTokens
      });
    }
  }

  return candidates;
}

function findExactDuplicateFindings(candidates, config) {
  const functionsByBody = groupBy(candidates, (candidate) => candidate.normalizedBody);
  const findings = [];

  for (const duplicates of functionsByBody.values()) {
    const functions = duplicates.map((candidate) => candidate.fn);

    if (functions.length < 2) {
      continue;
    }

    findings.push(
      createFinding(config, {
        ruleId: "duplicate_functions",
        severity: "high",
        files: functions.map((fn) => fn.file),
        message: `Functions ${functions.map((fn) => fn.name).join(", ")} have duplicated bodies.`,
        recommendation: "Consolidate the duplicated logic behind one shared function or service.",
        details: {
          functions: createFunctionDetails(functions)
        }
      })
    );
  }

  return findings;
}

function findSimilarFunctionFindings(candidates, config) {
  const groups = findSimilarGroups(
    candidates.filter((candidate) => candidate.shapeTokens.length >= candidate.minSimilarTokens),
    config.rules.similar_function_threshold ?? 0.9
  );
  const findings = [];

  for (const group of groups) {
    const exactBodies = new Set(group.candidates.map((candidate) => candidate.normalizedBody));

    if (exactBodies.size < 2) {
      continue;
    }

    const functions = group.candidates.map((candidate) => candidate.fn);

    findings.push(
      createFinding(config, {
        ruleId: "similar_functions",
        severity: "medium",
        files: functions.map((fn) => fn.file),
        message: `Functions ${functions.map((fn) => fn.name).join(", ")} are structurally similar.`,
        recommendation: "Review whether the shared structure is intentional or should be extracted.",
        details: {
          similarity: Number(group.similarity.toFixed(2)),
          functions: createFunctionDetails(functions)
        }
      })
    );
  }

  return findings;
}

function groupBy(items, keyFor) {
  const groups = new Map();

  for (const item of items) {
    const key = keyFor(item);
    const matches = groups.get(key) ?? [];
    matches.push(item);
    groups.set(key, matches);
  }

  return groups;
}

function createFunctionDetails(functions) {
  return functions.map((fn) => ({
    name: fn.name,
    file: fn.file,
    line: fn.line
  }));
}

function normalizeFunctionBody(body) {
  return body
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, "");
}

function extractExecutableBody(body) {
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return body;
  }

  return body.slice(start + 1, end);
}
