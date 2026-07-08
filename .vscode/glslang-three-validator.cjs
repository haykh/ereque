#!/usr/bin/env node

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const args = process.argv.slice(2);

function getStage(argv) {
  const index = argv.indexOf("-S");
  if (index !== -1 && argv[index + 1]) return argv[index + 1];

  const stdinStage = argv.indexOf("--stdin");
  if (stdinStage !== -1) {
    const nextStage = argv.indexOf("-S", stdinStage);
    if (nextStage !== -1 && argv[nextStage + 1]) return argv[nextStage + 1];
  }

  return "";
}

function hasArg(argv, name) {
  return argv.includes(name) || argv.some((arg) => arg.startsWith(`${name}=`));
}

function readInjection(stage) {
  const folder = path.join(process.cwd(), ".vscode");
  const candidates = [
    stage ? `${stage}.injection` : "",
    "global.injection",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const file = path.join(folder, candidate);
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, "utf8").replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function run(source) {
  const stage = getStage(args);
  const injection = readInjection(stage);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "glslang-three-"));
  const tempFile = path.join(tempDir, `shader.${stage || "glsl"}`);
  const nextArgs = args.filter((arg) => arg !== "--stdin");

  fs.writeFileSync(tempFile, source);

  if (injection && !hasArg(nextArgs, "--preamble-text") && !hasArg(nextArgs, "-P")) {
    if (!nextArgs.includes("-l")) nextArgs.unshift("-l");
    nextArgs.unshift("--preamble-text", injection);
  }

  nextArgs.push(tempFile);

  const result = cp.spawnSync("glslangValidator", nextArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  fs.rmSync(tempDir, { recursive: true, force: true });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

run(fs.readFileSync(0, "utf8"));
