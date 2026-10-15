import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const REQUIRED_STATS = ["totalMutantsCount", "msi"];
const HOUR_MS = 60 * 60 * 1000;

export async function readMutationSummary(projectPath, config, now = new Date()) {
  const settings = config.mutation ?? {};
  const base = {
    provider: settings.provider ?? "infection",
    scopeNote: settings.scope_note ?? ""
  };

  if (!settings.summary) {
    return { ...base, status: "disabled" };
  }

  const summaryPath = path.resolve(projectPath, settings.summary);
  const located = { ...base, summaryPath: settings.summary };

  let fileStat;
  try {
    fileStat = await stat(summaryPath);
  } catch {
    return { ...located, status: "missing" };
  }

  try {
    const stats = parseInfectionStats(JSON.parse(await readFile(summaryPath, "utf8")));
    const { modifiedAt, source } = summaryDate(settings, fileStat.mtime);
    return withAge({ ...located, status: "ok", ...stats, dateSource: source }, modifiedAt, settings, now);
  } catch (error) {
    return { ...located, status: "invalid", error: error.message };
  }
}

export function parseInfectionStats(json) {
  const stats = json?.stats;

  if (stats === null || typeof stats !== "object") {
    throw new Error('Unsupported Infection summary: missing "stats" object.');
  }

  for (const key of REQUIRED_STATS) {
    if (!Number.isFinite(stats[key])) {
      throw new Error(`Unsupported Infection summary: "stats.${key}" must be a number.`);
    }
  }

  const count = (key) => (Number.isFinite(stats[key]) ? stats[key] : 0);
  const notCovered = count("notCoveredCount");
  const escaped = count("escapedCount");

  return {
    msi: stats.msi,
    coveredMsi: Number.isFinite(stats.coveredCodeMsi) ? stats.coveredCodeMsi : null,
    mutantsTotal: stats.totalMutantsCount,
    killed: count("killedCount"),
    timedOut: count("timeOutCount"),
    errors: count("errorCount"),
    notCovered,
    survivors: escaped + notCovered
  };
}

// Infection summaries carry no timestamp, so age comes from the file mtime.
// A copy that does not preserve mtime (plain `cp`) looks fresh; the optional
// `generated_at` setting overrides it.
function summaryDate(settings, mtime) {
  if (settings.generated_at === undefined || settings.generated_at === null) {
    return { modifiedAt: mtime, source: "mtime" };
  }

  const explicit = new Date(settings.generated_at);

  if (Number.isNaN(explicit.getTime())) {
    throw new Error(
      `Invalid mutation.generated_at: "${settings.generated_at}" (expected an ISO date such as 2026-10-15T01:00:00Z).`
    );
  }

  return { modifiedAt: explicit, source: "generated_at" };
}

function withAge(mutation, modifiedAt, settings, now) {
  const ageHours = (now.getTime() - modifiedAt.getTime()) / HOUR_MS;
  const maxAge = settings.max_age_hours;
  const stale = Number.isFinite(maxAge) && ageHours > maxAge;
  const warnings = stale
    ? [`Mutation summary is ${Math.floor(ageHours)}h old (max_age_hours: ${maxAge}); result may be stale.`]
    : [];

  return {
    ...mutation,
    fileModifiedAt: modifiedAt.toISOString(),
    stale,
    warnings
  };
}
