export function parseYaml(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => {
      const indent = line.match(/^ */)?.[0].length ?? 0;
      return {
        indent,
        text: stripInlineComment(line.trim())
      };
    })
    .filter((line) => line.text.length > 0);

  if (lines.length === 0) {
    return {};
  }

  return parseBlock(lines, 0, lines[0].indent).value;
}

function parseBlock(lines, index, indent) {
  if (lines[index]?.text.startsWith("- ")) {
    return parseArray(lines, index, indent);
  }

  return parseObject(lines, index, indent);
}

function parseObject(lines, index, indent) {
  const object = {};

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent || line.text.startsWith("- ")) {
      break;
    }

    if (line.indent > indent) {
      index += 1;
      continue;
    }

    const { key, rawValue } = splitKeyValue(line.text);

    if (rawValue.length === 0) {
      const nextLine = lines[index + 1];

      if (nextLine && nextLine.indent > line.indent) {
        const child = parseBlock(lines, index + 1, nextLine.indent);
        object[key] = child.value;
        index = child.index;
      } else {
        object[key] = {};
        index += 1;
      }
    } else {
      object[key] = parseScalar(rawValue);
      index += 1;
    }
  }

  return { value: object, index };
}

function parseArray(lines, index, indent) {
  const array = [];

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent || !line.text.startsWith("- ")) {
      break;
    }

    const rawItem = line.text.slice(2).trim();
    const item = parseArrayItem(lines, index, line, rawItem);

    array.push(item.value);
    index = item.index;
  }

  return { value: array, index };
}

function parseArrayItem(lines, index, line, rawItem) {
  if (rawItem.length === 0) {
    return parseEmptyArrayItem(lines, index, line);
  }

  if (looksLikeKeyValue(rawItem)) {
    return parseObjectArrayItem(lines, index, line, rawItem);
  }

  return {
    value: parseScalar(rawItem),
    index: index + 1
  };
}

function parseEmptyArrayItem(lines, index, line) {
  const nextLine = lines[index + 1];

  if (nextLine && nextLine.indent > line.indent) {
    const child = parseBlock(lines, index + 1, nextLine.indent);
    return {
      value: child.value,
      index: child.index
    };
  }

  return {
    value: null,
    index: index + 1
  };
}

function parseObjectArrayItem(lines, index, line, rawItem) {
  const object = {};
  const { key, rawValue } = splitKeyValue(rawItem);

  if (rawValue.length === 0) {
    const nextLine = lines[index + 1];

    if (nextLine && nextLine.indent > line.indent) {
      const child = parseBlock(lines, index + 1, nextLine.indent);
      object[key] = child.value;
      index = child.index;
    } else {
      object[key] = {};
      index += 1;
    }
  } else {
    object[key] = parseScalar(rawValue);
    index += 1;
  }

  if (lines[index] && lines[index].indent > line.indent) {
    const child = parseObject(lines, index, lines[index].indent);
    Object.assign(object, child.value);
    index = child.index;
  }

  return {
    value: object,
    index
  };
}

function splitKeyValue(text) {
  const separator = text.indexOf(":");

  if (separator === -1) {
    throw new Error(`Invalid YAML line: ${text}`);
  }

  return {
    key: text.slice(0, separator).trim(),
    rawValue: text.slice(separator + 1).trim()
  };
}

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value === "[]") return [];
  if (value === "{}") return {};
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function looksLikeKeyValue(value) {
  return /^[A-Za-z0-9_-]+:/.test(value);
}

function stripInlineComment(value) {
  if (value.startsWith("#")) {
    return "";
  }

  return value.replace(/\s+#.*$/, "");
}
