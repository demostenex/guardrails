export function matchesAnyGlob(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

export function globToRegExp(pattern) {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*" && pattern[index + 2] === "/") {
      source += "(?:.*/)?";
      index += 2;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += ".";
      continue;
    }

    source += escapeRegExp(char);
  }

  source += "$";
  return new RegExp(source);
}

function escapeRegExp(char) {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}
