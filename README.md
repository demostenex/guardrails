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
