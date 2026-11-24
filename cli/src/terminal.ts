import { execFile, spawn } from "node:child_process";
import { cancel, confirm, isCancel, log, password, select, spinner, text } from "@clack/prompts";
import type { DeployIO } from "./deploy.js";
import { CommandNotFoundError } from "./errors.js";

/** Exits quietly when the user cancels a prompt. */
function answered<T>(answer: T): Exclude<T, symbol> {
  if (isCancel(answer)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return answer as Exclude<T, symbol>;
}

export const terminalIO: DeployIO = {
  run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = execFile(command, args, { cwd: options.cwd }, (error, stdout, stderr) => {
        if (!error) resolve(options.stdoutOnly ? stdout : stdout + stderr);
        else if ((error as NodeJS.ErrnoException).code === "ENOENT") reject(new CommandNotFoundError(command));
        else reject(new Error(`${command} ${args.join(" ")} failed:\n${stderr || error.message}`));
      });
      child.stdin?.on("error", () => {}); // a missing command closes stdin before we write
      child.stdin?.end(options.input);
    });
  },

  runInteractive(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: "inherit" });
      child.on("error", (error: NodeJS.ErrnoException) =>
        reject(error.code === "ENOENT" ? new CommandNotFoundError(command) : error),
      );
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`)),
      );
    });
  },

  async ask(message, options = {}) {
    return answered(await (options.secret ? password({ message }) : text({ message })));
  },

  async confirm(message) {
    return answered(await confirm({ message, initialValue: true }));
  },

  async select(message, choices) {
    return answered(await select({ message, options: choices }));
  },

  async step(title, fn) {
    const spin = spinner();
    spin.start(title);
    try {
      const result = await fn();
      spin.stop(title);
      return result;
    } catch (error) {
      spin.error(title);
      throw error;
    }
  },

  log: (message) => log.info(message),
};
