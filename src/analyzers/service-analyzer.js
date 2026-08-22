import { createFinding } from "../findings/create-finding.js";

export function analyzeServices(parsedFiles, config) {
  const findings = [];
  const maxMethods = config.rules.max_service_methods;

  for (const file of parsedFiles) {
    for (const parsedClass of file.classes) {
      if (!isService(file.path, parsedClass.name)) {
        continue;
      }

      if (parsedClass.methods.length <= maxMethods) {
        continue;
      }

      findings.push(
        createFinding(config, {
          ruleId: "large_service",
          severity: "high",
          file: parsedClass.file,
          line: parsedClass.line,
          message: `Service ${parsedClass.name} has ${parsedClass.methods.length} methods, above the limit of ${maxMethods}.`,
          recommendation: "Split the service by responsibility or use case."
        })
      );
    }
  }

  return findings;
}

function isService(filePath, className) {
  return filePath.includes("/services/") || className.endsWith("Service");
}
