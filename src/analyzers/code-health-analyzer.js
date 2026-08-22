import { createFinding } from "../findings/create-finding.js";
import { isSuppressedByFramework } from "../frameworks/index.js";

const TODO_PATTERN = /\b(TODO|FIXME|HACK)\b/i;

export function analyzeCodeHealth(parsedFiles, config) {
  const findings = [];
  const maxFileLines = config.rules.max_file_lines;
  const maxFunctionLines = config.rules.max_function_lines;

  for (const file of parsedFiles) {
    if (
      file.lines.length > maxFileLines &&
      !isSuppressedByFramework(parsedFiles, config, { ruleId: "large_file", file })
    ) {
      findings.push(
        createFinding(config, {
          ruleId: "large_file",
          severity: "medium",
          file: file.path,
          line: 1,
          message: `File has ${file.lines.length} lines, above the limit of ${maxFileLines}.`,
          recommendation: "Split unrelated responsibilities into smaller modules."
        })
      );
    }

    for (const fn of file.functions) {
      if (
        fn.lineCount > maxFunctionLines &&
        !isSuppressedByFramework(parsedFiles, config, { ruleId: "long_function", file, fn })
      ) {
        findings.push(
          createFinding(config, {
            ruleId: "long_function",
            severity: "high",
            file: fn.file,
            line: fn.line,
            message: `Function ${fn.name} has ${fn.lineCount} lines, above the limit of ${maxFunctionLines}.`,
            recommendation: "Extract cohesive steps into named functions or a service."
          })
        );
      }
    }

    file.lines.forEach((line, index) => {
      if (!TODO_PATTERN.test(extractComment(line))) {
        return;
      }

      findings.push(
        createFinding(config, {
          ruleId: "todo_comment",
          severity: "medium",
          file: file.path,
          line: index + 1,
          message: "TODO/FIXME/HACK comment found.",
          recommendation: "Resolve it or move the decision into tracked work."
        })
      );
    });
  }

  return findings;
}

function extractComment(line) {
  const codeWithoutStringsOrRegex = line
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "")
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuy]*/g, "");
  const lineCommentIndex = codeWithoutStringsOrRegex.indexOf("//");
  const blockCommentIndex = codeWithoutStringsOrRegex.indexOf("/*");

  if (lineCommentIndex === -1 && blockCommentIndex === -1) {
    return "";
  }

  if (lineCommentIndex === -1) {
    return codeWithoutStringsOrRegex.slice(blockCommentIndex);
  }

  if (blockCommentIndex === -1) {
    return codeWithoutStringsOrRegex.slice(lineCommentIndex);
  }

  return codeWithoutStringsOrRegex.slice(Math.min(lineCommentIndex, blockCommentIndex));
}
