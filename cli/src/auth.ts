import type { DeployIO } from "./deploy.js";
import { CommandNotFoundError, RERUN } from "./errors.js";

async function run(io: DeployIO, command: string[]): Promise<string> {
  return io.run(command[0], command.slice(1));
}

/** Runs `check`; if it fails, offers to run the interactive `login` and checks again. */
export async function ensureLogin(io: DeployIO, service: string, check: string[], login: string[]): Promise<void> {
  try {
    await run(io, check);
    return;
  } catch (error) {
    if (error instanceof CommandNotFoundError) throw error;
  }
  const loginCommand = login.join(" ");
  if (!(await io.confirm(`Not logged in to ${service}. Run \`${loginCommand}\` now?`))) {
    throw new Error(`Not logged in to ${service}. Run \`${loginCommand}\`, then re-run \`${RERUN}\`.`);
  }
  try {
    await io.runInteractive(login[0], login.slice(1));
  } catch (error) {
    if (error instanceof CommandNotFoundError) throw error;
    throw new Error(`\`${loginCommand}\` did not finish. Run it yourself, then re-run \`${RERUN}\`.`);
  }
  try {
    await run(io, check);
  } catch {
    throw new Error(`Still not logged in to ${service} after \`${loginCommand}\`. Try it again, then re-run \`${RERUN}\`.`);
  }
}
