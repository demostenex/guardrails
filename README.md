# Guardrails

Code health guardrails for fast AI-assisted development workflows.

This project is built with a strict TDD loop: write a failing test, implement the smallest behavior that passes, then refactor while keeping the suite green.

## Commands

```bash
npm test
npm run guardrails -- --help
npm run guardrails -- help details
npm run guardrails -- scan --path .
npm run guardrails -- diff --path .
npm run guardrails -- ci --path .
npm run guardrails -- baseline --path .
npm run guardrails -- report --path .
npm run guardrails -- history --path .
npm run guardrails -- compare --path .
npm run guardrails -- maturity --path .
npm run guardrails -- explain --path .
npm run guardrails -- watch --path . --interval 300000
```

After linking the package globally, the same commands can be run from any
project without `npm run`:

```bash
npm link
guardrails scan --path /path/to/project
guardrails ci --path /path/to/project
guardrails explain --path /path/to/project
```

Use `guardrails --help` for quick usage and `guardrails help details` or
`guardrails man` for the detailed manual.

For AI-assisted reviews, run `guardrails explain --path /path/to/project` and
send the generated `.guardrails/analysis.md` plus `.guardrails/report.md` to the
AI reviewing the code.

## Current MVP

- Loads `.guardrails.yml`.
- Scans configured source files, including JavaScript/TypeScript, PHP, and Rust by default.
- Reports large files, long functions, TODO/FIXME/HACK comments, large services, duplicated function bodies, structurally similar functions, forbidden imports, and large diff surfaces.
- Applies framework profiles for defensible boilerplate suppressions, with Laravel auto-detected by default.
- Generates `.guardrails/report.md` and `.guardrails/report.json`.
- Saves immutable scan versions in `.guardrails/history/` and updates `.guardrails/latest.json`.
- Compares the latest two scan versions with `compare`.
- Summarizes project maturity with `maturity`.
- Writes a read-only inspection analysis with `explain`.
- Saves a baseline so existing debt can be separated from new findings.
- Provides `ci` mode that fails when a non-baseline finding has `block` policy.

## Configuration

```yaml
project:
  name: my-app

scan:
  include:
    - src/**/*.js
    - src/**/*.rs

rules:
  max_file_lines: 400
  max_function_lines: 80
  max_service_methods: 12
  min_duplicate_body_chars: 40
  min_similar_body_tokens: 35
  similar_function_threshold: 0.9

policies:
  architecture_violation: block
  duplicate_functions: warn
  similar_functions: warn

frameworks:
  auto_detect: true
  enabled: []

architecture:
  forbidden_imports:
    - from: domain
      to: ui
```

## Mutation Testing

Guardrails never runs Infection (or any test suite). The observed project runs
it and Guardrails only reads the resulting `infection-summary.json`
(`logs.summaryJson` in `infection.json5`):

```yaml
mutation:
  provider: infection
  summary: storage/logs/infection-summary.json   # relative to --path
  scope_note: "Billing module"   # free text; shown next to the MSI
  max_age_hours: 168             # warn when the file is older
  fail_on_stale: false           # treat an old file as a violation
  min_msi: null                  # optional floor
  max_drop: 2.0                  # max points lost versus baseline MSI

policies:
  mutation_score_drop: block     # or warn
```

- No `summary` configured, or file missing: `scan` and `ci` report "sem dados de mutação" and never fail because of it.
- Each scan adds a "Mutação" section to `report.md` and a `mutation.json` to the history version. `compare` shows MSI and survivor deltas; `maturity` and `explain` show the current MSI. Survivors are escaped plus not-covered mutants.
- `guardrails baseline` also stores the current MSI and scope. `ci` then fails (with `block`) when MSI falls more than `max_drop` points below it, or below `min_msi`.
- If `min_msi` or `max_drop` is set and the summary file is missing, that is a violation (fails with `block`), so a CI that forgot to run Infection cannot pass silently.
- If `scope_note` differs between baseline and current scan, `max_drop` cannot be compared: that is a violation until `guardrails baseline` is run again.
- A stale summary prints a warning in `ci` and `baseline`; with `fail_on_stale: true` it is a violation.
- An unreadable or unsupported summary format is reported with a clear error and counts as a violation of the policy.
- Gate against drops, not against a high target: chasing 100% MSI leads to tests that only kill equivalent mutants.

## TDD Contract

Every new guardrail rule should start as a fixture-driven test. Bugs should be reproduced with a failing test before the implementation changes.

## History And Maturity

Every `scan`, `diff`, and `ci` run writes the current report and a timestamped history version:

```txt
.guardrails/
  report.md
  report.json
  latest.json
  history/
    2026-07-25T16-03-13-942Z/
      report.md
      report.json
      summary.json
```

Use `history` to list versions, `compare` to compare the latest two scans, and `maturity` to get a read-only inspection summary. These commands point out where to look; they do not change application code.

`explain` writes `.guardrails/analysis.md` and `.guardrails/analysis.json`. It includes an AI-ready prompt for external analysis, but the command itself is deterministic and read-only with respect to application code.
