export function evaluateMutationGate(mutation, config) {
  const policy = config.policies?.mutation_score_drop ?? "warn";
  const settings = config.mutation ?? {};
  const base = { policy, violations: [], notices: [] };

  const gateConfigured = Number.isFinite(settings.min_msi) || Number.isFinite(settings.max_drop);

  if (!mutation || mutation.status === "disabled" || mutation.status === "missing") {
    return gateConfigured ? { ...base, violations: [noDataMessage(mutation)] } : base;
  }

  if (mutation.status === "invalid") {
    return { ...base, violations: [`Mutation summary unreadable: ${mutation.error}`] };
  }

  const violations = [];
  const notices = [];

  for (const warning of mutation.warnings ?? []) {
    (settings.fail_on_stale ? violations : notices).push(warning);
  }

  checkFloor(mutation, settings, violations);
  checkDrop(mutation, settings, violations, notices);

  return { ...base, violations, notices };
}

function checkFloor(mutation, settings, violations) {
  if (Number.isFinite(settings.min_msi) && mutation.msi < settings.min_msi) {
    violations.push(`MSI ${mutation.msi}% is below min_msi ${settings.min_msi}%.`);
  }
}

function checkDrop(mutation, settings, violations, notices) {
  if (!Number.isFinite(settings.max_drop)) {
    return;
  }

  const baseline = mutation.baseline;

  if (!baseline || !Number.isFinite(baseline.msi)) {
    notices.push("No mutation baseline saved; max_drop not checked. Run `guardrails baseline`.");
    return;
  }

  if ((baseline.scopeNote ?? "") !== (mutation.scopeNote ?? "")) {
    violations.push(
      `Different mutation scopes (baseline: "${baseline.scopeNote ?? ""}", current: "${mutation.scopeNote ?? ""}"); max_drop cannot be compared. Run \`guardrails baseline\` again.`
    );
    return;
  }

  const drop = round(baseline.msi - mutation.msi);

  if (drop > settings.max_drop) {
    violations.push(
      `MSI dropped ${drop} points (${baseline.msi}% -> ${mutation.msi}%), above max_drop ${settings.max_drop}.`
    );
  }
}

function noDataMessage(mutation) {
  return mutation?.status === "missing"
    ? `Mutation gate configured but summary file not found (${mutation.summaryPath}); run Infection first.`
    : "Mutation gate configured (min_msi/max_drop) but mutation.summary is not set.";
}

function round(value) {
  return Math.round(value * 100) / 100;
}
