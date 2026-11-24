import { existsSync } from "node:fs";
import path from "node:path";
import { ensureLogin } from "./auth.js";
import type { DeployIO } from "./deploy.js";

const TEMPLATE_REPO = "ComposioHQ/memebot";

export function requireGitHubLogin(io: DeployIO): Promise<void> {
  return ensureLogin(io, "GitHub", ["gh", "auth", "status"], ["gh", "auth", "login"]);
}

/** Makes sure `<cwd>/<name>` is a clone of a private repo created from the template, reusing either if it already exists. */
export async function createRepoFromTemplate(io: DeployIO, name: string, cwd: string): Promise<void> {
  const owner = (await io.run("gh", ["api", "user", "--jq", ".login"])).trim();
  const repo = `${owner}/${name}`;
  const needsClone = !existsSync(path.join(cwd, name));
  const repoExists = await io.run("gh", ["repo", "view", repo]).then(() => true, () => false);

  if (!repoExists) {
    await io.run("gh", ["repo", "create", name, "--template", TEMPLATE_REPO, "--private", ...(needsClone ? ["--clone"] : [])], { cwd });
  } else if (needsClone) {
    await io.run("gh", ["repo", "clone", repo], { cwd });
  }
}
