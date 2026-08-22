import path from "node:path";

const RUST_FN =
  /^\s*(?:pub(?:\s*\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]+")?)\s+)*fn\s+([A-Za-z_][\w]*)\b/;

export function parseFile(file) {
  const functions = parseFunctions(file);
  const classes = parseClasses(file);
  const imports = parseImports(file);

  return {
    ...file,
    functions,
    classes,
    imports
  };
}

function parseFunctions(file) {
  const functions = [];

  for (let index = 0; index < file.lines.length; index += 1) {
    const line = file.lines[index];
    const declaration = line.match(
      /^\s*(?:(?:export|async|public|protected|private|static|final|abstract)\s+)*function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{;]*\{?/
    );
    const arrow = line.match(
      /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/
    );
    const rust = line.match(RUST_FN);
    const match = declaration ?? arrow ?? rust;

    if (!match) {
      continue;
    }

    if ((declaration || rust) && !hasBlockAhead(file.lines, index)) {
      continue;
    }

    const block = readBlock(file.lines, index);
    functions.push({
      name: match[1],
      file: file.path,
      line: index + 1,
      endLine: block.endLine + 1,
      lineCount: block.endLine - index + 1,
      body: block.body
    });
  }

  return functions;
}

function parseClasses(file) {
  const classes = [];

  for (let index = 0; index < file.lines.length; index += 1) {
    const line = file.lines[index];
    const jsClass = line.match(/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/);
    const rustType = matchRustType(line);
    const match = jsClass ?? rustType;

    if (!match) {
      continue;
    }

    if (rustType && !hasBlockAhead(file.lines, index)) {
      continue;
    }

    const block = readBlock(file.lines, index);
    const methods = parseMethods(file, index, block.endLine, Boolean(rustType));

    classes.push({
      name: rustType ? rustType.name : jsClass[1],
      kind: rustType ? rustType.kind : "class",
      file: file.path,
      line: index + 1,
      endLine: block.endLine + 1,
      methods
    });
  }

  return classes;
}

function parseMethods(file, startIndex, endLine, rustOnly = false) {
  const methodLines = file.lines.slice(startIndex + 1, endLine);

  return methodLines
    .map((methodLine, offset) => {
      const rust = methodLine.match(RUST_FN);
      const jsMethod = rustOnly
        ? null
        : methodLine.match(
            /^\s*(?:(?:public|protected|private|static|final|abstract|async)\s+)*(?:function\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{;]*\{?/
          );
      const methodMatch = rust ?? jsMethod;

      if (
        !methodMatch ||
        (!rust && ["if", "for", "while", "switch", "catch"].includes(methodMatch[1])) ||
        !hasBlockAhead(file.lines, startIndex + offset + 1)
      ) {
        return null;
      }

      return {
        name: methodMatch[1],
        line: startIndex + offset + 2
      };
    })
    .filter(Boolean);
}

function matchRustType(line) {
  const named = line.match(
    /^\s*(?:pub(?:\s*\([^)]*\))?\s+)?(struct|enum|trait)\s+([A-Za-z_][\w]*)\b/
  );

  if (named) {
    return { kind: named[1], name: named[2] };
  }

  const implFor = line.match(
    /^\s*impl(?:<[^<>]*>)?\s+([A-Za-z_][\w:]*)\s+for\s+([A-Za-z_][\w]*)\b/
  );

  if (implFor) {
    return { kind: "impl", name: implFor[2] };
  }

  const impl = line.match(/^\s*impl(?:<[^<>]*>)?\s+([A-Za-z_][\w]*)\b/);

  if (impl) {
    return { kind: "impl", name: impl[1] };
  }

  return null;
}

function parseImports(file) {
  const imports = [];

  for (let index = 0; index < file.lines.length; index += 1) {
    const line = file.lines[index];
    const specifiers = [
      ...line.matchAll(/import\s+[^'"]*from\s+['"]([^'"]+)['"]/g),
      ...line.matchAll(/import\s+['"]([^'"]+)['"]/g),
      ...line.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)
    ].map((match) => match[1]);

    specifiers.push(...parseUseSpecifiers(line));

    for (const specifier of specifiers) {
      imports.push({
        specifier,
        resolvedPath: resolveImport(file.path, specifier),
        line: index + 1
      });
    }

    const rustMod = line.match(/^\s*(?:pub\s+)?mod\s+([A-Za-z_][\w]*)\s*;/);

    if (rustMod) {
      imports.push({
        specifier: rustMod[1],
        resolvedPath: resolveRustMod(file.path, rustMod[1]),
        line: index + 1
      });
    }
  }

  return imports;
}

function parseUseSpecifiers(line) {
  const match = line.match(/^\s*(?:pub\s+)?use\s+(.+?);/);

  if (!match) {
    return [];
  }

  return expandUseSpecifiers(match[1].trim()).map(stripUseAlias);
}

function expandUseSpecifiers(raw) {
  const grouped = raw.match(/^(.+?)::\s*\{([^}]+)\}$/);

  if (!grouped) {
    return [raw];
  }

  const prefix = grouped[1].trim();
  const items = grouped[2]
    .split(",")
    .map((item) => stripUseAlias(item.trim()))
    .filter(Boolean);
  const specifiers = [];

  for (const item of items) {
    if (item === "self" || item === "*") {
      specifiers.push(prefix);
      continue;
    }

    specifiers.push(`${prefix}::${item}`);
  }

  return specifiers.length > 0 ? specifiers : [prefix];
}

function stripUseAlias(specifier) {
  return specifier.replace(/\s+as\s+[A-Za-z_][\w]*\s*$/i, "").trim();
}

function resolveImport(filePath, specifier) {
  const rustPath = resolveRustPath(filePath, specifier);

  if (rustPath) {
    return rustPath;
  }

  if (!specifier.startsWith(".")) {
    if (specifier.startsWith("App\\")) {
      return `app/${specifier.slice(4).replaceAll("\\", "/")}`;
    }

    return specifier;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(filePath), specifier));
}

function resolveRustPath(filePath, specifier) {
  if (specifier === "crate" || specifier.startsWith("crate::")) {
    const rest = specifier === "crate" ? "" : specifier.slice("crate::".length);
    return joinRustSegments(rustCrateSrcRoot(filePath), rest);
  }

  if (specifier.startsWith("super::")) {
    return joinRustSegments(rustParentModuleDir(filePath), specifier.slice("super::".length));
  }

  if (specifier.startsWith("self::")) {
    return joinRustSegments(rustCurrentModuleDir(filePath), specifier.slice("self::".length));
  }

  return null;
}

function resolveRustMod(filePath, name) {
  return path.posix.normalize(path.posix.join(rustCurrentModuleDir(filePath), name));
}

function rustCrateSrcRoot(filePath) {
  const normalized = normalizePosix(filePath);
  const marker = "/src/";
  const index = normalized.lastIndexOf(marker);

  if (index !== -1) {
    return normalized.slice(0, index + "/src".length);
  }

  if (normalized === "src" || normalized.startsWith("src/")) {
    return "src";
  }

  return "src";
}

function rustCurrentModuleDir(filePath) {
  const normalized = normalizePosix(filePath);
  const baseName = path.posix.basename(normalized);

  if (baseName === "mod.rs" || baseName === "lib.rs" || baseName === "main.rs") {
    return path.posix.dirname(normalized);
  }

  return normalized.replace(/\.rs$/, "");
}

function rustParentModuleDir(filePath) {
  return path.posix.dirname(rustCurrentModuleDir(filePath));
}

function joinRustSegments(base, modPath) {
  const parts = modPath.split("::").filter(Boolean);

  if (parts.length > 0 && isRustTypeName(parts[parts.length - 1])) {
    parts.pop();
  }

  if (parts.length === 0) {
    return base;
  }

  return path.posix.normalize(path.posix.join(base, ...parts));
}

function isRustTypeName(name) {
  return /^[A-Z]/.test(name);
}

function normalizePosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function readBlock(lines, startIndex) {
  let depth = 0;
  let started = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = stripStringsAndComments(lines[index]);

    for (const char of line) {
      if (char === "{") {
        depth += 1;
        started = true;
      }

      if (char === "}") {
        depth -= 1;
      }
    }

    if (started && depth <= 0) {
      return {
        endLine: index,
        body: lines.slice(startIndex, index + 1).join("\n")
      };
    }
  }

  return {
    endLine: lines.length - 1,
    body: lines.slice(startIndex).join("\n")
  };
}

function hasBlockAhead(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = stripStringsAndComments(lines[index]);
    const braceIndex = line.indexOf("{");
    const semicolonIndex = line.indexOf(";");

    if (braceIndex !== -1 && (semicolonIndex === -1 || braceIndex < semicolonIndex)) {
      return true;
    }

    if (semicolonIndex !== -1) {
      return false;
    }
  }

  return false;
}

function stripStringsAndComments(line) {
  return line
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "")
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuy]*/g, "")
    .replace(/\/\/.*$/, "");
}
