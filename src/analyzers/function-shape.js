const reservedTokens = new Set([
  "$this",
  "as",
  "async",
  "await",
  "case",
  "catch",
  "const",
  "else",
  "enum",
  "fn",
  "foreach",
  "for",
  "function",
  "if",
  "impl",
  "let",
  "loop",
  "match",
  "mod",
  "mut",
  "new",
  "pub",
  "ref",
  "return",
  "self",
  "static",
  "struct",
  "switch",
  "throw",
  "trait",
  "try",
  "unsafe",
  "use",
  "var",
  "where",
  "while"
]);

export function tokenizeFunctionShape(body) {
  const scrubbed = body
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, " STR ")
    .replace(/\b\d+(?:\.\d+)?\b/g, " NUM ");
  const tokens =
    scrubbed.match(
      /\$?[A-Za-z_][\w$]*|=>|===|!==|==|!=|<=|>=|->|::|[{}()[\].,;:+\-*/%<>=!&|?]/g
    ) ?? [];

  return tokens.map(normalizeShapeToken);
}

export function calculateTokenSimilarity(left, right) {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }

  const commonTokens = calculateLongestCommonSubsequence(left, right);

  return (2 * commonTokens) / (left.length + right.length);
}

function calculateLongestCommonSubsequence(left, right) {
  let previous = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [0];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] =
        left[leftIndex] === right[rightIndex]
          ? previous[rightIndex] + 1
          : Math.max(current[rightIndex], previous[rightIndex + 1]);
    }

    previous = current;
  }

  return previous[right.length];
}

function normalizeShapeToken(token) {
  if (token === "STR" || token === "NUM" || reservedTokens.has(token)) {
    return token;
  }

  if (/^\$?[A-Za-z_][\w$]*$/.test(token)) {
    return "ID";
  }

  return token;
}
