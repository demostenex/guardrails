import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fingerprintFinding } from "../findings/fingerprint.js";

const BASELINE_FILE = ".guardrails/baseline.json";

export async function loadBaseline(projectPath) {
  try {
    const content = await readFile(path.join(projectPath, BASELINE_FILE), "utf8");
    return JSON.parse(content);
  } catch {
    return { findings: [] };
  }
}

export async function saveBaseline(projectPath, scanResult) {
  const baselinePath = path.join(projectPath, BASELINE_FILE);
  const baseline = {
    generatedAt: new Date().toISOString(),
    findings: scanResult.findings.map((finding) => ({
      id: fingerprintFinding(finding),
      ruleId: finding.ruleId,
      file: finding.file,
      files: finding.files,
      message: finding.message
    }))
  };

  if (scanResult.mutation?.status === "ok") {
    baseline.mutation = {
      msi: scanResult.mutation.msi,
      survivors: scanResult.mutation.survivors,
      scopeNote: scanResult.mutation.scopeNote
    };
  }

  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);

  return baseline;
}

export function markBaselineFindings(findings, baseline) {
  const baselineIds = new Set((baseline?.findings ?? []).map((finding) => finding.id));

  return findings.map((finding) => {
    const id = fingerprintFinding(finding);

    return {
      ...finding,
      id,
      status: baselineIds.has(id) ? "baseline" : "new"
    };
  });
}
