/** What a user re-runs after fixing a failure. */
export const RERUN = "npx @composio/memebot deploy";

/** Thrown when a command cannot be started because it is not installed. */
export class CommandNotFoundError extends Error {
  constructor(readonly command: string) {
    super(`${command}: command not found`);
  }
}

/** An error that knows its own fix, for failures the step's generic fix would misdescribe. */
export class FixableError extends Error {
  constructor(message: string, readonly fix: string) {
    super(message);
  }
}

const TOOLS: Record<string, { name: string; brew: string; url: string }> = {
  gh: { name: "GitHub CLI (`gh`)", brew: "brew install gh", url: "https://cli.github.com" },
  git: { name: "Git", brew: "brew install git", url: "https://git-scm.com/downloads" },
  npx: { name: "Node.js (`npx`)", brew: "brew install node", url: "https://nodejs.org" },
};

export function notInstalledMessage(command: string): string {
  const tool = TOOLS[command];
  if (!tool) return `\`${command}\` is not installed. Install it, then re-run \`${RERUN}\`.`;
  const how = process.platform === "darwin" ? `\`${tool.brew}\` (or see ${tool.url})` : `see ${tool.url}`;
  return `${tool.name} is not installed. Install it: ${how}. Then re-run \`${RERUN}\`.`;
}
