import { ensureLogin } from "./auth.js";
import { FixableError } from "./errors.js";
import type { DeployIO, RunOptions } from "./deploy.js";

/** Runs through npx so a global Vercel CLI install is not required. The major is pinned so flags stay stable. */
const VERCEL_CLI = "vercel@66";
const npxVercel = (...args: string[]) => ["npx", "--yes", VERCEL_CLI, ...args];

export interface Team {
  slug: string;
  name?: string;
}

function runVercel(io: DeployIO, args: string[], options?: RunOptions): Promise<string> {
  const [command, ...npxArgs] = npxVercel(...args);
  return io.run(command, npxArgs, options);
}

export async function checkVercelCli(io: DeployIO): Promise<void> {
  await runVercel(io, ["--version"]);
}

export function requireVercelLogin(io: DeployIO): Promise<void> {
  return ensureLogin(io, "Vercel", npxVercel("whoami"), npxVercel("login"));
}

export async function listTeams(io: DeployIO): Promise<Team[]> {
  const output = await runVercel(io, ["teams", "list", "--json", "--limit", "100"], { stdoutOnly: true });
  return (JSON.parse(output) as { teams?: Team[] }).teams ?? [];
}

/** Vercel commands for one team. Without a scope, `vercel link` refuses to run non-interactively when an account has several teams. */
export function vercelIn(io: DeployIO, scope?: string) {
  const vercel = (args: string[], options?: RunOptions) =>
    runVercel(io, [...args, ...(scope ? ["--scope", scope] : [])], options);

  return {
    async link(projectName: string, cwd: string): Promise<void> {
      await vercel(["link", "--yes", "--project", projectName], { cwd });
    },

    async setEnvVar(name: string, value: string, cwd: string): Promise<void> {
      await vercel(["env", "add", name, "--environment", "production", "--force", "--yes"], { cwd, input: value });
    },

    /** Deploys to production and resolves with the stable production domain, not the per-deployment URL. */
    async deployToProduction(cwd: string): Promise<string> {
      const output = await vercel(["deploy", "--prod", "--yes"], { cwd });
      const aliased = output.match(/Aliased:\s*(https:\/\/\S+)/)?.[1];
      if (aliased) return aliased;

      const deploymentUrl = output.match(/https:\/\/\S+\.vercel\.app/)?.[0];
      if (!deploymentUrl) {
        throw new FixableError(
          `Vercel did not report a deployment URL:\n${output}`,
          "See the deployment in your Vercel dashboard (or `npx --yes vercel@66 ls`).",
        );
      }
      const details = await vercel(["inspect", deploymentUrl], { cwd });
      const alias = details.match(/Aliases[\s\S]*?(https:\/\/\S+)/)?.[1];
      if (!alias) {
        throw new FixableError(
          `The deployment succeeded, but its production domain was not found for ${deploymentUrl}:\n${details}`,
          "Find the domain under your project's Domains in the Vercel dashboard and use it for the Photon webhook URL.",
        );
      }
      return alias;
    },
  };
}
