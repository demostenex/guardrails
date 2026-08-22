export function fingerprintFinding(finding) {
  const location = finding.files?.join("|") ?? finding.file ?? "";
  return [finding.ruleId, location, finding.message].join("::");
}
