import path from "node:path";
import { CommandNotFoundError, FixableError, notInstalledMessage, RERUN } from "./errors.js";
import { createRepoFromTemplate, requireGitHubLogin } from "./github.js";
import { checkVercelCli, listTeams, requireVercelLogin, vercelIn } from "./vercel.js";

export interface RunOptions {
  cwd?: string;
  /** Written to the command's stdin. */
  input?: string;
  /** Resolve with stdout only, for output that is parsed. */
  stdoutOnly?: boolean;
}

export interface DeployIO {
  /** Runs a command and resolves with its stdout followed by its stderr (stdout alone with `stdoutOnly`); rejects when it exits non-zero, and with CommandNotFoundError when it is not installed. */
  run(command: string, args: string[], options?: RunOptions): Promise<string>;
  /** Runs a command attached to the user's terminal (for logins); rejects when it exits non-zero. */
  runInteractive(command: string, args: string[]): Promise<void>;
  /** Asks the user for a line of text; an empty answer is allowed. */
  ask(message: string, options?: { secret?: boolean }): Promise<string>;
  confirm(message: string): Promise<boolean>;
  /** Asks the user to pick one of `choices` and resolves with its value. */
  select(message: string, choices: { value: string; label: string }[]): Promise<string>;
  /** Runs `fn` behind a spinner labelled `title`. */
  step<T>(title: string, fn: () => Promise<T>): Promise<T>;
  log(message: string): void;
}

export interface DeployResult {
  url: string;
}

/** On macOS a missing git is often the Command Line Tools stub, which exits non-zero instead of failing to spawn. */
const installFix =
  process.platform === "darwin"
    ? "Run `xcode-select --install` (macOS Command Line Tools), or install the failing tool."
    : "Install or repair the failing tool.";

const DEFAULT_PROJECT_NAME = "imessage-memebot";

async function askRequired(io: DeployIO, message: string, options?: { secret?: boolean }): Promise<string> {
  const answer = (await io.ask(message, options)).trim();
  if (!answer) throw new Error(`${message} is required.`);
  return answer;
}

/**
 * Runs one deploy step behind a spinner. A failure is reported as the step's name, the last lines of the
 * command's stderr and a fix. Secrets only travel over stdin, so the error text never contains them.
 */
async function step<T>(io: DeployIO, title: string, fix: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await io.step(title, fn);
  } catch (error) {
    if (error instanceof CommandNotFoundError) throw new Error(notInstalledMessage(error.command));
    const tail = (error instanceof Error ? error.message : String(error)).trim().split("\n").slice(-5).join("\n");
    throw new Error(`Step failed: ${title}\n${tail}\nFix: ${error instanceof FixableError ? error.fix : fix}\nThen re-run \`${RERUN}\`. Finished steps are skipped or safely repeated.`);
  }
}

export async function deploy(io: DeployIO, cwd = process.cwd()): Promise<DeployResult> {
  await step(io, "Check git, gh and npx are installed", installFix, async () => {
    for (const command of ["git", "gh", "npx"]) await io.run(command, ["--version"]);
  });
  await step(io, "Check the Vercel CLI can run", "Check your internet connection, then try `npx --yes vercel@66 --version`.", () =>
    checkVercelCli(io),
  );
  await requireVercelLogin(io);
  await requireGitHubLogin(io);

  const teams = await step(io, "List your Vercel teams", "Try `npx --yes vercel@66 teams list` to see the error.", () => listTeams(io));
  const scope =
    teams.length > 1
      ? await io.select("Which Vercel team should own the project?", teams.map((team) => ({ value: team.slug, label: team.name ?? team.slug })))
      : teams[0]?.slug;
  const vercel = vercelIn(io, scope);

  io.log("Composio Instant tools must be enabled on your Composio project: https://dashboard.composio.dev/~/project/settings/general");
  const composioApiKey = await askRequired(io, "COMPOSIO_API_KEY", { secret: true });
  const projectName = (await io.ask(`Project name (${DEFAULT_PROJECT_NAME})`)).trim() || DEFAULT_PROJECT_NAME;
  const projectId = await askRequired(io, "IMESSAGE_PROJECT_ID");
  const projectSecret = await askRequired(io, "IMESSAGE_PROJECT_SECRET", { secret: true });

  await step(io, "Create the GitHub repo", "Check `gh auth status` and that you can create repos in your GitHub account.", () =>
    createRepoFromTemplate(io, projectName, cwd),
  );
  const projectDir = path.join(cwd, projectName);
  await step(io, "Link the Vercel project", "Check you can create projects in the chosen Vercel team.", () =>
    vercel.link(projectName, projectDir),
  );

  const env = {
    COMPOSIO_API_KEY: composioApiKey,
    IMESSAGE_PROJECT_ID: projectId,
    IMESSAGE_PROJECT_SECRET: projectSecret,
  };
  const setEnv = (name: string, value: string) =>
    step(io, `Set ${name} on Vercel`, `Check \`npx --yes vercel@66 whoami\` works and your team can edit the project.`, () =>
      vercel.setEnvVar(name, value, projectDir),
    );
  for (const [name, value] of Object.entries(env)) await setEnv(name, value);

  const deployToProduction = (title: string) =>
    step(io, title, "See the build error with `npx --yes vercel@66 inspect <deployment-url> --logs` (the URL is in your Vercel dashboard).", () => vercel.deployToProduction(projectDir));
  const url = await deployToProduction("Deploy to production");

  io.log(`Register this webhook URL in your Photon project: ${url}/eve/v1/photon`);
  const webhookSecret = await askRequired(io, "IMESSAGE_WEBHOOK_SECRET (shown by Photon after registering)", {
    secret: true,
  });
  await setEnv("IMESSAGE_WEBHOOK_SECRET", webhookSecret);
  await deployToProduction("Redeploy with the webhook secret");

  io.log(`Deployed: ${url}`);
  io.log("Add your phone number in the Photon dashboard under Users (the free plan only accepts listed numbers), then text your bot's number.");
  return { url };
}
