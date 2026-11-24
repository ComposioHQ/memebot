#!/usr/bin/env node
import { intro, log, outro } from "@clack/prompts";
import { deploy } from "./deploy.js";
import { terminalIO } from "./terminal.js";

if (process.argv[2] !== "deploy") {
  console.error("Usage: memebot deploy");
  process.exit(1);
}

intro("memebot deploy");
try {
  await deploy(terminalIO);
  outro("Done.");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
