import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { defaultConfig } from "./default-config.js";
import { parseYaml } from "./simple-yaml.js";

const CONFIG_FILES = [".guardrails.yml", ".guardrails.yaml", ".guardrails.json"];

export async function loadConfig(projectPath = process.cwd()) {
  const configPath = await findConfig(projectPath);
  const localConfig = configPath ? await readConfig(configPath) : {};
  const config = mergeDeep(
    {
      ...defaultConfig,
      project: {
        ...defaultConfig.project,
        name: path.basename(projectPath)
      }
    },
    localConfig
  );

  return config;
}

async function findConfig(projectPath) {
  for (const fileName of CONFIG_FILES) {
    const configPath = path.join(projectPath, fileName);

    try {
      await access(configPath);
      return configPath;
    } catch {
      // Keep looking for the next supported config filename.
    }
  }

  return null;
}

async function readConfig(configPath) {
  const content = await readFile(configPath, "utf8");

  if (configPath.endsWith(".json")) {
    return JSON.parse(content);
  }

  return parseYaml(content);
}

function mergeDeep(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override ?? base;
  }

  if (!isObject(base) || !isObject(override)) {
    return override ?? base;
  }

  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    result[key] = mergeDeep(base[key], value);
  }

  return result;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
