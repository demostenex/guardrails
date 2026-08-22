import path from "node:path";

import { commandHandlers } from "./command-handlers.js";
import { detailedHelpText, shortHelpText } from "./help-text.js";

const valueOptions = new Map([
  ["--path", "path"],
  ["-p", "path"],
  ["--interval", "interval"],
  ["--from", "from"],
  ["--to", "to"]
]);
const detailsOptions = new Set(["--details", "--manual", "--man"]);
const detailsAliases = new Set(["detail", "details", "manual", "man"]);

export async function runCli(rawArgs, io = defaultIo()) {
  const args = parseArgs(rawArgs);

  try {
    await runCommand(args, io);
    return io.exitCode ?? 0;
  } catch (error) {
    writeLine(io.stderr, error.message);
    return 1;
  }
}

async function runCommand(parsedArgs, io) {
  if (parsedArgs.help || parsedArgs.command === "help") {
    writeLine(io.stdout, parsedArgs.details ? detailedHelpText() : shortHelpText());
    return;
  }

  const command = parsedArgs.command ?? "scan";
  const projectPath = path.resolve(parsedArgs.path ?? process.cwd());
  const handler = commandHandlers[command];

  if (!handler) {
    throw new Error(`Unknown command: ${command}\nRun "guardrails --help" for usage.`);
  }

  await handler(projectPath, parsedArgs, io);
}

function parseArgs(rawArgs) {
  const parsed = {
    command: null,
    path: null,
    interval: 300000,
    from: null,
    to: null,
    help: false,
    details: false
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "help" && !parsed.command) {
      parsed.command = "help";
      continue;
    }

    if (arg === "man" && !parsed.command) {
      parsed.command = "help";
      parsed.details = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (detailsOptions.has(arg)) {
      parsed.help = true;
      parsed.details = true;
      continue;
    }

    if (detailsAliases.has(arg) && (parsed.help || parsed.command === "help")) {
      parsed.details = true;
      continue;
    }

    if (valueOptions.has(arg)) {
      const key = valueOptions.get(arg);
      const value = rawArgs[index + 1];
      parsed[key] = key === "interval" ? Number(value) : value;
      index += 1;
      continue;
    }

    if (!parsed.command) {
      parsed.command = arg;
    }
  }

  return parsed;
}

function writeLine(stream, line) {
  stream.write(`${line}\n`);
}

function defaultIo() {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    exitCode: 0
  };
}
