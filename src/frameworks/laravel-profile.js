const ELOQUENT_RELATION_METHODS = [
  "belongsTo",
  "hasOne",
  "hasMany",
  "belongsToMany",
  "morphOne",
  "morphMany",
  "morphTo",
  "morphToMany",
  "hasManyThrough",
  "hasOneThrough"
].join("|");

const ELOQUENT_RELATION_PATTERN = new RegExp(
  `^return\\$this->(?:${ELOQUENT_RELATION_METHODS})\\([^;]+;?$`
);

export const laravelProfile = {
  id: "laravel",
  detect(parsedFiles) {
    return parsedFiles.some((file) =>
      [
        "artisan",
        "routes/web.php",
        "routes/api.php",
        "app/Models/",
        "app/Http/",
        "database/migrations/",
        "resources/views/"
      ].some((marker) => file.path === marker || file.path.startsWith(marker))
    );
  },
  suppress(candidate) {
    if (candidate.ruleId === "duplicate_functions") {
      return suppressDuplicateFunction(candidate);
    }

    if (candidate.ruleId === "long_function" || candidate.ruleId === "large_file") {
      return suppressCodeHealth(candidate);
    }

    return null;
  }
};

export function isLaravelMigration(filePath) {
  return filePath.startsWith("database/migrations/") || filePath.includes("/database/migrations/");
}

function suppressDuplicateFunction(candidate) {
  if (isLaravelMigration(candidate.fn.file)) {
    return suppression("laravel_migration_method", "Laravel migration methods are framework convention.");
  }

  if (
    candidate.fn.file.startsWith("app/Models/") &&
    isSimpleEloquentRelationship(candidate.executableBody)
  ) {
    return suppression(
      "eloquent_relationship",
      "Simple Eloquent relationship methods are framework convention."
    );
  }

  if (isBreezeVoltLogoutAction(candidate.fn, candidate.executableBody)) {
    return suppression("breeze_volt_logout", "Breeze/Volt logout actions are scaffold convention.");
  }

  return null;
}

function suppressCodeHealth(candidate) {
  if (!isPublishedSpatiePermissionMigration(candidate.file)) {
    return null;
  }

  return suppression(
    "spatie_permission_migration",
    "Published Spatie Permission migration is vendor scaffold."
  );
}

function suppression(id, reason) {
  return {
    id,
    reason
  };
}

function isPublishedSpatiePermissionMigration(file) {
  return (
    isLaravelMigration(file.path) &&
    file.content.includes("config('permission.table_names')") &&
    file.content.includes("model_has_permissions")
  );
}

function isSimpleEloquentRelationship(body) {
  return ELOQUENT_RELATION_PATTERN.test(normalizeFunctionBody(body));
}

function isBreezeVoltLogoutAction(fn, body) {
  if (!fn.file.startsWith("resources/views/") || !fn.file.endsWith(".blade.php")) {
    return false;
  }

  if (fn.name !== "logout") {
    return false;
  }

  return /^\$logout\(\);\$this->redirect\([^;]+navigate:true\);?$/.test(
    normalizeFunctionBody(body)
  );
}

function normalizeFunctionBody(body) {
  return body
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, "");
}
