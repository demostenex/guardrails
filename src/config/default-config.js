export const defaultConfig = {
  project: {
    name: "guardrails",
    language: "javascript"
  },
  scan: {
    include: [
      "src/**/*.js",
      "src/**/*.ts",
      "src/**/*.jsx",
      "src/**/*.tsx",
      "**/app/**/*.php",
      "**/routes/**/*.php",
      "**/config/**/*.php",
      "**/database/migrations/**/*.php",
      "**/database/seeders/**/*.php",
      "**/database/factories/**/*.php",
      "**/resources/views/**/*.blade.php",
      "**/resources/js/**/*.js",
      "**/resources/js/**/*.ts",
      "**/*.rs"
    ],
    exclude: [
      ".git/**",
      ".guardrails/**",
      "node_modules/**",
      "vendor/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "target/**"
    ]
  },
  rules: {
    max_file_lines: 400,
    max_function_lines: 80,
    max_service_methods: 12,
    min_duplicate_body_chars: 40,
    min_similar_body_tokens: 35,
    similar_function_threshold: 0.9
  },
  policies: {
    architecture_violation: "block",
    duplicate_functions: "warn",
    large_file: "warn",
    large_service: "warn",
    long_function: "warn",
    similar_functions: "warn",
    todo_comment: "warn",
    vibe_large_change_surface: "warn"
  },
  frameworks: {
    auto_detect: true,
    enabled: []
  },
  architecture: {
    layers: ["ui", "app", "domain", "services", "infra"],
    forbidden_imports: []
  },
  vibe: {
    max_files_changed_for_small_diff: 8,
    warn_on_unconnected_new_files: true,
    warn_on_duplicate_service_intent: true,
    warn_on_many_new_abstractions: true
  },
  ignore: []
};
